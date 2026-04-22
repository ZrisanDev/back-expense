import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { BudgetsController } from './budgets.controller';
import { BudgetsService } from './budgets.service';

describe('BudgetsController', () => {
  let controller: BudgetsController;
  let service: jest.Mocked<BudgetsService>;

  const userId = 'user-123';
  const budgetId = 'budget-789';

  const mockBudget = {
    id: budgetId,
    userId,
    categoryId: 'cat-456',
    category: { id: 'cat-456', name: 'Food', icon: '🍔' },
    month: 4,
    year: 2026,
    limit: 500,
    spent: 200,
    remaining: 300,
    percentage: 40,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    const mockService = {
      create: jest.fn(),
      findAll: jest.fn(),
      findOne: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [BudgetsController],
      providers: [{ provide: BudgetsService, useValue: mockService }],
    }).compile();

    controller = module.get<BudgetsController>(BudgetsController);
    service = module.get(BudgetsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('create', () => {
    it('should call service.create with userId and dto', async () => {
      const dto = { categoryId: 'cat-456', month: 4, year: 2026, limit: 500 };
      service.create.mockResolvedValue(mockBudget as any);

      const result = await controller.create(userId, dto);

      expect(service.create).toHaveBeenCalledWith(userId, dto);
      expect(result).toEqual(mockBudget);
    });
  });

  describe('findAll', () => {
    it('should call service.findAll with userId and query', async () => {
      const query = { month: 4, year: 2026 };
      const budgetsList = [mockBudget];
      service.findAll.mockResolvedValue(budgetsList as any);

      const result = await controller.findAll(userId, query);

      expect(service.findAll).toHaveBeenCalledWith(userId, query);
      expect(result).toEqual(budgetsList);
    });
  });

  describe('findOne', () => {
    it('should call service.findOne with id and userId', async () => {
      service.findOne.mockResolvedValue(mockBudget as any);

      const result = await controller.findOne(userId, budgetId);

      expect(service.findOne).toHaveBeenCalledWith(budgetId, userId);
      expect(result).toEqual(mockBudget);
    });

    it('should propagate NotFoundException from service', async () => {
      service.findOne.mockRejectedValue(
        new NotFoundException('Budget not found'),
      );

      await expect(
        controller.findOne(userId, 'nonexistent-id'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('should call service.update with id, userId, and dto', async () => {
      const dto = { limit: 750 };
      const updated = { ...mockBudget, limit: 750 };
      service.update.mockResolvedValue(updated as any);

      const result = await controller.update(userId, budgetId, dto);

      expect(service.update).toHaveBeenCalledWith(budgetId, userId, dto);
      expect(result).toEqual(updated);
    });

    it('should propagate NotFoundException from service', async () => {
      service.update.mockRejectedValue(
        new NotFoundException('Budget not found'),
      );

      await expect(
        controller.update(userId, 'nonexistent-id', { limit: 100 } as any),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('should call service.remove with id and userId', async () => {
      service.remove.mockResolvedValue({ deleted: true });

      const result = await controller.remove(userId, budgetId);

      expect(service.remove).toHaveBeenCalledWith(budgetId, userId);
      expect(result).toEqual({ deleted: true });
    });

    it('should propagate NotFoundException from service', async () => {
      service.remove.mockRejectedValue(
        new NotFoundException('Budget not found'),
      );

      await expect(controller.remove(userId, 'nonexistent-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
