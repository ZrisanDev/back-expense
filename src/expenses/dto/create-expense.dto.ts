import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ExpenseStatus } from '../entities/expense.entity';

export class CreateExpenseDto {
  @ApiProperty({ description: 'Expense amount', example: 45.5 })
  @IsNumber()
  @IsNotEmpty()
  amount: number;

  @ApiPropertyOptional({
    description: 'ISO currency code',
    example: 'USD',
    default: 'USD',
  })
  @IsString()
  @IsOptional()
  currency: string;

  @ApiPropertyOptional({
    description: 'Category UUID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsString()
  @IsOptional()
  categoryId: string;

  @ApiPropertyOptional({ description: 'Vendor name', example: 'Amazon' })
  @IsString()
  @IsOptional()
  vendor: string;

  @ApiProperty({
    description: 'Expense date (ISO string)',
    example: '2026-04-21',
  })
  @IsString()
  @IsNotEmpty()
  date: string;

  @ApiPropertyOptional({
    description: 'Expense status',
    enum: ExpenseStatus,
    default: ExpenseStatus.UPLOADED,
  })
  @IsEnum(ExpenseStatus)
  @IsOptional()
  status: ExpenseStatus;
}
