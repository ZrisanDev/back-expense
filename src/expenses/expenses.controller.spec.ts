import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { ExpensesController } from './expenses.controller';
import { ExpensesService } from './expenses.service';

describe('ExpensesController', () => {
  let controller: ExpensesController;
  let service: jest.Mocked<ExpensesService>;

  const userId = 'user-123';
  const expenseId = 'exp-456';

  const mockExpense = {
    id: expenseId,
    userId,
    amount: 50.0,
    currency: 'USD',
    categoryId: 'cat-789',
    vendor: 'Coffee Shop',
    date: '2024-01-15',
    status: 'NEEDS_REVIEW',
    isDuplicateSuspect: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    const mockService = {
      create: jest.fn(),
      findAll: jest.fn(),
      findOne: jest.fn(),
      update: jest.fn(),
      approve: jest.fn(),
      remove: jest.fn(),
      reprocess: jest.fn(),
      getStatusStream: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ExpensesController],
      providers: [{ provide: ExpensesService, useValue: mockService }],
    }).compile();

    controller = module.get<ExpensesController>(ExpensesController);
    service = module.get(ExpensesService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('create', () => {
    it('should call service.create with userId and dto', async () => {
      const dto = { amount: 50.0, vendor: 'Coffee Shop', date: '2024-01-15' };
      const result = {
        ...mockExpense,
        duplicateWarning: null,
      };
      service.create.mockResolvedValue(result as any);

      const response = await controller.create(userId, dto as any);

      expect(service.create).toHaveBeenCalledWith(userId, dto);
      expect(response).toEqual(result);
    });
  });

  describe('findAll', () => {
    it('should call service.findAll with userId and query', async () => {
      const query = { page: 1, limit: 20 };
      const paginatedResult = {
        items: [mockExpense],
        total: 1,
        page: 1,
        limit: 20,
        totalPages: 1,
      };
      service.findAll.mockResolvedValue(paginatedResult as any);

      const result = await controller.findAll(userId, query);

      expect(service.findAll).toHaveBeenCalledWith(userId, query);
      expect(result).toEqual(paginatedResult);
    });
  });

  describe('findOne', () => {
    it('should call service.findOne with id and userId', async () => {
      service.findOne.mockResolvedValue(mockExpense as any);

      const result = await controller.findOne(userId, expenseId);

      expect(service.findOne).toHaveBeenCalledWith(expenseId, userId);
      expect(result).toEqual(mockExpense);
    });

    it('should propagate NotFoundException from service', async () => {
      service.findOne.mockRejectedValue(
        new NotFoundException('Expense not found'),
      );

      await expect(
        controller.findOne(userId, 'nonexistent-id'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('should call service.update with id, userId, and dto', async () => {
      const dto = { amount: 75.0 };
      const updated = { ...mockExpense, amount: 75.0 };
      service.update.mockResolvedValue(updated as any);

      const result = await controller.update(userId, expenseId, dto);

      expect(service.update).toHaveBeenCalledWith(expenseId, userId, dto);
      expect(result).toEqual(updated);
    });
  });

  describe('approve', () => {
    it('should call service.approve with id and userId', async () => {
      const approved = { ...mockExpense, status: 'APPROVED' };
      service.approve.mockResolvedValue(approved as any);

      const result = await controller.approve(userId, expenseId);

      expect(service.approve).toHaveBeenCalledWith(expenseId, userId);
      expect(result).toEqual(approved);
    });
  });

  describe('remove', () => {
    it('should call service.remove with id and userId', async () => {
      service.remove.mockResolvedValue({ deleted: true });

      const result = await controller.remove(userId, expenseId);

      expect(service.remove).toHaveBeenCalledWith(expenseId, userId);
      expect(result).toEqual({ deleted: true });
    });

    it('should propagate NotFoundException from service', async () => {
      service.remove.mockRejectedValue(
        new NotFoundException('Expense not found'),
      );

      await expect(controller.remove(userId, 'nonexistent-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('reprocess', () => {
    it('should call service.reprocess with id and userId', async () => {
      const reprocessed = { ...mockExpense, status: 'PROCESSING' };
      service.reprocess.mockResolvedValue(reprocessed as any);

      const result = await controller.reprocess(userId, expenseId);

      expect(service.reprocess).toHaveBeenCalledWith(expenseId, userId);
      expect(result).toEqual(reprocessed);
    });
  });

  describe('statusStream', () => {
    it('should call service.getStatusStream with id and userId', () => {
      const mockObservable = { subscribe: jest.fn() };
      service.getStatusStream.mockReturnValue(mockObservable as any);

      const result = controller.statusStream(userId, expenseId);

      expect(service.getStatusStream).toHaveBeenCalledWith(expenseId, userId);
      expect(result).toBe(mockObservable);
    });
  });
});
