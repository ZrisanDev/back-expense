import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { GetCategoriesUseCase } from '../../use-cases/get-categories.use-case';
import { QueryCategoryDto } from '../../dto/query-category.dto';
import { Category } from '../../entities/category.entity';
import { User } from '../../../users/entities/user.entity';

describe('GetCategoriesUseCase', () => {
  let useCase: GetCategoriesUseCase;

  const userId = 'user-123';

  const mockCategory: Category = {
    id: 'cat-456',
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

  const mockQueryBuilder: any = {
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    getManyAndCount: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GetCategoriesUseCase,
        {
          provide: getRepositoryToken(Category),
          useValue: {
            createQueryBuilder: jest.fn(() => mockQueryBuilder),
          },
        },
      ],
    }).compile();

    useCase = module.get<GetCategoriesUseCase>(GetCategoriesUseCase);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(useCase).toBeDefined();
  });

  describe('execute', () => {
    it('should return paginated categories for user plus defaults', async () => {
      const query: QueryCategoryDto = {
        page: 1,
        limit: 20,
        sortBy: 'name',
        sortOrder: 'ASC',
      };
      const items = [mockCategory, mockDefaultCategory];
      mockQueryBuilder.getManyAndCount.mockResolvedValue([items, 2]);

      const result = await useCase.execute(userId, query);

      expect(mockQueryBuilder.where).toHaveBeenCalledWith(
        'category.userId = :userId OR category.isDefault = :isDefault',
        { userId, isDefault: true },
      );
      expect(mockQueryBuilder.orderBy).toHaveBeenCalledWith(
        'category.name',
        'ASC',
      );
      expect(mockQueryBuilder.skip).toHaveBeenCalledWith(0);
      expect(mockQueryBuilder.take).toHaveBeenCalledWith(20);
      expect(result).toEqual({
        items,
        total: 2,
        page: 1,
        limit: 20,
        totalPages: 1,
      });
    });

    it('should apply search filter when provided', async () => {
      const query: QueryCategoryDto = { search: 'gro' };
      mockQueryBuilder.getManyAndCount.mockResolvedValue([[mockCategory], 1]);

      await useCase.execute(userId, query);

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'category.name ILIKE :search',
        { search: '%gro%' },
      );
    });

    it('should calculate totalPages correctly', async () => {
      const query: QueryCategoryDto = { page: 2, limit: 10 };
      mockQueryBuilder.getManyAndCount.mockResolvedValue([[], 25]);

      const result = await useCase.execute(userId, query);

      expect(result.totalPages).toBe(3);
      expect(mockQueryBuilder.skip).toHaveBeenCalledWith(10);
    });
  });
});
