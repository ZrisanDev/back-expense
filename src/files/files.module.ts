import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FilesService } from './files.service';
import { FilesController } from './files.controller';
import { File } from './entities/file.entity';
import { Expense } from '../expenses/entities/expense.entity';
import { ExpenseStatusHistory } from '../processing/entities/expense-status-history.entity';

@Module({
  imports: [TypeOrmModule.forFeature([File, Expense, ExpenseStatusHistory])],
  controllers: [FilesController],
  providers: [FilesService],
  exports: [FilesService],
})
export class FilesModule {}
