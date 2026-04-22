import {
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  Entity,
  CreateDateColumn,
  Index,
} from 'typeorm';
import { Expense } from '../../expenses/entities/expense.entity';

@Entity('expense_status_history')
@Index('IDX_expense_status_history_expense_id', ['expenseId'])
export class ExpenseStatusHistory {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'expense_id' })
  expenseId: string;

  @ManyToOne(() => Expense, (expense) => expense.statusHistory, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'expense_id' })
  expense: Expense;

  @Column({ name: 'from_status' })
  fromStatus: string;

  @Column({ name: 'to_status' })
  toStatus: string;

  @CreateDateColumn({ name: 'changed_at' })
  changedAt: Date;

  @Column({ nullable: true })
  reason: string;
}
