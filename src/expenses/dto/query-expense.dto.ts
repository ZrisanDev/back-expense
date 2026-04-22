import {
  IsEnum,
  IsIn,
  IsOptional,
  IsString,
  IsDateString,
  IsInt,
  Min,
  Max,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { ExpenseStatus } from '../entities/expense.entity';

export class QueryExpenseDto {
  @ApiPropertyOptional({ description: 'Page number', default: 1, example: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  page?: number = 1;

  @ApiPropertyOptional({ description: 'Items per page', default: 20, maximum: 100, example: 20 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  limit?: number = 20;

  @ApiPropertyOptional({ description: 'Filter by expense status', enum: ExpenseStatus })
  @IsEnum(ExpenseStatus)
  @IsOptional()
  status?: ExpenseStatus;

  @ApiPropertyOptional({ description: 'Filter by category ID', example: '550e8400-e29b-41d4-a716-446655440000' })
  @IsString()
  @IsOptional()
  category?: string;

  @ApiPropertyOptional({ description: 'Filter from date (ISO string)', example: '2026-01-01' })
  @IsDateString()
  @IsOptional()
  dateFrom?: string;

  @ApiPropertyOptional({ description: 'Filter to date (ISO string)', example: '2026-12-31' })
  @IsDateString()
  @IsOptional()
  dateTo?: string;

  @ApiPropertyOptional({ description: 'Filter by vendor name', example: 'Amazon' })
  @IsString()
  @IsOptional()
  vendor?: string;

  @ApiPropertyOptional({ description: 'Sort field', enum: ['date', 'amount', 'createdAt'], default: 'createdAt' })
  @IsIn(['date', 'amount', 'createdAt'])
  @IsOptional()
  sortBy?: string = 'createdAt';

  @ApiPropertyOptional({ description: 'Sort order', enum: ['ASC', 'DESC'], default: 'DESC' })
  @IsIn(['ASC', 'DESC'])
  @IsOptional()
  sortOrder?: 'ASC' | 'DESC' = 'DESC';
}
