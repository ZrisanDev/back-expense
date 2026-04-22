import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { DeleteCategoryUseCase } from '../../use-cases/delete-category.use-case';
import { GetCategoryUseCase } from '../../use-cases/get-category.use-case';
import { CategoryExpenseCheckPort } from '../../ports/category-expense-check.port';
import { Category } from '../../entities/category.entity';
import { User } from '../../../users/entities/user.entity';

describe('DeleteCategoryUseCase', () => {
  let useCase: DeleteCategoryUseCase;
  let repo: jest.Mocked<Repository<Category>>;
  let getCategoryUseCase: jest.Mocked<GetCategoryUseCase>;
  let expenseCheckPort: jest.Mocked<CategoryExpenseCheckPort>;

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
        DeleteCategoryUseCase,
        {
          provide: GetCategoryUseCase,
          useValue: {
            execute: jest.fn(),
          },
        },
        {
          provide: 'CATEGORY_EXPENSE_CHECK_PORT',
          useValue: {
            countByCategoryId: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(Category),
          useValue: {
            remove: jest.fn(),
          },
        },
      ],
    }).compile();

    useCase = module.get<DeleteCategoryUseCase>(DeleteCategoryUseCase);
    repo = module.get(getRepositoryToken(Category));
    getCategoryUseCase = module.get(GetCategoryUseCase);
    expenseCheckPort = module.get('CATEGORY_EXPENSE_CHECK_PORT');
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(useCase).toBeDefined();
  });

  describe('execute', () => {
    it('should delete a category with no expenses and return { deleted: true }', async () => {
      getCategoryUseCase.execute.mockResolvedValue(mockCategory);
      expenseCheckPort.countByCategoryId.mockResolvedValue(0);
      (repo.remove as jest.Mock).mockResolvedValue(mockCategory);

      const result = await useCase.execute(categoryId, userId);

      expect(getCategoryUseCase.execute).toHaveBeenCalledWith(
        categoryId,
        userId,
      );
      expect(expenseCheckPort.countByCategoryId).toHaveBeenCalledWith(
        categoryId,
      );
      expect(repo.remove).toHaveBeenCalledWith(mockCategory);
      expect(result).toEqual({ deleted: true });
    });

    it('should throw NotFoundException when category does not exist', async () => {
      getCategoryUseCase.execute.mockImplementation(() => {
        throw new NotFoundException('Category not found');
      });

      await expect(useCase.execute('nonexistent-id', userId)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw BadRequestException when category is in use by expenses', async () => {
      getCategoryUseCase.execute.mockResolvedValue(mockCategory);
      expenseCheckPort.countByCategoryId.mockResolvedValue(3);

      await expect(useCase.execute(categoryId, userId)).rejects.toThrow(
        BadRequestException,
      );
      await expect(useCase.execute(categoryId, userId)).rejects.toThrow(
        /Cannot delete category .* it is used by 3 expense/,
      );
      expect(repo.remove).not.toHaveBeenCalled();
    });
  });
});
