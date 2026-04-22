import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Category } from '../entities/category.entity';
import { QueryCategoryDto } from '../dto/query-category.dto';

@Injectable()
export class GetCategoriesUseCase {
  constructor(
    @InjectRepository(Category)
    private readonly categoryRepository: Repository<Category>,
  ) {}

  async execute(userId: string, query: QueryCategoryDto) {
    const {
      page = 1,
      limit = 20,
      sortBy = 'name',
      sortOrder = 'ASC',
      search,
    } = query;

    const qb = this.categoryRepository
      .createQueryBuilder('category')
      .where('category.userId = :userId OR category.isDefault = :isDefault', {
        userId,
        isDefault: true,
      });

    if (search) {
      qb.andWhere('category.name ILIKE :search', {
        search: `%${search}%`,
      });
    }

    qb.orderBy(`category.${sortBy}`, sortOrder)
      .skip((page - 1) * limit)
      .take(limit);

    const [items, total] = await qb.getManyAndCount();

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }
}
