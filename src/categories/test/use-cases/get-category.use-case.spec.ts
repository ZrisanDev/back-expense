import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { GetCategoryUseCase } from '../../use-cases/get-category.use-case';
import { Category } from '../../entities/category.entity';
import { User } from '../../../users/entities/user.entity';

describe('GetCategoryUseCase', () => {
  let useCase: GetCategoryUseCase;
  let repo: jest.Mocked<Repository<Category>>;

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

  const mockDefaultCategory: Category = {
    id: 'default-cat-789',
    name: 'Food',
    icon: '🍔',
    isDefault: true,
    userId: 'system',
    user: {} as User,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GetCategoryUseCase,
        {
          provide: getRepositoryToken(Category),
          useValue: {
            findOne: jest.fn(),
          },
        },
      ],
    }).compile();

    useCase = module.get<GetCategoryUseCase>(GetCategoryUseCase);
    repo = module.get(getRepositoryToken(Category));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(useCase).toBeDefined();
  });

  describe('execute', () => {
    it('should return a category owned by the user', async () => {
      (repo.findOne as jest.Mock).mockResolvedValue(mockCategory);

      const result = await useCase.execute(categoryId, userId);

      expect(repo.findOne).toHaveBeenCalledWith({
        where: [
          { id: categoryId, userId },
          { id: categoryId, isDefault: true },
        ],
      });
      expect(result).toEqual(mockCategory);
    });

    it('should return a default category accessible to any user', async () => {
      (repo.findOne as jest.Mock).mockResolvedValue(mockDefaultCategory);

      const result = await useCase.execute('default-cat-789', userId);

      expect(result).toEqual(mockDefaultCategory);
    });

    it('should throw NotFoundException when category not found', async () => {
      (repo.findOne as jest.Mock).mockResolvedValue(null);

      await expect(useCase.execute('nonexistent-id', userId)).rejects.toThrow(
        NotFoundException,
      );
      await expect(useCase.execute('nonexistent-id', userId)).rejects.toThrow(
        'Category not found',
      );
    });
  });
});
