import { PrimaryGeneratedColumn, Column, OneToMany, Entity } from 'typeorm';
import { Expense } from '../../expenses/entities/expense.entity';
import { Category } from '../../categories/entities/category.entity';

@Entity()
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  email: string;

  @Column()
  passwordHash: string;

  @Column({ nullable: true })
  name: string;

  @Column({ default: 'USD' })
  defaultCurrency: string;

  @Column({ type: 'float', default: 0.8 })
  confidenceThreshold: number;

  @OneToMany(() => Expense, (expense) => expense.user)
  expenses: Expense[];

  @OneToMany(() => Category, (category) => category.user)
  categories: Category[];
}
