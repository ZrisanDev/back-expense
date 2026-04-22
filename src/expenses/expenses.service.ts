import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateExpenseDto } from './dto/create-expense.dto';
import { UpdateExpenseDto } from './dto/update-expense.dto';
import { QueryExpenseDto } from './dto/query-expense.dto';
import { Expense, ExpenseStatus } from './entities/expense.entity';
import { FilesService } from '../files/files.service';

@Injectable()
export class ExpensesService {
  private readonly logger = new Logger(ExpensesService.name);

  constructor(
    @InjectRepository(Expense)
    private readonly expenseRepository: Repository<Expense>,
    private readonly filesService: FilesService,
  ) {}

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
      where: { id, userId },
      relations: ['category'],
    });

    if (!expense) {
      throw new NotFoundException('Expense not found');
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
