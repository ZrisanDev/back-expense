import {
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  Entity,
  Index,
} from 'typeorm';
import { Expense } from '../../expenses/entities/expense.entity';

@Entity('processing_result')
@Index('IDX_processing_result_expense_id', ['expenseId'])
export class ProcessingResult {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'expense_id' })
  expenseId: string;

  @ManyToOne(() => Expense, (expense) => expense.processingResults, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'expense_id' })
  expense: Expense;

  @Column({ type: 'text', nullable: true })
  rawText: string;

  @Column({ type: 'jsonb', nullable: true })
  structuredJson: Record<string, any>;

  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
  confidence: number;

  @Column({ name: 'processed_at', type: 'timestamp', nullable: true })
  processedAt: Date;
}
