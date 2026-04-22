import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CategoriesController } from './categories.controller';
import { CategoriesService } from './categories.service';
import { Category } from './entities/category.entity';
import { Expense } from '../expenses/entities/expense.entity';
import { CreateCategoryUseCase } from './use-cases/create-category.use-case';
import { GetCategoriesUseCase } from './use-cases/get-categories.use-case';
import { GetCategoryUseCase } from './use-cases/get-category.use-case';
import { UpdateCategoryUseCase } from './use-cases/update-category.use-case';
import { DeleteCategoryUseCase } from './use-cases/delete-category.use-case';
import { CategoryExpenseCheckAdapter } from './ports/category-expense-check.adapter';
import { CATEGORY_EXPENSE_CHECK_PORT } from './ports/category-expense-check.port';

@Module({
  imports: [TypeOrmModule.forFeature([Category, Expense])],
  controllers: [CategoriesController],
  providers: [
    CreateCategoryUseCase,
    GetCategoriesUseCase,
    GetCategoryUseCase,
    UpdateCategoryUseCase,
    DeleteCategoryUseCase,
    CategoriesService,
    {
      provide: CATEGORY_EXPENSE_CHECK_PORT,
      useClass: CategoryExpenseCheckAdapter,
    },
  ],
  exports: [CategoriesService],
})
export class CategoriesModule {}
