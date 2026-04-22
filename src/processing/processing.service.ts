import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { Repository, DataSource } from 'typeorm';
import { ProcessingResult } from './entities/processing-result.entity';
import { ExpenseStatusHistory } from './entities/expense-status-history.entity';
import { Expense, ExpenseStatus } from '../expenses/entities/expense.entity';
import { ProcessingResultRequestDto } from './dto/processing-result-request.dto';

@Injectable()
export class ProcessingService {
  private readonly confidenceThreshold: number;

  constructor(
    @InjectRepository(ProcessingResult)
    private processingResultRepo: Repository<ProcessingResult>,
    @InjectRepository(ExpenseStatusHistory)
    private statusHistoryRepo: Repository<ExpenseStatusHistory>,
    @InjectRepository(Expense)
    private expenseRepo: Repository<Expense>,
    private dataSource: DataSource,
    private configService: ConfigService,
  ) {
    this.confidenceThreshold = parseFloat(
      this.configService.get<string>('CONFIDENCE_THRESHOLD') || '0.7',
    );
  }

  async processResult(dto: ProcessingResultRequestDto): Promise<ProcessingResult> {
    const queryRunner = this.dataSource.createQueryRunner();

    await queryRunner.startTransaction();

    try {
      // 1. Find expense — 404 if not found
      const expense = await queryRunner.manager.findOne(Expense, {
        where: { id: dto.expenseId },
      });

      if (!expense) {
        throw new NotFoundException('Expense not found');
      }

      // 2. Validate expense is in PROCESSING status — 400 if not
      if (expense.status !== ExpenseStatus.PROCESSING) {
        throw new BadRequestException('Expense is not in PROCESSING status');
      }

      // 3. Determine effective status (confidence threshold override)
      let effectiveStatus = dto.status;
      if (
        dto.status === ExpenseStatus.PROCESSED &&
        dto.confidence !== undefined &&
        dto.confidence < this.confidenceThreshold
      ) {
        effectiveStatus = ExpenseStatus.NEEDS_REVIEW;
      }

      // 4. Create ProcessingResult
      const processingResult = new ProcessingResult();
      processingResult.expenseId = dto.expenseId;
      processingResult.rawText = dto.rawText;
      processingResult.structuredJson = dto.structuredJson ?? null;
      processingResult.confidence = dto.confidence ?? null;
      processingResult.processedAt = new Date();
      const savedResult = await queryRunner.manager.save(processingResult);

      // 5. Update Expense status (+ optionally update fields from structuredJson)
      if (
        effectiveStatus === ExpenseStatus.PROCESSED &&
        dto.structuredJson
      ) {
        const json = dto.structuredJson;
        if (json.amount !== undefined) expense.amount = json.amount;
        if (json.currency !== undefined) expense.currency = json.currency;
        if (json.vendor !== undefined) expense.vendor = json.vendor;
        if (json.date !== undefined) expense.date = json.date;
        if (json.categoryId !== undefined) expense.categoryId = json.categoryId;
      }
      expense.status = effectiveStatus;
      await queryRunner.manager.save(expense);

      // 6. Create ExpenseStatusHistory
      const statusHistory = new ExpenseStatusHistory();
      statusHistory.expenseId = dto.expenseId;
      statusHistory.fromStatus = ExpenseStatus.PROCESSING;
      statusHistory.toStatus = effectiveStatus;
      statusHistory.reason = dto.errorMessage || 'auto';
      await queryRunner.manager.save(statusHistory);

      // 7. Commit
      await queryRunner.commitTransaction();

      return savedResult;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }
}
