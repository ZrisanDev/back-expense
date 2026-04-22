import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ReportsService } from './reports.service';
import { Expense } from '../expenses/entities/expense.entity';
import { Budget } from '../budgets/entities/budget.entity';
import { Category } from '../categories/entities/category.entity';

describe('ReportsService', () => {
  let service: ReportsService;
  let expenseRepo: jest.Mocked<Repository<Expense>>;
  let budgetRepo: jest.Mocked<Repository<Budget>>;
  let categoryRepo: jest.Mocked<Repository<Category>>;

  const userId = 'user-123';
  const categoryId = 'cat-456';
  const categoryId2 = 'cat-789';
  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();

  const mockQueryBuilder = {
    select: jest.fn().mockReturnThis(),
    addSelect: jest.fn().mockReturnThis(),
    leftJoin: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    groupBy: jest.fn().mockReturnThis(),
    addGroupBy: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    getRawOne: jest.fn(),
    getRawMany: jest.fn(),
  };

  const createQueryBuilder = jest.fn(() => mockQueryBuilder);

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReportsService,
        {
          provide: getRepositoryToken(Expense),
          useValue: {
            createQueryBuilder,
            manager: { query: jest.fn() },
          },
        },
        {
          provide: getRepositoryToken(Budget),
          useValue: {
            find: jest.fn().mockResolvedValue([]),
          },
        },
        {
          provide: getRepositoryToken(Category),
          useValue: {
            find: jest.fn().mockResolvedValue([]),
          },
        },
      ],
    }).compile();

    service = module.get<ReportsService>(ReportsService);
    expenseRepo = module.get(getRepositoryToken(Expense));
    budgetRepo = module.get(getRepositoryToken(Budget));
    categoryRepo = module.get(getRepositoryToken(Category));
  });

  afterEach(() => {
    jest.clearAllMocks();
    // Re-establish chainable mock for all chain methods
    const chainMethods = [
      'select',
      'addSelect',
      'leftJoin',
      'where',
      'andWhere',
      'groupBy',
      'addGroupBy',
      'orderBy',
      'limit',
    ];
    chainMethods.forEach((key) => {
      mockQueryBuilder[key].mockReturnValue(mockQueryBuilder);
    });
    createQueryBuilder.mockReturnValue(mockQueryBuilder);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ─── getSummary ─────────────────────────────────────────────

  describe('getSummary', () => {
    const query = {};

    it('should return zeros when no expenses exist', async () => {
      // totalSpent + transactionCount query
      mockQueryBuilder.getRawOne.mockResolvedValueOnce({
        total: '0',
        count: '0',
      });
      // category breakdown query
      mockQueryBuilder.getRawMany.mockResolvedValueOnce([]);
      // top vendors query
      mockQueryBuilder.getRawMany.mockResolvedValueOnce([]);

      const result = await service.getSummary(userId, query);

      expect(result.totalSpent).toBe(0);
      expect(result.transactionCount).toBe(0);
      expect(result.categoryBreakdown).toEqual([]);
      expect(result.topVendors).toEqual([]);
      expect(result.budgetComparison).toEqual([]);
    });

    it('should return full summary with data', async () => {
      // totalSpent + transactionCount
      mockQueryBuilder.getRawOne.mockResolvedValueOnce({
        total: '1500.50',
        count: '25',
      });
      // category breakdown
      mockQueryBuilder.getRawMany.mockResolvedValueOnce([
        {
          categoryId,
          categoryName: 'Food',
          categoryIcon: '🍔',
          total: '800.50',
        },
        {
          categoryId: categoryId2,
          categoryName: 'Transport',
          categoryIcon: '🚗',
          total: '700',
        },
      ]);
      // top vendors
      mockQueryBuilder.getRawMany.mockResolvedValueOnce([
        { vendor: 'Amazon', total: '500' },
        { vendor: 'Uber', total: '300' },
      ]);
      // budget comparison
      (budgetRepo.find as jest.Mock).mockResolvedValue([
        {
          id: 'budget-1',
          categoryId,
          category: { id: categoryId, name: 'Food', icon: '🍔' },
          month: currentMonth,
          year: currentYear,
          limit: 1000,
        },
      ]);
      mockQueryBuilder.getRawOne.mockResolvedValueOnce({ total: '800.50' });

      const result = await service.getSummary(userId, query);

      expect(result.totalSpent).toBe(1500.5);
      expect(result.transactionCount).toBe(25);
      expect(result.categoryBreakdown).toHaveLength(2);
      expect(result.categoryBreakdown[0].percentage).toBeCloseTo(53.35);
      expect(result.topVendors).toHaveLength(2);
      expect(result.topVendors[0].vendor).toBe('Amazon');
      expect(result.budgetComparison).toHaveLength(1);
      expect(result.budgetComparison[0].spent).toBe(800.5);
      expect(result.budgetComparison[0].remaining).toBe(199.5);
    });

    it('should use provided month/year when specified', async () => {
      mockQueryBuilder.getRawOne.mockResolvedValueOnce({
        total: '0',
        count: '0',
      });
      mockQueryBuilder.getRawMany.mockResolvedValueOnce([]);
      mockQueryBuilder.getRawMany.mockResolvedValueOnce([]);

      await service.getSummary(userId, { month: 6, year: 2025 });

      // Verify EXTRACT calls include the correct month/year
      const andWhereCalls = mockQueryBuilder.andWhere.mock.calls;
      const hasMonth = andWhereCalls.some(
        (call) =>
          typeof call[0] === 'string' &&
          call[0].includes('EXTRACT(MONTH') &&
          call[1]?.month === 6,
      );
      const hasYear = andWhereCalls.some(
        (call) =>
          typeof call[0] === 'string' &&
          call[0].includes('EXTRACT(YEAR') &&
          call[1]?.year === 2025,
      );
      expect(hasMonth).toBe(true);
      expect(hasYear).toBe(true);
    });

    it('should handle budgets with no matching expenses', async () => {
      mockQueryBuilder.getRawOne.mockResolvedValueOnce({
        total: '0',
        count: '0',
      });
      mockQueryBuilder.getRawMany.mockResolvedValueOnce([]);
      mockQueryBuilder.getRawMany.mockResolvedValueOnce([]);

      (budgetRepo.find as jest.Mock).mockResolvedValue([
        {
          id: 'budget-1',
          categoryId,
          category: { id: categoryId, name: 'Food', icon: '🍔' },
          month: currentMonth,
          year: currentYear,
          limit: 500,
        },
      ]);
      mockQueryBuilder.getRawOne.mockResolvedValueOnce({ total: null });

      const result = await service.getSummary(userId, query);

      expect(result.budgetComparison).toHaveLength(1);
      expect(result.budgetComparison[0].spent).toBe(0);
      expect(result.budgetComparison[0].remaining).toBe(500);
      expect(result.budgetComparison[0].percentage).toBe(0);
    });

    it('should handle null category in expenses for category breakdown', async () => {
      mockQueryBuilder.getRawOne.mockResolvedValueOnce({
        total: '100',
        count: '1',
      });
      mockQueryBuilder.getRawMany.mockResolvedValueOnce([
        {
          categoryId: null,
          categoryName: 'Uncategorized',
          categoryIcon: null,
          total: '100',
        },
      ]);
      mockQueryBuilder.getRawMany.mockResolvedValueOnce([]);

      const result = await service.getSummary(userId, query);

      expect(result.categoryBreakdown).toHaveLength(1);
      expect(result.categoryBreakdown[0].categoryId).toBeNull();
      expect(result.categoryBreakdown[0].categoryName).toBe('Uncategorized');
      expect(result.categoryBreakdown[0].percentage).toBe(100);
    });
  });

  // ─── getCategoryBreakdown ──────────────────────────────────

  describe('getCategoryBreakdown', () => {
    const query = {};

    it('should return empty array when no expenses exist', async () => {
      mockQueryBuilder.getRawMany.mockResolvedValueOnce([]);

      const result = await service.getCategoryBreakdown(userId, query);

      expect(result).toEqual([]);
    });

    it('should return per-category spending with budget data', async () => {
      mockQueryBuilder.getRawMany.mockResolvedValueOnce([
        {
          categoryId,
          categoryName: 'Food',
          categoryIcon: '🍔',
          total: '800',
        },
        {
          categoryId: categoryId2,
          categoryName: 'Transport',
          categoryIcon: '🚗',
          total: '200',
        },
      ]);
      (budgetRepo.find as jest.Mock).mockResolvedValue([
        {
          id: 'budget-1',
          categoryId,
          category: { id: categoryId, name: 'Food' },
          month: currentMonth,
          year: currentYear,
          limit: 1000,
        },
      ]);

      const result = await service.getCategoryBreakdown(userId, query);

      expect(result).toHaveLength(2);
      expect(result[0].categoryId).toBe(categoryId);
      expect(result[0].totalSpent).toBe(800);
      expect(result[0].percentageOfTotal).toBe(80);
      expect(result[0].budgetLimit).toBe(1000);
      expect(result[0].budgetUtilization).toBe(80);
      expect(result[1].budgetLimit).toBeNull();
      expect(result[1].budgetUtilization).toBeNull();
    });

    it('should order results by totalSpent DESC', async () => {
      mockQueryBuilder.getRawMany.mockResolvedValueOnce([
        {
          categoryId: 'cat-2',
          categoryName: 'B',
          categoryIcon: null,
          total: '500',
        },
        {
          categoryId: 'cat-1',
          categoryName: 'A',
          categoryIcon: null,
          total: '100',
        },
        {
          categoryId: 'cat-3',
          categoryName: 'C',
          categoryIcon: null,
          total: '50',
        },
      ]);
      (budgetRepo.find as jest.Mock).mockResolvedValue([]);

      const result = await service.getCategoryBreakdown(userId, query);

      expect(result[0].totalSpent).toBe(500);
      expect(result[1].totalSpent).toBe(100);
      expect(result[2].totalSpent).toBe(50);
    });

    it('should calculate percentages correctly', async () => {
      mockQueryBuilder.getRawMany.mockResolvedValueOnce([
        {
          categoryId: 'cat-1',
          categoryName: 'A',
          categoryIcon: null,
          total: '333.33',
        },
        {
          categoryId: 'cat-2',
          categoryName: 'B',
          categoryIcon: null,
          total: '666.67',
        },
      ]);
      (budgetRepo.find as jest.Mock).mockResolvedValue([]);

      const result = await service.getCategoryBreakdown(userId, query);

      expect(result[0].percentageOfTotal).toBeCloseTo(33.33, 1);
      expect(result[1].percentageOfTotal).toBeCloseTo(66.67, 1);
    });
  });

  // ─── getMonthlyTrend ───────────────────────────────────────

  describe('getMonthlyTrend', () => {
    it('should return trend with zeros when no expenses exist', async () => {
      mockQueryBuilder.getRawMany.mockResolvedValueOnce([]);

      const result = await service.getMonthlyTrend(userId, {});

      expect(result).toHaveLength(6);
      expect(result[0].totalSpent).toBe(0);
      expect(result[0].changeFromPreviousMonth).toBeNull();
      expect(result[0].changePercentage).toBeNull();
    });

    it('should return monthly spending data with MoM change', async () => {
      // Use months=3 for simplicity and set up data for consecutive months
      const twoMonthsAgo = new Date();
      twoMonthsAgo.setMonth(twoMonthsAgo.getMonth() - 2);
      const oneMonthAgo = new Date();
      oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
      const current = new Date();

      mockQueryBuilder.getRawMany.mockResolvedValueOnce([
        {
          month: twoMonthsAgo.getMonth() + 1,
          year: twoMonthsAgo.getFullYear(),
          total: '500',
        },
        {
          month: oneMonthAgo.getMonth() + 1,
          year: oneMonthAgo.getFullYear(),
          total: '750',
        },
        {
          month: current.getMonth() + 1,
          year: current.getFullYear(),
          total: '600',
        },
      ]);

      const result = await service.getMonthlyTrend(userId, { months: 3 });

      expect(result).toHaveLength(3);

      // First data month should have null change
      expect(result[0].totalSpent).toBe(500);
      expect(result[0].changeFromPreviousMonth).toBeNull();
      expect(result[0].changePercentage).toBeNull();

      // Second data month should have MoM change (+50%)
      expect(result[1].totalSpent).toBe(750);
      expect(result[1].changeFromPreviousMonth).toBe(250);
      expect(result[1].changePercentage).toBe(50);

      // Third data month: 750->600 = -20%
      expect(result[2].totalSpent).toBe(600);
      expect(result[2].changeFromPreviousMonth).toBe(-150);
      expect(result[2].changePercentage).toBe(-20);
    });

    it('should respect custom months parameter', async () => {
      mockQueryBuilder.getRawMany.mockResolvedValueOnce([]);

      const result = await service.getMonthlyTrend(userId, { months: 3 });

      expect(result).toHaveLength(3);
    });

    it('should handle month-over-month decrease', async () => {
      const oneMonthAgo = new Date();
      oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);

      mockQueryBuilder.getRawMany.mockResolvedValueOnce([
        {
          month: oneMonthAgo.getMonth() + 1,
          year: oneMonthAgo.getFullYear(),
          total: '1000',
        },
        {
          month: currentMonth,
          year: currentYear,
          total: '800',
        },
      ]);

      const result = await service.getMonthlyTrend(userId, { months: 2 });

      expect(result[0].totalSpent).toBe(1000);
      expect(result[1].totalSpent).toBe(800);
      expect(result[1].changeFromPreviousMonth).toBe(-200);
      expect(result[1].changePercentage).toBe(-20);
    });

    it('should handle zero spending in previous month (avoid division by zero)', async () => {
      const oneMonthAgo = new Date();
      oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);

      mockQueryBuilder.getRawMany.mockResolvedValueOnce([
        {
          month: oneMonthAgo.getMonth() + 1,
          year: oneMonthAgo.getFullYear(),
          total: '0',
        },
        {
          month: currentMonth,
          year: currentYear,
          total: '500',
        },
      ]);

      const result = await service.getMonthlyTrend(userId, { months: 2 });

      expect(result[0].totalSpent).toBe(0);
      expect(result[1].totalSpent).toBe(500);
      expect(result[1].changeFromPreviousMonth).toBe(500);
      expect(result[1].changePercentage).toBeNull(); // Can't calculate % from 0
    });

    it('should return chronologically ordered data', async () => {
      mockQueryBuilder.getRawMany.mockResolvedValueOnce([]);

      const result = await service.getMonthlyTrend(userId, { months: 6 });

      // Verify chronological order
      for (let i = 1; i < result.length; i++) {
        const prevDate = new Date(result[i - 1].year, result[i - 1].month - 1);
        const currDate = new Date(result[i].year, result[i].month - 1);
        expect(currDate.getTime()).toBeGreaterThan(prevDate.getTime());
      }
    });
  });

  // ─── exportCsv ──────────────────────────────────────────────

  describe('exportCsv', () => {
    it('should return CSV with headers when no expenses exist', async () => {
      mockQueryBuilder.getRawMany.mockResolvedValueOnce([]);

      const result = await service.exportCsv(userId, {});

      expect(result).toContain('Date,Category,Vendor,Amount,Currency,Status');
    });

    it('should return CSV rows for expenses', async () => {
      mockQueryBuilder.getRawMany.mockResolvedValueOnce([
        {
          id: 'exp-1',
          amount: '50.5',
          currency: 'USD',
          category: 'Food',
          vendor: 'Amazon',
          date: '2026-04-15',
          status: 'APPROVED',
        },
        {
          id: 'exp-2',
          amount: '25',
          currency: 'USD',
          category: 'Transport',
          vendor: 'Uber',
          date: '2026-04-16',
          status: 'APPROVED',
        },
      ]);

      const result = await service.exportCsv(userId, { month: 4, year: 2026 });

      const lines = result.split('\n');
      expect(lines).toHaveLength(3); // 1 header + 2 data rows
      expect(lines[0]).toBe('Date,Category,Vendor,Amount,Currency,Status');
      expect(lines[1]).toContain('Food');
      expect(lines[1]).toContain('50.50');
      expect(lines[2]).toContain('Transport');
    });

    it('should handle null vendor in CSV output', async () => {
      mockQueryBuilder.getRawMany.mockResolvedValueOnce([
        {
          id: 'exp-1',
          amount: '10',
          currency: 'USD',
          category: 'Food',
          vendor: null,
          date: '2026-04-15',
          status: 'APPROVED',
        },
      ]);

      const result = await service.exportCsv(userId, {});

      expect(result).toContain('Food');
      expect(result).toContain('10.00');
    });

    it('should escape CSV values with commas', async () => {
      mockQueryBuilder.getRawMany.mockResolvedValueOnce([
        {
          id: 'exp-1',
          amount: '10',
          currency: 'USD',
          category: 'Food, Drinks',
          vendor: 'Store',
          date: '2026-04-15',
          status: 'APPROVED',
        },
      ]);

      const result = await service.exportCsv(userId, {});

      expect(result).toContain('"Food, Drinks"');
    });
  });
});
