import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ReportsService } from './reports.service';
import { ReportsController } from './reports.controller';
import { Expense } from '../expenses/entities/expense.entity';
import { Budget } from '../budgets/entities/budget.entity';
import { Category } from '../categories/entities/category.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Expense, Budget, Category])],
  controllers: [ReportsController],
  providers: [ReportsService],
})
export class ReportsModule {}
