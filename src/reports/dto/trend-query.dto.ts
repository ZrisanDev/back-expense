import { IsInt, Min, Max, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class TrendQueryDto {
  @ApiPropertyOptional({
    description: 'Number of months to look back (1-24)',
    example: 6,
    default: 6,
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(24)
  @IsOptional()
  months?: number;
}
