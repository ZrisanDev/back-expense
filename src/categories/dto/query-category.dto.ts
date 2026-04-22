import { IsIn, IsOptional, IsString, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export class QueryCategoryDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  page?: number = 1;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  limit?: number = 20;

  @IsIn(['name', 'createdAt'])
  @IsOptional()
  sortBy?: string = 'name';

  @IsIn(['ASC', 'DESC'])
  @IsOptional()
  sortOrder?: 'ASC' | 'DESC' = 'ASC';

  @IsString()
  @IsOptional()
  search?: string;
}
