import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { CategoriesService } from './categories.service';
import { Category } from './entities/category.entity';

describe('CategoriesService', () => {
  let service: CategoriesService;
  let repo: jest.Mocked<Repository<Category>>;

  const userId = 'user-123';
  const categoryId = 'cat-456';

  const mockCategory: Category = {
    id: categoryId,
    name: 'Groceries',
    icon: undefined,
    isDefault: false,
    userId,
    user: undefined,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockDefaultCategory: Category = {
    id: 'default-cat-789',
    name: 'Food',
    icon: '🍔',
    isDefault: true,
    userId: null,
    user: null as any,
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
        CategoriesService,
        {
          provide: getRepositoryToken(Category),
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
            findOne: jest.fn(),
            remove: jest.fn(),
            createQueryBuilder: jest.fn(() => mockQueryBuilder),
          },
        },
      ],
    }).compile();

    service = module.get<CategoriesService>(CategoriesService);
    repo = module.get(getRepositoryToken(Category));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create and save a category with userId', async () => {
      const dto = { name: 'Groceries', icon: '🛒', isDefault: false };
      (repo.create as jest.Mock).mockReturnValue({ ...dto, userId });
      (repo.save as jest.Mock).mockResolvedValue(mockCategory);

      const result = await service.create(userId, dto);

      expect(repo.create).toHaveBeenCalledWith({ ...dto, userId });
      expect(repo.save).toHaveBeenCalledWith({ ...dto, userId });
      expect(result).toEqual(mockCategory);
    });

    it('should create a category without optional fields', async () => {
      const dto = { name: 'Transport' };
      const expected = {
        ...mockCategory,
        name: 'Transport',
        icon: undefined,
        isDefault: undefined,
      };
      (repo.create as jest.Mock).mockReturnValue({ ...dto, userId });
      (repo.save as jest.Mock).mockResolvedValue(expected);

      const result = await service.create(userId, dto);

      expect(repo.create).toHaveBeenCalledWith({ ...dto, userId });
      expect(result).toEqual(expected);
    });
  });

  describe('findAll', () => {
    it('should return paginated categories for user plus defaults', async () => {
      const query = {
        page: 1,
        limit: 20,
        sortBy: 'name',
        sortOrder: 'ASC' as const,
      };
      const items = [mockCategory, mockDefaultCategory];
      mockQueryBuilder.getManyAndCount.mockResolvedValue([items, 2]);

      const result = await service.findAll(userId, query);

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
      const query = { search: 'gro' };
      mockQueryBuilder.getManyAndCount.mockResolvedValue([[mockCategory], 1]);

      await service.findAll(userId, query);

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'category.name ILIKE :search',
        { search: '%gro%' },
      );
    });

    it('should calculate totalPages correctly', async () => {
      const query = { page: 2, limit: 10 };
      mockQueryBuilder.getManyAndCount.mockResolvedValue([[], 25]);

      const result = await service.findAll(userId, query);

      expect(result.totalPages).toBe(3);
      expect(mockQueryBuilder.skip).toHaveBeenCalledWith(10);
    });
  });

  describe('findOne', () => {
    it('should return a category owned by the user', async () => {
      (repo.findOne as jest.Mock).mockResolvedValue(mockCategory);

      const result = await service.findOne(categoryId, userId);

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

      const result = await service.findOne('default-cat-789', userId);

      expect(result).toEqual(mockDefaultCategory);
    });

    it('should throw NotFoundException when category not found', async () => {
      (repo.findOne as jest.Mock).mockResolvedValue(null);

      await expect(service.findOne('nonexistent-id', userId)).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.findOne('nonexistent-id', userId)).rejects.toThrow(
        'Category not found',
      );
    });
  });

  describe('update', () => {
    it('should update category fields', async () => {
      jest.spyOn(service, 'findOne').mockResolvedValue(mockCategory);
      (repo.save as jest.Mock).mockResolvedValue({
        ...mockCategory,
        name: 'Meals',
      });

      const result = await service.update(categoryId, userId, {
        name: 'Meals',
      });

      expect(service.findOne).toHaveBeenCalledWith(categoryId, userId);
      expect(repo.save).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Meals' }),
      );
      expect(result.name).toBe('Meals');
    });

    it('should throw NotFoundException when updating non-existent category', async () => {
      jest.spyOn(service, 'findOne').mockImplementation(() => {
        throw new NotFoundException('Category not found');
      });

      await expect(
        service.update('nonexistent-id', userId, { name: 'Meals' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('should remove a category and return { deleted: true }', async () => {
      jest.spyOn(service, 'findOne').mockResolvedValue(mockCategory);
      (repo.remove as jest.Mock).mockResolvedValue(mockCategory);

      const result = await service.remove(categoryId, userId);

      expect(service.findOne).toHaveBeenCalledWith(categoryId, userId);
      expect(repo.remove).toHaveBeenCalledWith(mockCategory);
      expect(result).toEqual({ deleted: true });
    });

    it('should throw NotFoundException when removing non-existent category', async () => {
      jest.spyOn(service, 'findOne').mockImplementation(() => {
        throw new NotFoundException('Category not found');
      });

      await expect(service.remove('nonexistent-id', userId)).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
