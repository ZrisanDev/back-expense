import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { QueryCategoryDto } from './dto/query-category.dto';
import { Category } from './entities/category.entity';

@Injectable()
export class CategoriesService {
  constructor(
    @InjectRepository(Category)
    private readonly categoryRepository: Repository<Category>,
  ) {}

  async create(userId: string, createCategoryDto: CreateCategoryDto) {
    const category = this.categoryRepository.create({
      ...createCategoryDto,
      userId,
    });

    return this.categoryRepository.save(category);
  }

  async findAll(userId: string, query: QueryCategoryDto) {
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

  async findOne(id: string, userId: string) {
    const category = await this.categoryRepository.findOne({
      where: [
        { id, userId },
        { id, isDefault: true },
      ],
    });

    if (!category) {
      throw new NotFoundException('Category not found');
    }

    return category;
  }

  async update(
    id: string,
    userId: string,
    updateCategoryDto: UpdateCategoryDto,
  ) {
    const category = await this.findOne(id, userId);

    Object.assign(category, updateCategoryDto);
    return this.categoryRepository.save(category);
  }

  async remove(id: string, userId: string) {
    const category = await this.findOne(id, userId);
    await this.categoryRepository.remove(category);
    return { deleted: true };
  }
}
