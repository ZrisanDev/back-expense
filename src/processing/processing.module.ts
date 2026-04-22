import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProcessingService } from './processing.service';
import { InternalController } from './internal.controller';
import { ProcessingResult } from './entities/processing-result.entity';
import { ExpenseStatusHistory } from './entities/expense-status-history.entity';

@Module({
  imports: TypeOrmModule.forFeature([ProcessingResult, ExpenseStatusHistory]),
  controllers: [InternalController],
  providers: [ProcessingService],
  exports: [ProcessingService],
})
export class ProcessingModule {}
