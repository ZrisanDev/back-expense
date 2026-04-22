import {
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  Entity,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Category } from '../../categories/entities/category.entity';
import { File } from '../../files/entities/file.entity';
import { ProcessingResult } from '../../processing/entities/processing-result.entity';
import { ExpenseStatusHistory } from '../../processing/entities/expense-status-history.entity';

export enum ExpenseStatus {
  UPLOADED = 'UPLOADED',
  PROCESSING = 'PROCESSING',
  PROCESSED = 'PROCESSED',
  NEEDS_REVIEW = 'NEEDS_REVIEW',
  FAILED = 'FAILED',
  APPROVED = 'APPROVED',
}

@Entity()
export class Expense {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id' })
  userId: string;

  @ManyToOne(() => User, (user) => user.expenses, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ type: 'float' })
  amount: number;

  @Column({ default: 'USD' })
  currency: string;

  @Column({ name: 'category_id', nullable: true })
  categoryId: string;

  @ManyToOne(() => Category, (category) => category.id, {
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'category_id' })
  category: Category;

  @Column({ nullable: true })
  vendor: string;

  @Column({ type: 'date' })
  date: string;

  @Column({
    type: 'enum',
    enum: ExpenseStatus,
    default: ExpenseStatus.UPLOADED,
  })
  status: ExpenseStatus;

  @Column({ name: 'is_duplicate_suspect', default: false })
  isDuplicateSuspect: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @OneToMany(() => File, (file) => file.expense)
  files: File[];

  @OneToMany(() => ProcessingResult, (pr) => pr.expense)
  processingResults: ProcessingResult[];

  @OneToMany(() => ExpenseStatusHistory, (h) => h.expense)
  statusHistory: ExpenseStatusHistory[];
}
