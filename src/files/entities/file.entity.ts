import {
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  Entity,
  CreateDateColumn,
} from 'typeorm';
import { Expense } from '../../expenses/entities/expense.entity';

export enum FileType {
  JPEG = 'jpeg',
  PNG = 'png',
  PDF = 'pdf',
}

@Entity()
export class File {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'expense_id' })
  expenseId: string;

  @ManyToOne(() => Expense, (expense) => expense.files, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'expense_id' })
  expense: Expense;

  @Column({ name: 's3_key' })
  s3Key: string;

  @Column({ name: 'file_url' })
  fileUrl: string;

  @Column({ name: 'file_type', type: 'enum', enum: FileType })
  fileType: FileType;

  @CreateDateColumn({ name: 'uploaded_at' })
  uploadedAt: Date;
}
