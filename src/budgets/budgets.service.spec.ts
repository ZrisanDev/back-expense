import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { BudgetsService } from './budgets.service';
import { Budget } from './entities/budget.entity';
import { Expense } from '../expenses/entities/expense.entity';
import { User } from '../users/entities/user.entity';
import { Category } from '../categories/entities/category.entity';

describe('BudgetsService', () => {
  let service: BudgetsService;
  let budgetRepo: jest.Mocked<Repository<Budget>>;
  let expenseRepo: jest.Mocked<Repository<Expense>>;

  const userId = 'user-123';
  const categoryId = 'cat-456';
  const budgetId = 'budget-789';
  const month = 4;
  const year = 2026;

  const mockCategory: Category = {
    id: categoryId,
    name: 'Food',
    icon: '🍔',
    isDefault: false,
    userId,
    user: {} as User,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockBudget: Budget = {
    id: budgetId,
    userId,
    categoryId,
    category: mockCategory,
    month,
    year,
    limit: 500,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockExpenseQueryBuilder: any = {
    select: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    getRawOne: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BudgetsService,
        {
          provide: getRepositoryToken(Budget),
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
            findOne: jest.fn(),
            find: jest.fn(),
            remove: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(Expense),
          useValue: {
            createQueryBuilder: jest.fn(() => mockExpenseQueryBuilder),
          },
        },
      ],
    }).compile();

    service = module.get<BudgetsService>(BudgetsService);
    budgetRepo = module.get(getRepositoryToken(Budget));
    expenseRepo = module.get(getRepositoryToken(Expense));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create and save a budget with userId', async () => {
      const dto = { categoryId, month, year, limit: 500 };
      (budgetRepo.create as jest.Mock).mockReturnValue({ ...dto, userId });
      (budgetRepo.save as jest.Mock).mockResolvedValue(mockBudget);

      const result = await service.create(userId, dto);

      expect(budgetRepo.create).toHaveBeenCalledWith({ ...dto, userId });
      expect(budgetRepo.save).toHaveBeenCalledWith({ ...dto, userId });
      expect(result).toEqual(mockBudget);
    });
  });

  describe('findAll', () => {
    it('should return budgets with utilization data', async () => {
      const query = { month, year };
      (budgetRepo.find as jest.Mock).mockResolvedValue([mockBudget]);
      mockExpenseQueryBuilder.getRawOne.mockResolvedValue({ total: '200.50' });

      const result = await service.findAll(userId, query);

      expect(budgetRepo.find).toHaveBeenCalledWith({
        where: { userId, month, year },
        relations: ['category'],
      });
      expect(expenseRepo.createQueryBuilder).toHaveBeenCalledWith('expense');
      expect(result).toHaveLength(1);
      expect(result[0].spent).toBe(200.5);
      expect(result[0].remaining).toBe(299.5);
      expect(result[0].percentage).toBe(40.1);
    });

    it('should return zero spent when no expenses exist', async () => {
      const query = { month, year };
      (budgetRepo.find as jest.Mock).mockResolvedValue([mockBudget]);
      mockExpenseQueryBuilder.getRawOne.mockResolvedValue({ total: null });

      const result = await service.findAll(userId, query);

      expect(result[0].spent).toBe(0);
      expect(result[0].remaining).toBe(500);
      expect(result[0].percentage).toBe(0);
    });

    it('should return empty array when no budgets exist', async () => {
      const query = { month, year };
      (budgetRepo.find as jest.Mock).mockResolvedValue([]);

      const result = await service.findAll(userId, query);

      expect(result).toEqual([]);
      expect(expenseRepo.createQueryBuilder).not.toHaveBeenCalled();
    });
  });

  describe('findOne', () => {
    it('should return a budget with utilization', async () => {
      (budgetRepo.findOne as jest.Mock).mockResolvedValue(mockBudget);
      mockExpenseQueryBuilder.getRawOne.mockResolvedValue({ total: '150' });

      const result = await service.findOne(budgetId, userId);

      expect(budgetRepo.findOne).toHaveBeenCalledWith({
        where: { id: budgetId, userId },
        relations: ['category'],
      });
      expect(result.spent).toBe(150);
      expect(result.remaining).toBe(350);
    });

    it('should throw NotFoundException when budget not found', async () => {
      (budgetRepo.findOne as jest.Mock).mockResolvedValue(null);

      await expect(service.findOne('nonexistent', userId)).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.findOne('nonexistent', userId)).rejects.toThrow(
        'Budget not found',
      );
    });

    it('should handle 100% budget utilization', async () => {
      (budgetRepo.findOne as jest.Mock).mockResolvedValue(mockBudget);
      mockExpenseQueryBuilder.getRawOne.mockResolvedValue({ total: '500' });

      const result = await service.findOne(budgetId, userId);

      expect(result.spent).toBe(500);
      expect(result.remaining).toBe(0);
      expect(result.percentage).toBe(100);
    });

    it('should handle over-budget (spent exceeds limit)', async () => {
      (budgetRepo.findOne as jest.Mock).mockResolvedValue(mockBudget);
      mockExpenseQueryBuilder.getRawOne.mockResolvedValue({ total: '600' });

      const result = await service.findOne(budgetId, userId);

      expect(result.spent).toBe(600);
      expect(result.remaining).toBe(-100);
      expect(result.percentage).toBe(120);
    });
  });

  describe('update', () => {
    it('should update budget and return with utilization', async () => {
      jest.spyOn(service, 'findOne').mockResolvedValue({
        ...mockBudget,
        spent: 0,
        remaining: 500,
        percentage: 0,
      });
      const updatedBudget = { ...mockBudget, limit: 750 };
      (budgetRepo.save as jest.Mock).mockResolvedValue(updatedBudget);
      mockExpenseQueryBuilder.getRawOne.mockResolvedValue({ total: '0' });

      const result = await service.update(budgetId, userId, { limit: 750 });

      expect(service.findOne).toHaveBeenCalledWith(budgetId, userId);
      expect(budgetRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ limit: 750 }),
      );
    });

    it('should throw NotFoundException when updating non-existent budget', async () => {
      jest.spyOn(service, 'findOne').mockImplementation(() => {
        throw new NotFoundException('Budget not found');
      });

      await expect(
        service.update('nonexistent', userId, { limit: 100 }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('should remove a budget and return { deleted: true }', async () => {
      const enrichedBudget = {
        ...mockBudget,
        spent: 0,
        remaining: 500,
        percentage: 0,
      };
      jest.spyOn(service, 'findOne').mockResolvedValue(enrichedBudget);
      (budgetRepo.remove as jest.Mock).mockResolvedValue(enrichedBudget);

      const result = await service.remove(budgetId, userId);

      expect(service.findOne).toHaveBeenCalledWith(budgetId, userId);
      expect(budgetRepo.remove).toHaveBeenCalledWith(enrichedBudget);
      expect(result).toEqual({ deleted: true });
    });

    it('should throw NotFoundException when removing non-existent budget', async () => {
      jest.spyOn(service, 'findOne').mockImplementation(() => {
        throw new NotFoundException('Budget not found');
      });

      await expect(service.remove('nonexistent', userId)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('calculateSpent (via findOne integration)', () => {
    it('should query expenses with correct category, month, and year', async () => {
      (budgetRepo.findOne as jest.Mock).mockResolvedValue(mockBudget);
      mockExpenseQueryBuilder.getRawOne.mockResolvedValue({ total: '300' });

      await service.findOne(budgetId, userId);

      expect(expenseRepo.createQueryBuilder).toHaveBeenCalledWith('expense');
      expect(mockExpenseQueryBuilder.select).toHaveBeenCalledWith(
        'COALESCE(SUM(expense.amount), 0)',
        'total',
      );
      expect(mockExpenseQueryBuilder.where).toHaveBeenCalledWith(
        'expense.categoryId = :categoryId',
        { categoryId },
      );
      expect(mockExpenseQueryBuilder.andWhere).toHaveBeenNthCalledWith(
        1,
        'EXTRACT(MONTH FROM expense.date) = :month',
        { month },
      );
      expect(mockExpenseQueryBuilder.andWhere).toHaveBeenNthCalledWith(
        2,
        'EXTRACT(YEAR FROM expense.date) = :year',
        { year },
      );
    });
  });
});
