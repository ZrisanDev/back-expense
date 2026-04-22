import { Injectable } from '@nestjs/common';
import { CreateCategoryUseCase } from './use-cases/create-category.use-case';
import { GetCategoriesUseCase } from './use-cases/get-categories.use-case';
import { GetCategoryUseCase } from './use-cases/get-category.use-case';
import { UpdateCategoryUseCase } from './use-cases/update-category.use-case';
import { DeleteCategoryUseCase } from './use-cases/delete-category.use-case';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { QueryCategoryDto } from './dto/query-category.dto';
import { Category } from './entities/category.entity';

@Injectable()
export class CategoriesService {
  constructor(
    private readonly createCategoryUseCase: CreateCategoryUseCase,
    private readonly getCategoriesUseCase: GetCategoriesUseCase,
    private readonly getCategoryUseCase: GetCategoryUseCase,
    private readonly updateCategoryUseCase: UpdateCategoryUseCase,
    private readonly deleteCategoryUseCase: DeleteCategoryUseCase,
  ) {}

  async create(
    userId: string,
    createCategoryDto: CreateCategoryDto,
  ): Promise<Category> {
    return this.createCategoryUseCase.execute(userId, createCategoryDto);
  }

  async findAll(userId: string, query: QueryCategoryDto) {
    return this.getCategoriesUseCase.execute(userId, query);
  }

  async findOne(id: string, userId: string): Promise<Category> {
    return this.getCategoryUseCase.execute(id, userId);
  }

  async update(
    id: string,
    userId: string,
    updateCategoryDto: UpdateCategoryDto,
  ): Promise<Category> {
    return this.updateCategoryUseCase.execute(id, userId, updateCategoryDto);
  }

  async remove(id: string, userId: string): Promise<{ deleted: boolean }> {
    return this.deleteCategoryUseCase.execute(id, userId);
  }
}
