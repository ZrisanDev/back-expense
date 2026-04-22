import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateBudgetDto } from './dto/create-budget.dto';
import { UpdateBudgetDto } from './dto/update-budget.dto';
import { QueryBudgetDto } from './dto/query-budget.dto';
import { Budget } from './entities/budget.entity';
import { Expense } from '../expenses/entities/expense.entity';

@Injectable()
export class BudgetsService {
  constructor(
    @InjectRepository(Budget)
    private readonly budgetRepository: Repository<Budget>,
    @InjectRepository(Expense)
    private readonly expenseRepository: Repository<Expense>,
  ) {}

  async create(userId: string, createBudgetDto: CreateBudgetDto) {
    const budget = this.budgetRepository.create({
      ...createBudgetDto,
      userId,
    });

    return this.budgetRepository.save(budget);
  }

  async findAll(userId: string, query: QueryBudgetDto) {
    const { month, year } = query;

    const budgets = await this.budgetRepository.find({
      where: { userId, month, year },
      relations: ['category'],
    });

    const results = await Promise.all(
      budgets.map(async (budget) => this.enrichWithUtilization(budget)),
    );

    return results;
  }

  async findOne(id: string, userId: string) {
    const budget = await this.budgetRepository.findOne({
      where: { id, userId },
      relations: ['category'],
    });

    if (!budget) {
      throw new NotFoundException('Budget not found');
    }

    return this.enrichWithUtilization(budget);
  }

  async update(id: string, userId: string, updateBudgetDto: UpdateBudgetDto) {
    const budget = await this.findOne(id, userId);

    Object.assign(budget, updateBudgetDto);
    const updated = await this.budgetRepository.save(budget);

    return this.enrichWithUtilization(updated);
  }

  async remove(id: string, userId: string) {
    const budget = await this.findOne(id, userId);
    await this.budgetRepository.remove(budget);
    return { deleted: true };
  }

  private async enrichWithUtilization(budget: Budget) {
    const spent = await this.calculateSpent(
      budget.categoryId,
      budget.month,
      budget.year,
    );

    const remaining = budget.limit - spent;
    const percentage = budget.limit > 0 ? (spent / budget.limit) * 100 : 0;

    return {
      ...budget,
      spent,
      remaining,
      percentage: Math.round(percentage * 100) / 100,
    };
  }

  private async calculateSpent(
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
}
