import { Injectable, BadRequestException, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GetCategoryUseCase } from './get-category.use-case';
import {
  CategoryExpenseCheckPort,
  CATEGORY_EXPENSE_CHECK_PORT,
} from '../ports/category-expense-check.port';
import { Category } from '../entities/category.entity';

@Injectable()
export class DeleteCategoryUseCase {
  constructor(
    private readonly getCategoryUseCase: GetCategoryUseCase,
    @Inject(CATEGORY_EXPENSE_CHECK_PORT)
    private readonly expenseCheckPort: CategoryExpenseCheckPort,
    @InjectRepository(Category)
    private readonly categoryRepository: Repository<Category>,
  ) {}

  async execute(id: string, userId: string): Promise<{ deleted: boolean }> {
    const category = await this.getCategoryUseCase.execute(id, userId);

    const expenseCount = await this.expenseCheckPort.countByCategoryId(id);

    if (expenseCount > 0) {
      throw new BadRequestException(
        `Cannot delete category "${category.name}" — it is used by ${expenseCount} expense(s). Reassign or remove them first.`,
      );
    }

    await this.categoryRepository.remove(category);
    return { deleted: true };
  }
}
