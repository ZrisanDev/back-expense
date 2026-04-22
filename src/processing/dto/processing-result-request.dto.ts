import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
  ValidateIf,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ExpenseStatus } from '../../expenses/entities/expense.entity';

export class ProcessingResultRequestDto {
  @ApiProperty({ description: 'Expense UUID' })
  @IsUUID()
  @IsNotEmpty()
  expenseId: string;

  @ApiProperty({ description: 'S3 object key' })
  @IsString()
  @IsNotEmpty()
  s3Key: string;

  @ApiPropertyOptional({ description: 'Raw OCR text' })
  @IsString()
  @IsOptional()
  rawText?: string;

  @ApiPropertyOptional({ description: 'Structured JSON from AI parsing' })
  @IsObject()
  @ValidateIf((o) => o.structuredJson !== null && o.structuredJson !== undefined)
  structuredJson?: Record<string, any>;

  @ApiPropertyOptional({
    description: 'Confidence score (0-1)',
    minimum: 0,
    maximum: 1,
  })
  @IsNumber()
  @Min(0)
  @Max(1)
  @IsOptional()
  confidence?: number;

  @ApiProperty({
    description: 'Processing result status',
    enum: [ExpenseStatus.PROCESSED, ExpenseStatus.NEEDS_REVIEW, ExpenseStatus.FAILED],
  })
  @IsEnum([ExpenseStatus.PROCESSED, ExpenseStatus.NEEDS_REVIEW, ExpenseStatus.FAILED])
  status: ExpenseStatus;

  @ApiPropertyOptional({ description: 'Error message for failed processing' })
  @IsString()
  @IsOptional()
  errorMessage?: string;
}
