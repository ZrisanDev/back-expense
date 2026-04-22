import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ProcessingResultResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() expenseId: string;
  @ApiPropertyOptional() rawText?: string;
  @ApiPropertyOptional() structuredJson?: Record<string, any>;
  @ApiPropertyOptional() confidence?: number;
  @ApiPropertyOptional() processedAt?: Date;
}
