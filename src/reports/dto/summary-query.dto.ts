import { IsInt, Min, Max, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class SummaryQueryDto {
  @ApiPropertyOptional({
    description: 'Month (1-12)',
    example: 4,
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  @IsOptional()
  month?: number;

  @ApiPropertyOptional({
    description: 'Year (2020-2100)',
    example: 2026,
  })
  @Type(() => Number)
  @IsInt()
  @Min(2020)
  @Max(2100)
  @IsOptional()
  year?: number;
}
