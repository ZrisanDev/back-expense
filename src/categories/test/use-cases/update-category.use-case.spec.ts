import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { UpdateCategoryUseCase } from '../../use-cases/update-category.use-case';
import { GetCategoryUseCase } from '../../use-cases/get-category.use-case';
import { Category } from '../../entities/category.entity';
import { User } from '../../../users/entities/user.entity';

describe('UpdateCategoryUseCase', () => {
  let useCase: UpdateCategoryUseCase;
  let repo: jest.Mocked<Repository<Category>>;
  let getCategoryUseCase: jest.Mocked<GetCategoryUseCase>;

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
        UpdateCategoryUseCase,
        {
          provide: GetCategoryUseCase,
          useValue: {
            execute: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(Category),
          useValue: {
            save: jest.fn(),
          },
        },
      ],
    }).compile();

    useCase = module.get<UpdateCategoryUseCase>(UpdateCategoryUseCase);
    repo = module.get(getRepositoryToken(Category));
    getCategoryUseCase = module.get(GetCategoryUseCase);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(useCase).toBeDefined();
  });

  describe('execute', () => {
    it('should update category name and return saved entity', async () => {
      getCategoryUseCase.execute.mockResolvedValue(mockCategory);
      (repo.save as jest.Mock).mockResolvedValue({
        ...mockCategory,
        name: 'Meals',
      });

      const result = await useCase.execute(categoryId, userId, {
        name: 'Meals',
      });

      expect(getCategoryUseCase.execute).toHaveBeenCalledWith(
        categoryId,
        userId,
      );
      expect(repo.save).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Meals' }),
      );
      expect(result.name).toBe('Meals');
    });

    it('should throw NotFoundException when category does not exist', async () => {
      getCategoryUseCase.execute.mockImplementation(() => {
        throw new NotFoundException('Category not found');
      });

      await expect(
        useCase.execute('nonexistent-id', userId, { name: 'Meals' }),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
