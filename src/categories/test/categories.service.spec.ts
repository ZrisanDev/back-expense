import { Test, TestingModule } from '@nestjs/testing';
import { CategoriesService } from '../categories.service';
import { CreateCategoryUseCase } from '../use-cases/create-category.use-case';
import { GetCategoriesUseCase } from '../use-cases/get-categories.use-case';
import { GetCategoryUseCase } from '../use-cases/get-category.use-case';
import { UpdateCategoryUseCase } from '../use-cases/update-category.use-case';
import { DeleteCategoryUseCase } from '../use-cases/delete-category.use-case';
import { CreateCategoryDto } from '../dto/create-category.dto';
import { UpdateCategoryDto } from '../dto/update-category.dto';
import { QueryCategoryDto } from '../dto/query-category.dto';
import { Category } from '../entities/category.entity';
import { User } from '../../users/entities/user.entity';

describe('CategoriesService', () => {
  let service: CategoriesService;
  let createUseCase: jest.Mocked<CreateCategoryUseCase>;
  let getCategoriesUseCase: jest.Mocked<GetCategoriesUseCase>;
  let getCategoryUseCase: jest.Mocked<GetCategoryUseCase>;
  let updateUseCase: jest.Mocked<UpdateCategoryUseCase>;
  let deleteUseCase: jest.Mocked<DeleteCategoryUseCase>;

  const userId = 'user-123';
  const categoryId = 'cat-456';

  const mockCategory: Category = {
    id: categoryId,
    name: 'Groceries',
    icon: '🛒',
    isDefault: false,
    userId,
    user: {} as User,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CategoriesService,
        { provide: CreateCategoryUseCase, useValue: { execute: jest.fn() } },
        { provide: GetCategoriesUseCase, useValue: { execute: jest.fn() } },
        { provide: GetCategoryUseCase, useValue: { execute: jest.fn() } },
        { provide: UpdateCategoryUseCase, useValue: { execute: jest.fn() } },
        { provide: DeleteCategoryUseCase, useValue: { execute: jest.fn() } },
      ],
    }).compile();

    service = module.get<CategoriesService>(CategoriesService);
    createUseCase = module.get(CreateCategoryUseCase);
    getCategoriesUseCase = module.get(GetCategoriesUseCase);
    getCategoryUseCase = module.get(GetCategoryUseCase);
    updateUseCase = module.get(UpdateCategoryUseCase);
    deleteUseCase = module.get(DeleteCategoryUseCase);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should delegate to CreateCategoryUseCase with userId and dto', async () => {
      const dto: CreateCategoryDto = { name: 'Groceries', icon: '🛒' };
      createUseCase.execute.mockResolvedValue(mockCategory);

      const result = await service.create(userId, dto);

      expect(createUseCase.execute).toHaveBeenCalledWith(userId, dto);
      expect(result).toEqual(mockCategory);
    });
  });

  describe('findAll', () => {
    it('should delegate to GetCategoriesUseCase with userId and query', async () => {
      const query: QueryCategoryDto = { page: 1, limit: 20 };
      const paginatedResult = {
        items: [mockCategory],
        total: 1,
        page: 1,
        limit: 20,
        totalPages: 1,
      };
      getCategoriesUseCase.execute.mockResolvedValue(paginatedResult);

      const result = await service.findAll(userId, query);

      expect(getCategoriesUseCase.execute).toHaveBeenCalledWith(userId, query);
      expect(result).toEqual(paginatedResult);
    });
  });

  describe('findOne', () => {
    it('should delegate to GetCategoryUseCase with id and userId', async () => {
      getCategoryUseCase.execute.mockResolvedValue(mockCategory);

      const result = await service.findOne(categoryId, userId);

      expect(getCategoryUseCase.execute).toHaveBeenCalledWith(
        categoryId,
        userId,
      );
      expect(result).toEqual(mockCategory);
    });
  });

  describe('update', () => {
    it('should delegate to UpdateCategoryUseCase with id, userId, and dto', async () => {
      const dto: UpdateCategoryDto = { name: 'Meals' };
      const updated = { ...mockCategory, name: 'Meals' };
      updateUseCase.execute.mockResolvedValue(updated);

      const result = await service.update(categoryId, userId, dto);

      expect(updateUseCase.execute).toHaveBeenCalledWith(
        categoryId,
        userId,
        dto,
      );
      expect(result).toEqual(updated);
    });
  });

  describe('remove', () => {
    it('should delegate to DeleteCategoryUseCase with id and userId', async () => {
      deleteUseCase.execute.mockResolvedValue({ deleted: true });

      const result = await service.remove(categoryId, userId);

      expect(deleteUseCase.execute).toHaveBeenCalledWith(categoryId, userId);
      expect(result).toEqual({ deleted: true });
    });
  });
});
