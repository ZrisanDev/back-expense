import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  NotFoundException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Subject, takeUntil } from 'rxjs';
import { ExpensesService } from './expenses.service';
import { Expense, ExpenseStatus } from './entities/expense.entity';
import { FilesService } from '../files/files.service';

describe('ExpensesService', () => {
  let service: ExpensesService;
  let repo: jest.Mocked<Repository<Expense>>;
  let filesService: jest.Mocked<FilesService>;
  let eventEmitter: jest.Mocked<EventEmitter2>;
  let configService: jest.Mocked<ConfigService>;

  const userId = 'user-123';
  const expenseId = 'exp-456';

  const mockExpense: Partial<Expense> = {
    id: expenseId,
    userId,
    amount: 50.0,
    currency: 'USD',
    categoryId: 'cat-789',
    vendor: 'Coffee Shop',
    date: '2024-01-15',
    status: ExpenseStatus.NEEDS_REVIEW,
    isDuplicateSuspect: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockQueryBuilder: any = {
    leftJoinAndSelect: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    getManyAndCount: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ExpensesService,
        {
          provide: getRepositoryToken(Expense),
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
            findOne: jest.fn(),
            remove: jest.fn(),
            createQueryBuilder: jest.fn(() => mockQueryBuilder),
          },
        },
        {
          provide: FilesService,
          useValue: {
            deleteFilesForExpense: jest.fn(),
            triggerProcessing: jest.fn(),
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
              if (key === 'MAX_RETRIES') return 3;
              return undefined;
            }),
          },
        },
      ],
    }).compile();

    service = module.get<ExpensesService>(ExpensesService);
    repo = module.get(getRepositoryToken(Expense));
    filesService = module.get(FilesService);
    eventEmitter = module.get(EventEmitter2);
    configService = module.get(ConfigService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create an expense without duplicate warning', async () => {
      const dto = {
        amount: 50.0,
        currency: 'USD',
        vendor: 'Coffee Shop',
        date: '2024-01-15',
      };
      (repo.findOne as jest.Mock).mockResolvedValue(null);
      (repo.create as jest.Mock).mockReturnValue({
        ...dto,
        userId,
        isDuplicateSuspect: false,
      });
      (repo.save as jest.Mock).mockResolvedValue({
        ...mockExpense,
        ...dto,
      });

      const result = await service.create(userId, dto as any);

      expect(repo.findOne).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            userId,
            amount: dto.amount,
            date: dto.date,
            vendor: dto.vendor,
          }),
        }),
      );
      expect(repo.create).toHaveBeenCalledWith({
        ...dto,
        userId,
        isDuplicateSuspect: false,
      });
      expect(repo.save).toHaveBeenCalled();
      expect(result.duplicateWarning).toBeNull();
    });

    it('should create expense with duplicate warning when duplicate found', async () => {
      const dto = {
        amount: 50.0,
        currency: 'USD',
        vendor: 'Coffee Shop',
        date: '2024-01-15',
      };
      const duplicateExpense = { ...mockExpense, id: 'exp-previous' };
      (repo.findOne as jest.Mock).mockResolvedValue(duplicateExpense);
      (repo.create as jest.Mock).mockReturnValue({
        ...dto,
        userId,
        isDuplicateSuspect: true,
      });
      (repo.save as jest.Mock).mockResolvedValue({
        ...mockExpense,
        isDuplicateSuspect: true,
      });

      const result = await service.create(userId, dto as any);

      expect(result.duplicateWarning).toBe(
        `Possible duplicate of expense ${duplicateExpense.id}`,
      );
    });
  });

  describe('findAll', () => {
    it('should return paginated expenses for user', async () => {
      const query = {
        page: 1,
        limit: 20,
        sortBy: 'createdAt',
        sortOrder: 'DESC' as const,
      };
      const items = [mockExpense];
      mockQueryBuilder.getManyAndCount.mockResolvedValue([items, 1]);

      const result = await service.findAll(userId, query);

      expect(repo.createQueryBuilder).toHaveBeenCalledWith('expense');
      expect(mockQueryBuilder.where).toHaveBeenCalledWith(
        'expense.userId = :userId',
        {
          userId,
        },
      );
      expect(result).toEqual({
        items,
        total: 1,
        page: 1,
        limit: 20,
        totalPages: 1,
      });
    });

    it('should apply status filter when provided', async () => {
      const query = { status: ExpenseStatus.NEEDS_REVIEW };
      mockQueryBuilder.getManyAndCount.mockResolvedValue([[mockExpense], 1]);

      await service.findAll(userId, query);

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'expense.status = :status',
        { status: ExpenseStatus.NEEDS_REVIEW },
      );
    });

    it('should apply vendor search filter when provided', async () => {
      const query = { vendor: 'coffee' };
      mockQueryBuilder.getManyAndCount.mockResolvedValue([[mockExpense], 1]);

      await service.findAll(userId, query);

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'expense.vendor ILIKE :vendor',
        { vendor: '%coffee%' },
      );
    });
  });

  describe('findOne', () => {
    it('should return an expense owned by the user', async () => {
      (repo.findOne as jest.Mock).mockResolvedValue(mockExpense);

      const result = await service.findOne(expenseId, userId);

      expect(repo.findOne).toHaveBeenCalledWith({
        where: { id: expenseId },
        relations: ['category'],
      });
      expect(result).toEqual(mockExpense);
    });

    it('should throw NotFoundException when expense does not exist (404)', async () => {
      (repo.findOne as jest.Mock).mockResolvedValue(null);

      await expect(service.findOne('nonexistent-id', userId)).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.findOne('nonexistent-id', userId)).rejects.toThrow(
        'Expense not found',
      );
    });

    it('should throw ForbiddenException when user does not own the expense (403)', async () => {
      const otherUsersExpense = {
        ...mockExpense,
        userId: 'other-user-456',
      };
      (repo.findOne as jest.Mock).mockResolvedValue(otherUsersExpense);

      await expect(service.findOne(expenseId, userId)).rejects.toThrow(
        ForbiddenException,
      );
      await expect(service.findOne(expenseId, userId)).rejects.toThrow(
        'Access denied',
      );
    });
  });

  describe('update', () => {
    it('should update an expense in NEEDS_REVIEW status', async () => {
      jest.spyOn(service, 'findOne').mockResolvedValue(mockExpense as Expense);
      (repo.save as jest.Mock).mockResolvedValue({
        ...mockExpense,
        amount: 75.0,
      });

      const result = await service.update(expenseId, userId, { amount: 75.0 });

      expect(service.findOne).toHaveBeenCalledWith(expenseId, userId);
      expect(repo.save).toHaveBeenCalledWith(
        expect.objectContaining({ amount: 75.0 }),
      );
    });

    it('should throw BadRequestException when expense status is not editable', async () => {
      const approvedExpense = {
        ...mockExpense,
        status: ExpenseStatus.APPROVED,
      };
      jest
        .spyOn(service, 'findOne')
        .mockResolvedValue(approvedExpense as Expense);

      await expect(
        service.update(expenseId, userId, { amount: 75.0 }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('approve', () => {
    it('should approve an expense in NEEDS_REVIEW status', async () => {
      jest.spyOn(service, 'findOne').mockResolvedValue(mockExpense as Expense);
      (repo.save as jest.Mock).mockResolvedValue({
        ...mockExpense,
        status: ExpenseStatus.APPROVED,
      });

      const result = await service.approve(expenseId, userId);

      expect(service.findOne).toHaveBeenCalledWith(expenseId, userId);
      expect(repo.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: ExpenseStatus.APPROVED }),
      );
    });

    it('should throw BadRequestException when expense is not in NEEDS_REVIEW', async () => {
      const uploadedExpense = {
        ...mockExpense,
        status: ExpenseStatus.UPLOADED,
      };
      jest
        .spyOn(service, 'findOne')
        .mockResolvedValue(uploadedExpense as Expense);

      await expect(service.approve(expenseId, userId)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('remove', () => {
    it('should remove an expense and return { deleted: true }', async () => {
      jest.spyOn(service, 'findOne').mockResolvedValue(mockExpense as Expense);
      (repo.remove as jest.Mock).mockResolvedValue(mockExpense);

      const result = await service.remove(expenseId, userId);

      expect(service.findOne).toHaveBeenCalledWith(expenseId, userId);
      expect(repo.remove).toHaveBeenCalledWith(mockExpense);
      expect(result).toEqual({ deleted: true });
    });

    it('should throw NotFoundException when removing non-existent expense', async () => {
      jest.spyOn(service, 'findOne').mockImplementation(() => {
        throw new NotFoundException('Expense not found');
      });

      await expect(service.remove('nonexistent-id', userId)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should call deleteFilesForExpense before repo.remove when cascading', async () => {
      jest.spyOn(service, 'findOne').mockResolvedValue(mockExpense as Expense);
      (filesService.deleteFilesForExpense as jest.Mock).mockResolvedValue(undefined);
      (repo.remove as jest.Mock).mockResolvedValue(mockExpense);

      await service.remove(expenseId, userId);

      expect(filesService.deleteFilesForExpense).toHaveBeenCalledWith(expenseId);
      expect(repo.remove).toHaveBeenCalledWith(mockExpense);

      // Verify call order: deleteFilesForExpense was called before remove
      const deleteFilesCalls = (filesService.deleteFilesForExpense as jest.Mock).mock.invocationCallOrder;
      const removeCalls = (repo.remove as jest.Mock).mock.invocationCallOrder;
      expect(deleteFilesCalls[0]).toBeLessThan(removeCalls[0]);
    });

    it('should still remove expense when S3 cascade fails for some files', async () => {
      const loggerSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation();
      jest.spyOn(service, 'findOne').mockResolvedValue(mockExpense as Expense);
      (filesService.deleteFilesForExpense as jest.Mock).mockRejectedValue(
        new Error('S3 is down'),
      );
      (repo.remove as jest.Mock).mockResolvedValue(mockExpense);

      const result = await service.remove(expenseId, userId);

      expect(filesService.deleteFilesForExpense).toHaveBeenCalledWith(expenseId);
      expect(repo.remove).toHaveBeenCalledWith(mockExpense);
      expect(result).toEqual({ deleted: true });
      loggerSpy.mockRestore();
    });

    it('should remove expense normally when it has no files', async () => {
      jest.spyOn(service, 'findOne').mockResolvedValue(mockExpense as Expense);
      (filesService.deleteFilesForExpense as jest.Mock).mockResolvedValue(undefined);
      (repo.remove as jest.Mock).mockResolvedValue(mockExpense);

      const result = await service.remove(expenseId, userId);

      expect(filesService.deleteFilesForExpense).toHaveBeenCalledWith(expenseId);
      expect(repo.remove).toHaveBeenCalledWith(mockExpense);
      expect(result).toEqual({ deleted: true });
    });
  });

  describe('reprocess', () => {
    // Task 4.1: Valid statuses, 403 non-owner, 409 PROCESSING, 429 retry>=3

    it('should reprocess a FAILED expense (S1)', async () => {
      const failedExpense = {
        ...mockExpense,
        status: ExpenseStatus.FAILED,
        retryCount: 0,
        processingStartedAt: null,
      };
      jest
        .spyOn(service, 'findOne')
        .mockResolvedValue(failedExpense as Expense);
      (repo.save as jest.Mock).mockImplementation(async (expense) => expense);

      const result = await service.reprocess(expenseId, userId);

      expect(service.findOne).toHaveBeenCalledWith(expenseId, userId);
      expect(repo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          status: ExpenseStatus.PROCESSING,
          retryCount: 1,
          processingStartedAt: expect.any(Date),
        }),
      );
      expect(result.status).toBe(ExpenseStatus.PROCESSING);
    });

    it('should reprocess a NEEDS_REVIEW expense', async () => {
      const reviewExpense = {
        ...mockExpense,
        status: ExpenseStatus.NEEDS_REVIEW,
        retryCount: 0,
        processingStartedAt: null,
      };
      jest
        .spyOn(service, 'findOne')
        .mockResolvedValue(reviewExpense as Expense);
      (repo.save as jest.Mock).mockImplementation(async (expense) => expense);

      await service.reprocess(expenseId, userId);

      expect(repo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          status: ExpenseStatus.PROCESSING,
          retryCount: 1,
        }),
      );
    });

    it('should reprocess a PROCESSED expense', async () => {
      const processedExpense = {
        ...mockExpense,
        status: ExpenseStatus.PROCESSED,
        retryCount: 0,
        processingStartedAt: null,
      };
      jest
        .spyOn(service, 'findOne')
        .mockResolvedValue(processedExpense as Expense);
      (repo.save as jest.Mock).mockImplementation(async (expense) => expense);

      await service.reprocess(expenseId, userId);

      expect(repo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          status: ExpenseStatus.PROCESSING,
          retryCount: 1,
        }),
      );
    });

    it('should throw 409 when expense is already PROCESSING (S3)', async () => {
      const processingExpense = {
        ...mockExpense,
        status: ExpenseStatus.PROCESSING,
      };
      jest
        .spyOn(service, 'findOne')
        .mockResolvedValue(processingExpense as Expense);

      await expect(service.reprocess(expenseId, userId)).rejects.toThrow(
        ConflictException,
      );
      await expect(service.reprocess(expenseId, userId)).rejects.toThrow(
        'Expense is already being processed',
      );
      expect(repo.save).not.toHaveBeenCalled();
    });

    it('should throw HttpException 429 when retry count >= MAX_RETRIES (S4)', async () => {
      const maxRetriedExpense = {
        ...mockExpense,
        status: ExpenseStatus.FAILED,
        retryCount: 3,
      };
      jest
        .spyOn(service, 'findOne')
        .mockResolvedValue(maxRetriedExpense as Expense);

      await expect(service.reprocess(expenseId, userId)).rejects.toThrow(
        HttpException,
      );
      await expect(service.reprocess(expenseId, userId)).rejects.toMatchObject({
        status: HttpStatus.TOO_MANY_REQUESTS,
        response: 'Maximum retry limit reached',
      });
      expect(repo.save).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException for invalid status (UPLOADED)', async () => {
      const uploadedExpense = {
        ...mockExpense,
        status: ExpenseStatus.UPLOADED,
      };
      jest
        .spyOn(service, 'findOne')
        .mockResolvedValue(uploadedExpense as Expense);

      await expect(service.reprocess(expenseId, userId)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.reprocess(expenseId, userId)).rejects.toThrow(
        'Cannot reprocess expense with status UPLOADED',
      );
      expect(repo.save).not.toHaveBeenCalled();
    });

    // Task 4.2: State transitions - status→PROCESSING, retry_count++, processing_started_at=now

    it('should increment retry_count on reprocess', async () => {
      const failedExpense = {
        ...mockExpense,
        status: ExpenseStatus.FAILED,
        retryCount: 1,
        processingStartedAt: null,
      };
      jest
        .spyOn(service, 'findOne')
        .mockResolvedValue(failedExpense as Expense);
      (repo.save as jest.Mock).mockImplementation(async (expense) => expense);

      const result = await service.reprocess(expenseId, userId);

      expect(result.retryCount).toBe(2);
    });

    it('should set processingStartedAt to current time', async () => {
      const failedExpense = {
        ...mockExpense,
        status: ExpenseStatus.FAILED,
        retryCount: 0,
        processingStartedAt: null,
      };
      jest
        .spyOn(service, 'findOne')
        .mockResolvedValue(failedExpense as Expense);
      (repo.save as jest.Mock).mockImplementation(async (expense) => expense);

      const beforeCall = new Date();
      const result = await service.reprocess(expenseId, userId);
      const afterCall = new Date();

      expect(result.processingStartedAt).toBeInstanceOf(Date);
      expect(result.processingStartedAt!.getTime()).toBeGreaterThanOrEqual(
        beforeCall.getTime(),
      );
      expect(result.processingStartedAt!.getTime()).toBeLessThanOrEqual(
        afterCall.getTime(),
      );
    });

    it('should throw NotFoundException when expense does not exist (S2 via findOne)', async () => {
      jest.spyOn(service, 'findOne').mockImplementation(() => {
        throw new NotFoundException('Expense not found');
      });

      await expect(service.reprocess(expenseId, userId)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw ForbiddenException when caller is not owner (S2)', async () => {
      const otherExpense = { ...mockExpense, userId: 'other-user' };
      jest
        .spyOn(service, 'findOne')
        .mockImplementation(() => {
          throw new ForbiddenException('Not owner');
        });

      await expect(service.reprocess(expenseId, userId)).rejects.toThrow(
        ForbiddenException,
      );
    });

    // Task 4.3: triggerProcessing called after transition (R3)

    it('should call filesService.triggerProcessing after state transition', async () => {
      const failedExpense = {
        ...mockExpense,
        status: ExpenseStatus.FAILED,
        retryCount: 0,
        processingStartedAt: null,
      };
      jest
        .spyOn(service, 'findOne')
        .mockResolvedValue(failedExpense as Expense);
      (repo.save as jest.Mock).mockImplementation(async (expense) => expense);

      await service.reprocess(expenseId, userId);

      expect(filesService.triggerProcessing).toHaveBeenCalledWith(
        expenseId,
        expect.any(String),
      );
    });

    // Task 5.2: reprocess emits expense.status.changed event

    it('should emit expense.status.changed event after reprocess', async () => {
      const failedExpense = {
        ...mockExpense,
        status: ExpenseStatus.FAILED,
        retryCount: 0,
        processingStartedAt: null,
      };
      jest
        .spyOn(service, 'findOne')
        .mockResolvedValue(failedExpense as Expense);
      (repo.save as jest.Mock).mockImplementation(async (expense) => expense);

      await service.reprocess(expenseId, userId);

      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'expense.status.changed',
        expect.objectContaining({
          expenseId,
          status: ExpenseStatus.PROCESSING,
          userId,
          previousStatus: ExpenseStatus.FAILED,
        }),
      );
    });
  });

  describe('getStatusStream', () => {
    // Task 6.1: SSE ownership 403, existence 404
    it('should throw NotFoundException when expense does not exist', (done) => {
      jest.spyOn(service, 'findOne').mockImplementation(() => {
        throw new NotFoundException('Expense not found');
      });

      const stream$ = service.getStatusStream(expenseId, userId);
      stream$.subscribe({
        error: (err) => {
          expect(err).toBeInstanceOf(NotFoundException);
          expect(err.message).toBe('Expense not found');
          done();
        },
      });
    });

    it('should throw ForbiddenException when caller is not owner', (done) => {
      jest.spyOn(service, 'findOne').mockImplementation(() => {
        throw new ForbiddenException('Not owner');
      });

      const stream$ = service.getStatusStream(expenseId, userId);
      stream$.subscribe({
        error: (err) => {
          expect(err).toBeInstanceOf(ForbiddenException);
          done();
        },
      });
    });

    // Task 6.2: SSE observable behavior
    it('should return an observable that emits events for the expense', async () => {
      const expense = {
        ...mockExpense,
        status: ExpenseStatus.PROCESSING,
      };
      jest.spyOn(service, 'findOne').mockResolvedValue(expense as Expense);

      const stream$ = service.getStatusStream(expenseId, userId);
      expect(stream$).toBeDefined();
    });
  });
});
