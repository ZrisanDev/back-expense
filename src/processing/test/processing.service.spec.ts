import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { ProcessingService } from '../processing.service';
import { ProcessingResult } from '../entities/processing-result.entity';
import { ExpenseStatusHistory } from '../entities/expense-status-history.entity';
import { Expense, ExpenseStatus } from '../../expenses/entities/expense.entity';
import { ProcessingResultRequestDto } from '../dto/processing-result-request.dto';

// Duck-typing helpers since mocked entities may not pass instanceof
function isProcessingResult(entity: any): boolean {
  return entity && 'processedAt' in entity && 'rawText' in entity;
}
function isExpenseStatusHistory(entity: any): boolean {
  return entity && 'fromStatus' in entity && 'toStatus' in entity;
}

describe('ProcessingService', () => {
  let service: ProcessingService;
  let dataSource: { createQueryRunner: jest.Mock };
  let configService: { get: jest.Mock };
  let queryRunner: {
    startTransaction: jest.Mock;
    commitTransaction: jest.Mock;
    rollbackTransaction: jest.Mock;
    release: jest.Mock;
    manager: {
      findOne: jest.Mock;
      save: jest.Mock;
    };
  };

  const expenseId = 'exp-123';

  const mockProcessingExpense: Partial<Expense> = {
    id: expenseId,
    userId: 'user-1',
    amount: 0,
    currency: 'USD',
    vendor: null,
    date: '2024-01-01',
    status: ExpenseStatus.PROCESSING,
    isDuplicateSuspect: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    files: [],
    processingResults: [],
    statusHistory: [],
  };

  const baseDto: ProcessingResultRequestDto = {
    expenseId,
    s3Key: 'expenses/exp-123/receipt.jpg',
    status: ExpenseStatus.PROCESSED,
  };

  beforeEach(async () => {
    queryRunner = {
      startTransaction: jest.fn(),
      commitTransaction: jest.fn(),
      rollbackTransaction: jest.fn(),
      release: jest.fn(),
      manager: {
        findOne: jest.fn(),
        save: jest.fn(),
      },
    };

    dataSource = {
      createQueryRunner: jest.fn().mockReturnValue(queryRunner),
    };

    configService = {
      get: jest.fn((key: string) => {
        if (key === 'CONFIDENCE_THRESHOLD') return '0.7';
        return undefined;
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProcessingService,
        { provide: DataSource, useValue: dataSource },
        { provide: ConfigService, useValue: configService },
        {
          provide: getRepositoryToken(ProcessingResult),
          useValue: {},
        },
        {
          provide: getRepositoryToken(ExpenseStatusHistory),
          useValue: {},
        },
        {
          provide: getRepositoryToken(Expense),
          useValue: {},
        },
      ],
    }).compile();

    service = module.get<ProcessingService>(ProcessingService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('processResult', () => {
    it('should create ProcessingResult, update Expense status, and create ExpenseStatusHistory when PROCESSED', async () => {
      const dto: ProcessingResultRequestDto = {
        ...baseDto,
        rawText: 'Coffee $5.00',
        structuredJson: { amount: 5.0, currency: 'USD', vendor: 'Starbucks', date: '2024-01-15', categoryId: 'cat-1' },
        confidence: 0.95,
      };

      const expense = { ...mockProcessingExpense };

      queryRunner.manager.findOne.mockResolvedValueOnce(expense);
      queryRunner.manager.save.mockImplementation(async (entity: any) => {
        if (isProcessingResult(entity)) return { id: 'pr-1', ...entity };
        if (isExpenseStatusHistory(entity)) return { id: 'sh-1', ...entity };
        return entity;
      });

      const result = await service.processResult(dto);

      expect(queryRunner.startTransaction).toHaveBeenCalled();
      expect(queryRunner.manager.findOne).toHaveBeenCalledWith(
        Expense,
        { where: { id: expenseId } },
      );
      expect(queryRunner.manager.save).toHaveBeenCalledTimes(3);
      expect(queryRunner.commitTransaction).toHaveBeenCalled();
      expect(queryRunner.rollbackTransaction).not.toHaveBeenCalled();
      expect(queryRunner.release).toHaveBeenCalled();
      // result is the saved ProcessingResult
      expect(result).toBeDefined();
      expect(result.expenseId).toBe(expenseId);
    });

    it('should update expense fields when PROCESSED and structuredJson has fields', async () => {
      const dto: ProcessingResultRequestDto = {
        ...baseDto,
        status: ExpenseStatus.PROCESSED,
        structuredJson: { amount: 42.5, currency: 'EUR', vendor: 'Amazon', date: '2024-03-10', categoryId: 'cat-abc' },
        confidence: 0.98,
      };

      const expense = { ...mockProcessingExpense };

      queryRunner.manager.findOne.mockResolvedValueOnce(expense);
      queryRunner.manager.save.mockImplementation(async (entity: any) => {
        // Check for expense by looking for the expenseId and isDuplicateSuspect fields
        if (entity && entity.id === expenseId && 'isDuplicateSuspect' in entity) {
          expect(entity.amount).toBe(42.5);
          expect(entity.currency).toBe('EUR');
          expect(entity.vendor).toBe('Amazon');
          expect(entity.date).toBe('2024-03-10');
          expect(entity.categoryId).toBe('cat-abc');
          expect(entity.status).toBe(ExpenseStatus.PROCESSED);
          return entity;
        }
        return { id: 'pr-2', ...entity };
      });

      await service.processResult(dto);

      expect(queryRunner.manager.save).toHaveBeenCalledTimes(3);
    });

    it('should throw NotFoundException when expense does not exist', async () => {
      queryRunner.manager.findOne.mockResolvedValueOnce(null);

      const promise = service.processResult(baseDto);
      await expect(promise).rejects.toThrow(NotFoundException);
      await expect(promise).rejects.toThrow('Expense not found');

      expect(queryRunner.rollbackTransaction).toHaveBeenCalled();
      expect(queryRunner.release).toHaveBeenCalled();
    });

    it('should throw BadRequestException when expense is not in PROCESSING status', async () => {
      const dto: ProcessingResultRequestDto = { ...baseDto };
      const uploadedExpense = { ...mockProcessingExpense, status: ExpenseStatus.UPLOADED };

      queryRunner.manager.findOne.mockResolvedValueOnce(uploadedExpense);

      const promise = service.processResult(dto);
      await expect(promise).rejects.toThrow(BadRequestException);
      await expect(promise).rejects.toThrow('Expense is not in PROCESSING status');

      expect(queryRunner.rollbackTransaction).toHaveBeenCalled();
      expect(queryRunner.release).toHaveBeenCalled();
    });

    it('should rollback transaction on failure', async () => {
      queryRunner.manager.findOne.mockResolvedValueOnce(mockProcessingExpense);
      queryRunner.manager.save.mockRejectedValueOnce(new Error('DB connection lost'));

      await expect(service.processResult(baseDto)).rejects.toThrow('DB connection lost');

      expect(queryRunner.startTransaction).toHaveBeenCalled();
      expect(queryRunner.rollbackTransaction).toHaveBeenCalled();
      expect(queryRunner.commitTransaction).not.toHaveBeenCalled();
      expect(queryRunner.release).toHaveBeenCalled();
    });

    it('should handle NEEDS_REVIEW status without updating expense fields', async () => {
      const dto: ProcessingResultRequestDto = {
        ...baseDto,
        status: ExpenseStatus.NEEDS_REVIEW,
        rawText: 'blurry receipt',
        confidence: 0.4,
      };

      const expense = { ...mockProcessingExpense };
      queryRunner.manager.findOne.mockResolvedValueOnce(expense);
      queryRunner.manager.save.mockImplementation(async (entity: any) => {
        if (entity && entity.id === expenseId && 'isDuplicateSuspect' in entity) {
          // Expense fields should NOT be updated from structuredJson
          expect(entity.amount).toBe(0); // original value
          expect(entity.status).toBe(ExpenseStatus.NEEDS_REVIEW);
          return entity;
        }
        if (isExpenseStatusHistory(entity)) {
          expect(entity.fromStatus).toBe(ExpenseStatus.PROCESSING);
          expect(entity.toStatus).toBe(ExpenseStatus.NEEDS_REVIEW);
          return { id: 'sh-3', ...entity };
        }
        return { id: 'pr-3', ...entity };
      });

      await service.processResult(dto);

      expect(queryRunner.commitTransaction).toHaveBeenCalled();
    });

    it('should handle FAILED status and save errorMessage in history reason', async () => {
      const dto: ProcessingResultRequestDto = {
        ...baseDto,
        status: ExpenseStatus.FAILED,
        errorMessage: 'OCR could not extract text',
      };

      const expense = { ...mockProcessingExpense };
      queryRunner.manager.findOne.mockResolvedValueOnce(expense);
      queryRunner.manager.save.mockImplementation(async (entity: any) => {
        if (isExpenseStatusHistory(entity)) {
          expect(entity.toStatus).toBe(ExpenseStatus.FAILED);
          expect(entity.reason).toBe('OCR could not extract text');
          return { id: 'sh-4', ...entity };
        }
        return { id: 'pr-4', ...entity };
      });

      await service.processResult(dto);

      expect(queryRunner.commitTransaction).toHaveBeenCalled();
    });

    it('should override status to NEEDS_REVIEW when confidence is below threshold', async () => {
      const dto: ProcessingResultRequestDto = {
        ...baseDto,
        status: ExpenseStatus.PROCESSED,
        structuredJson: { amount: 10, currency: 'USD' },
        confidence: 0.5, // below default 0.7 threshold
      };

      const expense = { ...mockProcessingExpense };
      queryRunner.manager.findOne.mockResolvedValueOnce(expense);
      queryRunner.manager.save.mockImplementation(async (entity: any) => {
        if (entity && entity.id === expenseId && 'isDuplicateSuspect' in entity) {
          // Status should be overridden to NEEDS_REVIEW, not PROCESSED
          expect(entity.status).toBe(ExpenseStatus.NEEDS_REVIEW);
          // Expense fields should NOT be updated (it's not PROCESSED)
          expect(entity.amount).toBe(0);
          return entity;
        }
        if (isExpenseStatusHistory(entity)) {
          expect(entity.toStatus).toBe(ExpenseStatus.NEEDS_REVIEW);
          return { id: 'sh-5', ...entity };
        }
        return { id: 'pr-5', ...entity };
      });

      await service.processResult(dto);

      expect(queryRunner.commitTransaction).toHaveBeenCalled();
    });

    it('should default reason to "auto" when no errorMessage and not FAILED', async () => {
      const dto: ProcessingResultRequestDto = {
        ...baseDto,
        status: ExpenseStatus.PROCESSED,
        rawText: 'some text',
        structuredJson: { amount: 5, currency: 'USD' },
        confidence: 0.9,
      };

      const expense = { ...mockProcessingExpense };
      queryRunner.manager.findOne.mockResolvedValueOnce(expense);
      queryRunner.manager.save.mockImplementation(async (entity: any) => {
        if (isExpenseStatusHistory(entity)) {
          expect(entity.reason).toBe('auto');
          return { id: 'sh-6', ...entity };
        }
        return { id: 'pr-6', ...entity };
      });

      await service.processResult(dto);
    });

    it('should set processedAt to current time when creating ProcessingResult', async () => {
      const dto: ProcessingResultRequestDto = {
        ...baseDto,
        status: ExpenseStatus.PROCESSED,
        confidence: 0.95,
      };

      const expense = { ...mockProcessingExpense };
      queryRunner.manager.findOne.mockResolvedValueOnce(expense);
      queryRunner.manager.save.mockImplementation(async (entity: any) => {
        if (isProcessingResult(entity)) {
          expect(entity.processedAt).toBeInstanceOf(Date);
          return { id: 'pr-7', ...entity };
        }
        return entity;
      });

      await service.processResult(dto);
    });
  });
});
