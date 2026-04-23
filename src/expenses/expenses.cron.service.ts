import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { Cron } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Expense, ExpenseStatus } from './entities/expense.entity';
import { ExpenseStatusHistory } from '../processing/entities/expense-status-history.entity';

@Injectable()
export class ExpensesCronService {
  private readonly logger = new Logger(ExpensesCronService.name);
  private readonly stuckTimeoutMinutes: number;
  private readonly orphanHours: number;

  constructor(
    @InjectRepository(Expense)
    private readonly expenseRepository: Repository<Expense>,
    @InjectRepository(ExpenseStatusHistory)
    private readonly statusHistoryRepository: Repository<ExpenseStatusHistory>,
    private readonly eventEmitter: EventEmitter2,
    private readonly configService: ConfigService,
  ) {
    this.stuckTimeoutMinutes =
      this.configService.get<number>('STUCK_TIMEOUT_MINUTES') ?? 10;
    this.orphanHours =
      this.configService.get<number>('ORPHAN_HOURS') ?? 1;
  }

  @Cron('*/5 * * * *')
  async handleStuckProcessing(): Promise<void> {
    const threshold = new Date(
      Date.now() - this.stuckTimeoutMinutes * 60 * 1000,
    );

    const stuckExpenses = await this.expenseRepository.find({
      where: {
        status: ExpenseStatus.PROCESSING,
        processingStartedAt: LessThan(threshold),
      },
    });

    for (const expense of stuckExpenses) {
      const previousStatus = expense.status;
      expense.status = ExpenseStatus.FAILED;
      expense.processingStartedAt = null;
      await this.expenseRepository.save(expense);

      const history = new ExpenseStatusHistory();
      history.expenseId = expense.id;
      history.fromStatus = previousStatus;
      history.toStatus = ExpenseStatus.FAILED;
      history.reason = 'stuck: processing timeout exceeded';
      await this.statusHistoryRepository.save(history);

      this.eventEmitter.emit('expense.status.changed', {
        expenseId: expense.id,
        status: ExpenseStatus.FAILED,
        userId: expense.userId,
        previousStatus,
      });

      this.logger.warn(
        `Stuck processing recovered: expense ${expense.id} marked as FAILED (was processing since ${threshold.toISOString()})`,
      );
    }
  }

  @Cron('0 * * * *')
  async cleanOrphans(): Promise<void> {
    const threshold = new Date(Date.now() - this.orphanHours * 60 * 60 * 1000);

    const orphanExpenses = await this.expenseRepository.find({
      where: {
        status: ExpenseStatus.UPLOADED,
        createdAt: LessThan(threshold),
      },
      relations: ['files'],
    });

    for (const expense of orphanExpenses) {
      if (expense.files && expense.files.length > 0) {
        continue;
      }

      expense.status = ExpenseStatus.FAILED;
      await this.expenseRepository.save(expense);

      const history = new ExpenseStatusHistory();
      history.expenseId = expense.id;
      history.fromStatus = ExpenseStatus.UPLOADED;
      history.toStatus = ExpenseStatus.FAILED;
      history.reason = 'orphan: no files uploaded within window';
      await this.statusHistoryRepository.save(history);

      this.logger.warn(
        `Orphan cleanup: expense ${expense.id} marked as FAILED (no files uploaded within ${this.orphanHours}h window)`,
      );
    }
  }
}
