import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ConfigService } from '@nestjs/config';
import { ExpensesCronService } from './expenses.cron.service';
import { Expense, ExpenseStatus } from './entities/expense.entity';
import { ExpenseStatusHistory } from '../processing/entities/expense-status-history.entity';

describe('ExpensesCronService', () => {
  let service: ExpensesCronService;
  let expenseRepo: jest.Mocked<Repository<Expense>>;
  let statusHistoryRepo: jest.Mocked<Repository<ExpenseStatusHistory>>;
  let eventEmitter: jest.Mocked<EventEmitter2>;
  let configService: jest.Mocked<ConfigService>;

  const now = new Date();
  const fifteenMinutesAgo = new Date(now.getTime() - 15 * 60 * 1000);
  const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ExpensesCronService,
        {
          provide: getRepositoryToken(Expense),
          useValue: {
            find: jest.fn(),
            save: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(ExpenseStatusHistory),
          useValue: {
            save: jest.fn(),
          },
        },
        {
          provide: EventEmitter2,
          useValue: {
            emit: jest.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === 'STUCK_TIMEOUT_MINUTES') return 10;
              if (key === 'ORPHAN_HOURS') return 1;
              return undefined;
            }),
          },
        },
      ],
    }).compile();

    service = module.get<ExpensesCronService>(ExpensesCronService);
    expenseRepo = module.get(getRepositoryToken(Expense));
    statusHistoryRepo = module.get(getRepositoryToken(ExpenseStatusHistory));
    eventEmitter = module.get(EventEmitter2);
    configService = module.get(ConfigService);
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.useRealTimers();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('handleStuckProcessing', () => {
    // Task 7.1: Query PROCESSING + processing_started_at > 10min ago
    it('should query expenses in PROCESSING status with stale processing_started_at', async () => {
      (expenseRepo.find as jest.Mock).mockResolvedValue([]);

      await service.handleStuckProcessing();

      expect(expenseRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: ExpenseStatus.PROCESSING,
          }),
        }),
      );
    });

    // Task 7.2: Transition status→FAILED, reset processing_started_at, create history, NO re-trigger
    it('should transition stuck expenses to FAILED and create status history (S8)', async () => {
      const stuckExpense: Partial<Expense> = {
        id: 'exp-stuck',
        userId: 'user-1',
        status: ExpenseStatus.PROCESSING,
        processingStartedAt: fifteenMinutesAgo,
      };

      (expenseRepo.find as jest.Mock).mockResolvedValue([stuckExpense]);
      (expenseRepo.save as jest.Mock).mockImplementation(async (e) => e);
      (statusHistoryRepo.save as jest.Mock).mockImplementation(async (e) => e);

      const loggerSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation();

      await service.handleStuckProcessing();

      // Status should be FAILED
      expect(expenseRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          status: ExpenseStatus.FAILED,
          processingStartedAt: null,
        }),
      );

      // Status history created
      expect(statusHistoryRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          expenseId: 'exp-stuck',
          fromStatus: ExpenseStatus.PROCESSING,
          toStatus: ExpenseStatus.FAILED,
        }),
      );

      // Event emitted
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'expense.status.changed',
        expect.objectContaining({
          expenseId: 'exp-stuck',
          status: ExpenseStatus.FAILED,
          previousStatus: ExpenseStatus.PROCESSING,
        }),
      );

      // Warning logged
      expect(loggerSpy).toHaveBeenCalledWith(
        expect.stringContaining('exp-stuck'),
      );

      loggerSpy.mockRestore();
    });

    it('should NOT re-trigger processing for stuck expenses (R7)', async () => {
      const stuckExpense: Partial<Expense> = {
        id: 'exp-stuck',
        userId: 'user-1',
        status: ExpenseStatus.PROCESSING,
        processingStartedAt: fifteenMinutesAgo,
      };

      (expenseRepo.find as jest.Mock).mockResolvedValue([stuckExpense]);
      (expenseRepo.save as jest.Mock).mockImplementation(async (e) => e);
      (statusHistoryRepo.save as jest.Mock).mockImplementation(async (e) => e);
      jest.spyOn(Logger.prototype, 'warn').mockImplementation();

      await service.handleStuckProcessing();

      // No processing re-trigger — only status change + history + log
      // The event IS emitted (for SSE), but no triggerProcessing call
      expect(expenseRepo.save).toHaveBeenCalledTimes(1);
      expect(statusHistoryRepo.save).toHaveBeenCalledTimes(1);
    });

    it('should handle multiple stuck expenses', async () => {
      const stuckExpenses: Partial<Expense>[] = [
        {
          id: 'exp-stuck-1',
          userId: 'user-1',
          status: ExpenseStatus.PROCESSING,
          processingStartedAt: fifteenMinutesAgo,
        },
        {
          id: 'exp-stuck-2',
          userId: 'user-2',
          status: ExpenseStatus.PROCESSING,
          processingStartedAt: fifteenMinutesAgo,
        },
      ];

      (expenseRepo.find as jest.Mock).mockResolvedValue(stuckExpenses);
      (expenseRepo.save as jest.Mock).mockImplementation(async (e) => e);
      (statusHistoryRepo.save as jest.Mock).mockImplementation(async (e) => e);
      jest.spyOn(Logger.prototype, 'warn').mockImplementation();

      await service.handleStuckProcessing();

      expect(expenseRepo.save).toHaveBeenCalledTimes(2);
      expect(statusHistoryRepo.save).toHaveBeenCalledTimes(2);
    });

    it('should do nothing when no stuck expenses found', async () => {
      (expenseRepo.find as jest.Mock).mockResolvedValue([]);

      await service.handleStuckProcessing();

      expect(expenseRepo.save).not.toHaveBeenCalled();
      expect(statusHistoryRepo.save).not.toHaveBeenCalled();
      expect(eventEmitter.emit).not.toHaveBeenCalled();
    });
  });

  describe('cleanOrphans', () => {
    // Task 8.1: Query UPLOADED + created_at > 1h + no files
    it('should query expenses in UPLOADED status older than orphan window', async () => {
      (expenseRepo.find as jest.Mock).mockResolvedValue([]);

      await service.cleanOrphans();

      expect(expenseRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: ExpenseStatus.UPLOADED,
          }),
          relations: ['files'],
        }),
      );
    });

    // Task 8.2: Status→FAILED + log (S9), orphan File records detected (S10)
    it('should mark orphan expenses as FAILED and log (S9)', async () => {
      const orphanExpense: Partial<Expense> = {
        id: 'exp-orphan',
        userId: 'user-1',
        status: ExpenseStatus.UPLOADED,
        createdAt: twoHoursAgo,
        files: [],
      };

      (expenseRepo.find as jest.Mock).mockResolvedValue([orphanExpense]);
      (expenseRepo.save as jest.Mock).mockImplementation(async (e) => e);
      (statusHistoryRepo.save as jest.Mock).mockImplementation(async (e) => e);
      const loggerSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation();

      await service.cleanOrphans();

      expect(expenseRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          status: ExpenseStatus.FAILED,
        }),
      );

      expect(statusHistoryRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          expenseId: 'exp-orphan',
          fromStatus: ExpenseStatus.UPLOADED,
          toStatus: ExpenseStatus.FAILED,
          reason: 'orphan: no files uploaded within window',
        }),
      );

      expect(loggerSpy).toHaveBeenCalledWith(
        expect.stringContaining('exp-orphan'),
      );

      loggerSpy.mockRestore();
    });

    it('should skip expenses that have files', async () => {
      const expenseWithFiles: Partial<Expense> = {
        id: 'exp-with-files',
        userId: 'user-1',
        status: ExpenseStatus.UPLOADED,
        createdAt: twoHoursAgo,
        files: [{ id: 'file-1' }],
      };

      (expenseRepo.find as jest.Mock).mockResolvedValue([expenseWithFiles]);

      await service.cleanOrphans();

      expect(expenseRepo.save).not.toHaveBeenCalled();
      expect(statusHistoryRepo.save).not.toHaveBeenCalled();
    });

    it('should do nothing when no orphan expenses found', async () => {
      (expenseRepo.find as jest.Mock).mockResolvedValue([]);

      await service.cleanOrphans();

      expect(expenseRepo.save).not.toHaveBeenCalled();
      expect(statusHistoryRepo.save).not.toHaveBeenCalled();
    });
  });
});
