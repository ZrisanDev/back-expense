import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Expense } from '../expenses/entities/expense.entity';
import { Budget } from '../budgets/entities/budget.entity';
import { Category } from '../categories/entities/category.entity';
import { SummaryQueryDto } from './dto/summary-query.dto';
import { CategoryBreakdownQueryDto } from './dto/category-breakdown-query.dto';
import { TrendQueryDto } from './dto/trend-query.dto';

@Injectable()
export class ReportsService {
  constructor(
    @InjectRepository(Expense)
    private readonly expenseRepository: Repository<Expense>,
    @InjectRepository(Budget)
    private readonly budgetRepository: Repository<Budget>,
    @InjectRepository(Category)
    private readonly categoryRepository: Repository<Category>,
  ) {}

  async getSummary(userId: string, query: SummaryQueryDto) {
    const month = query.month ?? new Date().getMonth() + 1;
    const year = query.year ?? new Date().getFullYear();

    // 1. Total spent + transaction count
    const totalsResult = await this.expenseRepository
      .createQueryBuilder('expense')
      .select('COALESCE(SUM(expense.amount), 0)', 'total')
      .addSelect('COUNT(expense.id)', 'count')
      .where('expense.userId = :userId', { userId })
      .andWhere('EXTRACT(MONTH FROM expense.date) = :month', { month })
      .andWhere('EXTRACT(YEAR FROM expense.date) = :year', { year })
      .getRawOne();

    const totalSpent = parseFloat(totalsResult?.total) || 0;
    const transactionCount = parseInt(totalsResult?.count, 10) || 0;

    // 2. Category breakdown
    const categoryRows = await this.expenseRepository
      .createQueryBuilder('expense')
      .leftJoin('expense.category', 'category')
      .select('expense.categoryId', 'categoryId')
      .addSelect("COALESCE(category.name, 'Uncategorized')", 'categoryName')
      .addSelect('category.icon', 'categoryIcon')
      .addSelect('COALESCE(SUM(expense.amount), 0)', 'total')
      .where('expense.userId = :userId', { userId })
      .andWhere('EXTRACT(MONTH FROM expense.date) = :month', { month })
      .andWhere('EXTRACT(YEAR FROM expense.date) = :year', { year })
      .groupBy('expense.categoryId')
      .addGroupBy('category.name')
      .addGroupBy('category.icon')
      .orderBy('total', 'DESC')
      .getRawMany();

    const categoryBreakdown = categoryRows.map((row) => ({
      categoryId: row.categoryId,
      categoryName: row.categoryName,
      categoryIcon: row.categoryIcon,
      totalSpent: parseFloat(row.total),
      percentage:
        totalSpent > 0
          ? Math.round((parseFloat(row.total) / totalSpent) * 10000) / 100
          : 0,
    }));

    // 3. Top vendors
    const vendorRows = await this.expenseRepository
      .createQueryBuilder('expense')
      .select('expense.vendor', 'vendor')
      .addSelect('COALESCE(SUM(expense.amount), 0)', 'total')
      .where('expense.userId = :userId', { userId })
      .andWhere('EXTRACT(MONTH FROM expense.date) = :month', { month })
      .andWhere('EXTRACT(YEAR FROM expense.date) = :year', { year })
      .andWhere('expense.vendor IS NOT NULL')
      .groupBy('expense.vendor')
      .orderBy('total', 'DESC')
      .limit(5)
      .getRawMany();

    const topVendors = vendorRows.map((row) => ({
      vendor: row.vendor,
      totalSpent: parseFloat(row.total),
    }));

    // 4. Budget comparison
    const budgets = await this.budgetRepository.find({
      where: { userId, month, year },
      relations: ['category'],
    });

    const budgetComparison = await Promise.all(
      budgets.map(async (budget) => {
        const spent = await this.calculateCategorySpent(
          budget.categoryId,
          month,
          year,
        );
        const remaining = budget.limit - spent;
        const percentage =
          budget.limit > 0
            ? Math.round((spent / budget.limit) * 10000) / 100
            : 0;

        return {
          categoryId: budget.categoryId,
          categoryName: budget.category.name,
          budgetLimit: budget.limit,
          spent,
          remaining: Math.round(remaining * 100) / 100,
          percentage,
        };
      }),
    );

    return {
      totalSpent: Math.round(totalSpent * 100) / 100,
      transactionCount,
      categoryBreakdown,
      topVendors,
      budgetComparison,
    };
  }

  async getCategoryBreakdown(userId: string, query: CategoryBreakdownQueryDto) {
    const month = query.month ?? new Date().getMonth() + 1;
    const year = query.year ?? new Date().getFullYear();

    // Query per-category spending
    const rows = await this.expenseRepository
      .createQueryBuilder('expense')
      .leftJoin('expense.category', 'category')
      .select('expense.categoryId', 'categoryId')
      .addSelect("COALESCE(category.name, 'Uncategorized')", 'categoryName')
      .addSelect('category.icon', 'categoryIcon')
      .addSelect('COALESCE(SUM(expense.amount), 0)', 'total')
      .where('expense.userId = :userId', { userId })
      .andWhere('EXTRACT(MONTH FROM expense.date) = :month', { month })
      .andWhere('EXTRACT(YEAR FROM expense.date) = :year', { year })
      .groupBy('expense.categoryId')
      .addGroupBy('category.name')
      .addGroupBy('category.icon')
      .orderBy('total', 'DESC')
      .getRawMany();

    if (rows.length === 0) {
      return [];
    }

    const totalSpent = rows.reduce(
      (sum, row) => sum + parseFloat(row.total),
      0,
    );

    // Get budgets for this month/year to enrich with budget data
    const budgets = await this.budgetRepository.find({
      where: { userId, month, year },
    });

    const budgetMap = new Map<string, number>();
    for (const budget of budgets) {
      budgetMap.set(budget.categoryId, budget.limit);
    }

    return rows.map((row) => {
      const spent = parseFloat(row.total);
      const budgetLimit = budgetMap.get(row.categoryId) ?? null;
      const budgetUtilization =
        budgetLimit !== null && budgetLimit > 0
          ? Math.round((spent / budgetLimit) * 10000) / 100
          : null;

      return {
        categoryId: row.categoryId,
        categoryName: row.categoryName,
        categoryIcon: row.categoryIcon,
        totalSpent: spent,
        percentageOfTotal: Math.round((spent / totalSpent) * 10000) / 100,
        budgetLimit,
        budgetUtilization,
      };
    });
  }

  async getMonthlyTrend(userId: string, query: TrendQueryDto) {
    const months = query.months ?? 6;
    const now = new Date();

    // Generate list of last N months
    const monthList: Array<{ month: number; year: number }> = [];
    for (let i = months - 1; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      monthList.push({
        month: date.getMonth() + 1,
        year: date.getFullYear(),
      });
    }

    // Query spending data for the entire range
    const startDate = new Date(monthList[0].year, monthList[0].month - 1, 1);
    const endDate = new Date(
      monthList[monthList.length - 1].year,
      monthList[monthList.length - 1].month,
      0, // last day of the month
    );

    const rows = await this.expenseRepository
      .createQueryBuilder('expense')
      .select('EXTRACT(MONTH FROM expense.date)', 'month')
      .addSelect('EXTRACT(YEAR FROM expense.date)', 'year')
      .addSelect('COALESCE(SUM(expense.amount), 0)', 'total')
      .where('expense.userId = :userId', { userId })
      .andWhere('expense.date >= :startDate', {
        startDate: startDate.toISOString().split('T')[0],
      })
      .andWhere('expense.date <= :endDate', {
        endDate: endDate.toISOString().split('T')[0],
      })
      .groupBy('EXTRACT(MONTH FROM expense.date)')
      .addGroupBy('EXTRACT(YEAR FROM expense.date)')
      .getRawMany();

    // Build a map for quick lookup
    const spendingMap = new Map<string, number>();
    for (const row of rows) {
      const key = `${parseInt(row.month)}-${parseInt(row.year)}`;
      spendingMap.set(key, parseFloat(row.total));
    }

    // Build trend data, filling zeros for missing months
    let previousSpent: number | null = null;

    return monthList.map(({ month, year }) => {
      const key = `${month}-${year}`;
      const totalSpent = spendingMap.get(key) ?? 0;

      const result: {
        month: number;
        year: number;
        label: string;
        totalSpent: number;
        changeFromPreviousMonth: number | null;
        changePercentage: number | null;
      } = {
        month,
        year,
        label: `${month}/${year}`,
        totalSpent,
        changeFromPreviousMonth: null,
        changePercentage: null,
      };

      if (previousSpent !== null) {
        result.changeFromPreviousMonth =
          Math.round((totalSpent - previousSpent) * 100) / 100;

        if (previousSpent > 0) {
          result.changePercentage =
            Math.round(((totalSpent - previousSpent) / previousSpent) * 10000) /
            100;
        }
      }

      previousSpent = totalSpent;

      return result;
    });
  }

  private async calculateCategorySpent(
    categoryId: string,
    month: number,
    year: number,
  ): Promise<number> {
    const result = await this.expenseRepository
      .createQueryBuilder('expense')
      .select('COALESCE(SUM(expense.amount), 0)', 'total')
      .where('expense.categoryId = :categoryId', { categoryId })
      .andWhere('EXTRACT(MONTH FROM expense.date) = :month', { month })
      .andWhere('EXTRACT(YEAR FROM expense.date) = :year', { year })
      .getRawOne();

    return parseFloat(result?.total) || 0;
  }

  /**
   * Export expenses for a given month/year as CSV string.
   */
  async exportCsv(userId: string, query: SummaryQueryDto): Promise<string> {
    const month = query.month ?? new Date().getMonth() + 1;
    const year = query.year ?? new Date().getFullYear();

    const expenses = await this.expenseRepository
      .createQueryBuilder('expense')
      .leftJoin('expense.category', 'category')
      .select('expense.id', 'id')
      .addSelect('expense.amount', 'amount')
      .addSelect('expense.currency', 'currency')
      .addSelect("COALESCE(category.name, 'Uncategorized')", 'category')
      .addSelect('expense.vendor', 'vendor')
      .addSelect('expense.date', 'date')
      .addSelect('expense.status', 'status')
      .where('expense.userId = :userId', { userId })
      .andWhere('EXTRACT(MONTH FROM expense.date) = :month', { month })
      .andWhere('EXTRACT(YEAR FROM expense.date) = :year', { year })
      .orderBy('expense.date', 'ASC')
      .getRawMany();

    const headers = [
      'Date',
      'Category',
      'Vendor',
      'Amount',
      'Currency',
      'Status',
    ];

    const rows = expenses.map((e) => [
      e.date,
      e.category,
      e.vendor ?? '',
      parseFloat(e.amount).toFixed(2),
      e.currency,
      e.status,
    ]);

    const escape = (val: string) => {
      if (val.includes(',') || val.includes('"') || val.includes('\n')) {
        return `"${val.replace(/"/g, '""')}"`;
      }
      return val;
    };

    return [
      headers.join(','),
      ...rows.map((row) => row.map(escape).join(',')),
    ].join('\n');
  }
}
