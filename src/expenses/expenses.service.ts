import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Observable, map, takeUntil, filter, Subject, timer } from 'rxjs';
import { CreateExpenseDto } from './dto/create-expense.dto';
import { UpdateExpenseDto } from './dto/update-expense.dto';
import { QueryExpenseDto } from './dto/query-expense.dto';
import { Expense, ExpenseStatus } from './entities/expense.entity';
import { FilesService } from '../files/files.service';

const REPROCESSABLE_STATUSES: ExpenseStatus[] = [
  ExpenseStatus.FAILED,
  ExpenseStatus.NEEDS_REVIEW,
  ExpenseStatus.PROCESSED,
];

const TERMINAL_STATUSES: ExpenseStatus[] = [
  ExpenseStatus.PROCESSED,
  ExpenseStatus.APPROVED,
  ExpenseStatus.FAILED,
];

@Injectable()
export class ExpensesService {
  private readonly logger = new Logger(ExpensesService.name);
  private readonly maxRetries: number;

  constructor(
    @InjectRepository(Expense)
    private readonly expenseRepository: Repository<Expense>,
    private readonly filesService: FilesService,
    private readonly eventEmitter: EventEmitter2,
    private readonly configService: ConfigService,
  ) {
    this.maxRetries = this.configService.get<number>('MAX_RETRIES') ?? 3;
  }

  async create(userId: string, createExpenseDto: CreateExpenseDto) {
    const duplicate = await this.findDuplicate(userId, createExpenseDto);

    const expense = this.expenseRepository.create({
      ...createExpenseDto,
      userId,
      isDuplicateSuspect: !!duplicate,
    });

    const saved = await this.expenseRepository.save(expense);

    return {
      ...saved,
      duplicateWarning: duplicate
        ? `Possible duplicate of expense ${duplicate.id}`
        : null,
    };
  }

  async findAll(userId: string, query: QueryExpenseDto) {
    const {
      page = 1,
      limit = 20,
      status,
      category,
      dateFrom,
      dateTo,
      vendor,
      sortBy = 'createdAt',
      sortOrder = 'DESC',
    } = query;

    const qb = this.expenseRepository
      .createQueryBuilder('expense')
      .leftJoinAndSelect('expense.category', 'category')
      .where('expense.userId = :userId', { userId });

    if (status) {
      qb.andWhere('expense.status = :status', { status });
    }

    if (category) {
      qb.andWhere('expense.categoryId = :categoryId', { categoryId: category });
    }

    if (dateFrom) {
      qb.andWhere('expense.date >= :dateFrom', { dateFrom });
    }

    if (dateTo) {
      qb.andWhere('expense.date <= :dateTo', { dateTo });
    }

    if (vendor) {
      qb.andWhere('expense.vendor ILIKE :vendor', { vendor: `%${vendor}%` });
    }

    qb.orderBy(`expense.${sortBy}`, sortOrder)
      .skip((page - 1) * limit)
      .take(limit);

    const [items, total] = await qb.getManyAndCount();

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findOne(id: string, userId: string) {
    const expense = await this.expenseRepository.findOne({
      where: { id },
      relations: ['category'],
    });

    if (!expense) {
      throw new NotFoundException('Expense not found');
    }

    if (expense.userId !== userId) {
      throw new ForbiddenException('Access denied');
    }

    return expense;
  }

  async update(id: string, userId: string, updateExpenseDto: UpdateExpenseDto) {
    const expense = await this.findOne(id, userId);

    if (
      expense.status !== ExpenseStatus.NEEDS_REVIEW &&
      expense.status !== ExpenseStatus.PROCESSED
    ) {
      throw new BadRequestException(
        `Cannot edit expense with status ${expense.status}. Only NEEDS_REVIEW or PROCESSED can be edited.`,
      );
    }

    Object.assign(expense, updateExpenseDto);
    return this.expenseRepository.save(expense);
  }

  async approve(id: string, userId: string) {
    const expense = await this.findOne(id, userId);

    if (expense.status !== ExpenseStatus.NEEDS_REVIEW) {
      throw new BadRequestException(
        `Cannot approve expense with status ${expense.status}. Only NEEDS_REVIEW can be approved.`,
      );
    }

    expense.status = ExpenseStatus.APPROVED;
    return this.expenseRepository.save(expense);
  }

  async reprocess(id: string, userId: string): Promise<Expense> {
    const expense = await this.findOne(id, userId);
    const previousStatus = expense.status;

    if (expense.status === ExpenseStatus.PROCESSING) {
      throw new ConflictException('Expense is already being processed');
    }

    if (!REPROCESSABLE_STATUSES.includes(expense.status)) {
      throw new BadRequestException(
        `Cannot reprocess expense with status ${expense.status}`,
      );
    }

    if (expense.retryCount >= this.maxRetries) {
      throw new HttpException(
        'Maximum retry limit reached',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    expense.status = ExpenseStatus.PROCESSING;
    expense.retryCount += 1;
    expense.processingStartedAt = new Date();

    const saved = await this.expenseRepository.save(expense);

    this.eventEmitter.emit('expense.status.changed', {
      expenseId: id,
      status: ExpenseStatus.PROCESSING,
      userId,
      previousStatus,
    });

    // Get the first file's s3Key for processing trigger
    await this.filesService.triggerProcessing(id, '');

    return saved;
  }

  getStatusStream(expenseId: string, userId: string): Observable<MessageEvent> {
    return new Observable<MessageEvent>((subscriber) => {
      this.findOne(expenseId, userId)
        .then(() => {
          const kill$ = new Subject<void>();
          const idleTimeout$ = timer(5 * 60 * 1000); // 5-minute idle timeout

          idleTimeout$.subscribe(() => {
            kill$.next();
            kill$.complete();
            subscriber.complete();
          });

          this.eventEmitter
            .on('expense.status.changed' as string)
            .pipe(
              filter(
                (event: { expenseId: string; status: ExpenseStatus }) =>
                  event.expenseId === expenseId,
              ),
              takeUntil(kill$),
            )
            .subscribe((event: { expenseId: string; status: ExpenseStatus; userId: string; previousStatus?: ExpenseStatus }) => {
              const messageEvent = new MessageEvent('status', {
                data: JSON.stringify(event),
              });
              subscriber.next(messageEvent);

              if (TERMINAL_STATUSES.includes(event.status)) {
                kill$.next();
                kill$.complete();
                idleTimeout$.unsubscribe();
                subscriber.complete();
              }
            });
        })
        .catch((error) => {
          subscriber.error(error);
        });
    });
  }

  async remove(id: string, userId: string) {
    const expense = await this.findOne(id, userId);

    try {
      await this.filesService.deleteFilesForExpense(expense.id);
    } catch (error) {
      this.logger.error(
        `Failed to cascade delete files for expense ${expense.id}: ${(error as Error).message}`,
      );
    }

    await this.expenseRepository.remove(expense);
    return { deleted: true };
  }

  private async findDuplicate(
    userId: string,
    dto: CreateExpenseDto,
  ): Promise<Expense | null> {
    return this.expenseRepository.findOne({
      where: {
        userId,
        amount: dto.amount,
        date: dto.date,
        vendor: dto.vendor,
      },
    });
  }
}
