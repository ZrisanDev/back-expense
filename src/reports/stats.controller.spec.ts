import { Test, TestingModule } from '@nestjs/testing';
import { StreamableFile } from '@nestjs/common';
import { StatsController } from './stats.controller';
import { ReportsService } from './reports.service';

describe('StatsController', () => {
  let controller: StatsController;
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
    topVendors: [{ vendor: 'Amazon', totalSpent: 500 }],
    budgetComparison: [],
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

  const mockCsv =
    'Date,Category,Vendor,Amount,Currency,Status\n2026-04-15,Food,Amazon,50.00,USD,APPROVED';

  beforeEach(async () => {
    const mockService = {
      getSummary: jest.fn(),
      getCategoryBreakdown: jest.fn(),
      getMonthlyTrend: jest.fn(),
      exportCsv: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [StatsController],
      providers: [{ provide: ReportsService, useValue: mockService }],
    }).compile();

    controller = module.get<StatsController>(StatsController);
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
      service.getSummary.mockResolvedValue(mockSummary);

      const result = await controller.getSummary(userId, query);

      expect(service.getSummary).toHaveBeenCalledWith(userId, query);
      expect(result).toEqual(mockSummary);
    });

    it('should call service.getSummary with empty query when no params', async () => {
      service.getSummary.mockResolvedValue(mockSummary);

      const result = await controller.getSummary(userId, {});

      expect(service.getSummary).toHaveBeenCalledWith(userId, {});
      expect(result).toEqual(mockSummary);
    });
  });

  describe('getCategoryBreakdown', () => {
    it('should call service.getCategoryBreakdown with userId and query', async () => {
      const query = { month: 4, year: 2026 };
      service.getCategoryBreakdown.mockResolvedValue(mockCategoryBreakdown);

      const result = await controller.getCategoryBreakdown(userId, query);

      expect(service.getCategoryBreakdown).toHaveBeenCalledWith(userId, query);
      expect(result).toEqual(mockCategoryBreakdown);
    });
  });

  describe('getMonthlyTrend', () => {
    it('should call service.getMonthlyTrend with userId and query', async () => {
      const query = { months: 12 };
      service.getMonthlyTrend.mockResolvedValue(mockTrend);

      const result = await controller.getMonthlyTrend(userId, query);

      expect(service.getMonthlyTrend).toHaveBeenCalledWith(userId, query);
      expect(result).toEqual(mockTrend);
    });
  });

  describe('exportCsv', () => {
    it('should return a StreamableFile with CSV data', async () => {
      service.exportCsv.mockResolvedValue(mockCsv);

      const mockRes = {
        set: jest.fn(),
      } as any;

      const result = await controller.exportCsv(
        userId,
        { month: 4, year: 2026 },
        mockRes,
      );

      expect(service.exportCsv).toHaveBeenCalledWith(userId, {
        month: 4,
        year: 2026,
      });
      expect(mockRes.set).toHaveBeenCalledWith({
        'Content-Type': 'text/csv',
        'Content-Disposition': expect.stringContaining('expenses-2026-04.csv'),
      });
      expect(result).toBeInstanceOf(StreamableFile);
    });

    it('should use current month/year when no query params', async () => {
      service.exportCsv.mockResolvedValue(mockCsv);

      const mockRes = { set: jest.fn() } as any;
      await controller.exportCsv(userId, {}, mockRes);

      const month = now.getMonth() + 1;
      const year = now.getFullYear();
      expect(service.exportCsv).toHaveBeenCalledWith(userId, {});
      expect(mockRes.set).toHaveBeenCalledWith({
        'Content-Type': 'text/csv',
        'Content-Disposition': expect.stringContaining(
          `expenses-${year}-${String(month).padStart(2, '0')}.csv`,
        ),
      });
    });
  });
});
