import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Expense } from '../../expenses/entities/expense.entity';
import { CategoryExpenseCheckPort } from './category-expense-check.port';

@Injectable()
export class CategoryExpenseCheckAdapter implements CategoryExpenseCheckPort {
  constructor(
    @InjectRepository(Expense)
    private readonly expenseRepository: Repository<Expense>,
  ) {}

  async countByCategoryId(categoryId: string): Promise<number> {
    return this.expenseRepository
      .createQueryBuilder('expense')
      .where('expense.categoryId = :categoryId', { categoryId })
      .getCount();
  }
}
