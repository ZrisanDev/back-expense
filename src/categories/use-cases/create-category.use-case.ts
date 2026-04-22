import { Injectable, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Category } from '../entities/category.entity';
import { CreateCategoryDto } from '../dto/create-category.dto';

@Injectable()
export class CreateCategoryUseCase {
  constructor(
    @InjectRepository(Category)
    private readonly categoryRepository: Repository<Category>,
  ) {}

  async execute(
    userId: string,
    createCategoryDto: CreateCategoryDto,
  ): Promise<Category> {
    if (!createCategoryDto.isDefault) {
      const existing = await this.categoryRepository.findOne({
        where: { userId, name: createCategoryDto.name, isDefault: false },
      });

      if (existing) {
        throw new ConflictException('Category with this name already exists');
      }
    }

    const category = this.categoryRepository.create({
      ...createCategoryDto,
      userId,
    });

    return this.categoryRepository.save(category);
  }
}
