import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ExpensesService } from './expenses.service';
import { ExpensesController } from './expenses.controller';
import { ExpensesCronService } from './expenses.cron.service';
import { Expense } from './entities/expense.entity';
import { ExpenseStatusHistory } from '../processing/entities/expense-status-history.entity';
import { FilesModule } from '../files/files.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Expense, ExpenseStatusHistory]),
    FilesModule,
  ],
  controllers: [ExpensesController],
  providers: [ExpensesService, ExpensesCronService],
})
export class ExpensesModule {}
