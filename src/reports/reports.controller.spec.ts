import { Test, TestingModule } from '@nestjs/testing';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';

describe('ReportsController', () => {
  let controller: ReportsController;
  let service: jest.Mocked<ReportsService>;

  const userId = 'user-123';
  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();

  const mockSummary = {
    totalSpent: 1500,
    transactionCount: 20,
    categoryBreakdown: [
      {
        categoryId: 'cat-1',
        categoryName: 'Food',
        categoryIcon: '🍔',
        totalSpent: 1000,
        percentage: 66.67,
      },
    ],
    topVendors: [
      { vendor: 'Amazon', totalSpent: 500 },
    ],
    budgetComparison: [
      {
        categoryId: 'cat-1',
        categoryName: 'Food',
        budgetLimit: 1200,
        spent: 1000,
        remaining: 200,
        percentage: 83.33,
      },
    ],
  };

  const mockCategoryBreakdown = [
    {
      categoryId: 'cat-1',
      categoryName: 'Food',
      categoryIcon: '🍔',
      totalSpent: 1000,
      percentageOfTotal: 66.67,
      budgetLimit: 1200,
      budgetUtilization: 83.33,
    },
  ];

  const mockTrend = [
    {
      month: currentMonth,
      year: currentYear,
      label: `${currentMonth}/${currentYear}`,
      totalSpent: 1500,
      changeFromPreviousMonth: null,
      changePercentage: null,
    },
  ];

  beforeEach(async () => {
    const mockService = {
      getSummary: jest.fn(),
      getCategoryBreakdown: jest.fn(),
      getMonthlyTrend: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ReportsController],
      providers: [{ provide: ReportsService, useValue: mockService }],
    }).compile();

    controller = module.get<ReportsController>(ReportsController);
    service = module.get(ReportsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getSummary', () => {
    it('should call service.getSummary with userId and query', async () => {
      const query = { month: 4, year: 2026 };
      service.getSummary.mockResolvedValue(mockSummary as any);

      const result = await controller.getSummary(userId, query as any);

      expect(service.getSummary).toHaveBeenCalledWith(userId, query);
      expect(result).toEqual(mockSummary);
    });

    it('should call service.getSummary with empty query when no params', async () => {
      service.getSummary.mockResolvedValue(mockSummary as any);

      const result = await controller.getSummary(userId, {} as any);

      expect(service.getSummary).toHaveBeenCalledWith(userId, {});
      expect(result).toEqual(mockSummary);
    });
  });

  describe('getCategoryBreakdown', () => {
    it('should call service.getCategoryBreakdown with userId and query', async () => {
      const query = { month: 4, year: 2026 };
      service.getCategoryBreakdown.mockResolvedValue(mockCategoryBreakdown as any);

      const result = await controller.getCategoryBreakdown(userId, query as any);

      expect(service.getCategoryBreakdown).toHaveBeenCalledWith(userId, query);
      expect(result).toEqual(mockCategoryBreakdown);
    });

    it('should call service.getCategoryBreakdown with empty query when no params', async () => {
      service.getCategoryBreakdown.mockResolvedValue(mockCategoryBreakdown as any);

      await controller.getCategoryBreakdown(userId, {} as any);

      expect(service.getCategoryBreakdown).toHaveBeenCalledWith(userId, {});
    });
  });

  describe('getMonthlyTrend', () => {
    it('should call service.getMonthlyTrend with userId and query', async () => {
      const query = { months: 12 };
      service.getMonthlyTrend.mockResolvedValue(mockTrend as any);

      const result = await controller.getMonthlyTrend(userId, query as any);

      expect(service.getMonthlyTrend).toHaveBeenCalledWith(userId, query);
      expect(result).toEqual(mockTrend);
    });

    it('should call service.getMonthlyTrend with empty query when no params', async () => {
      service.getMonthlyTrend.mockResolvedValue(mockTrend as any);

      await controller.getMonthlyTrend(userId, {} as any);

      expect(service.getMonthlyTrend).toHaveBeenCalledWith(userId, {});
    });
  });
});
