import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConflictException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { CreateCategoryUseCase } from '../../use-cases/create-category.use-case';
import { Category } from '../../entities/category.entity';
import { CreateCategoryDto } from '../../dto/create-category.dto';
import { User } from '../../../users/entities/user.entity';

describe('CreateCategoryUseCase', () => {
  let useCase: CreateCategoryUseCase;
  let repo: jest.Mocked<Repository<Category>>;

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

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CreateCategoryUseCase,
        {
          provide: getRepositoryToken(Category),
          useValue: {
            findOne: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
          },
        },
      ],
    }).compile();

    useCase = module.get<CreateCategoryUseCase>(CreateCategoryUseCase);
    repo = module.get(getRepositoryToken(Category));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(useCase).toBeDefined();
  });

  describe('execute', () => {
    it('should create and save a non-default category with userId', async () => {
      const dto: CreateCategoryDto = {
        name: 'Groceries',
        icon: '🛒',
        isDefault: false,
      };
      (repo.findOne as jest.Mock).mockResolvedValue(null);
      (repo.create as jest.Mock).mockReturnValue({ ...dto, userId });
      (repo.save as jest.Mock).mockResolvedValue(mockCategory);

      const result = await useCase.execute(userId, dto);

      expect(repo.findOne).toHaveBeenCalledWith({
        where: { userId, name: 'Groceries', isDefault: false },
      });
      expect(repo.create).toHaveBeenCalledWith({ ...dto, userId });
      expect(repo.save).toHaveBeenCalledWith({ ...dto, userId });
      expect(result).toEqual(mockCategory);
    });

    it('should create a category without optional fields', async () => {
      const dto: CreateCategoryDto = { name: 'Transport' };
      (repo.findOne as jest.Mock).mockResolvedValue(null);
      (repo.create as jest.Mock).mockReturnValue({ ...dto, userId });
      (repo.save as jest.Mock).mockResolvedValue({
        ...mockCategory,
        name: 'Transport',
        icon: undefined,
        isDefault: undefined,
      });

      const result = await useCase.execute(userId, dto);

      expect(repo.create).toHaveBeenCalledWith({ ...dto, userId });
      expect(result.name).toBe('Transport');
    });

    it('should throw ConflictException on duplicate name for non-default', async () => {
      const dto: CreateCategoryDto = {
        name: 'Groceries',
        icon: '🛒',
        isDefault: false,
      };
      (repo.findOne as jest.Mock).mockResolvedValue(mockCategory);

      await expect(useCase.execute(userId, dto)).rejects.toThrow(
        ConflictException,
      );
      await expect(useCase.execute(userId, dto)).rejects.toThrow(
        'Category with this name already exists',
      );
      expect(repo.save).not.toHaveBeenCalled();
    });

    it('should skip duplicate check for default categories', async () => {
      const dto: CreateCategoryDto = {
        name: 'Food',
        icon: '🍔',
        isDefault: true,
      };
      const systemUserId = 'system';
      (repo.create as jest.Mock).mockReturnValue({
        ...dto,
        userId: systemUserId,
      });
      (repo.save as jest.Mock).mockResolvedValue(mockCategory);

      const result = await useCase.execute(systemUserId, dto);

      expect(repo.findOne).not.toHaveBeenCalled();
      expect(repo.create).toHaveBeenCalled();
      expect(result).toEqual(mockCategory);
    });
  });
});
