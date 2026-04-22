import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { CategoriesController } from './categories.controller';
import { CategoriesService } from './categories.service';

describe('CategoriesController', () => {
  let controller: CategoriesController;
  let service: jest.Mocked<CategoriesService>;

  const userId = 'user-123';
  const categoryId = 'cat-456';

  const mockRequest = { user: { id: userId } } as any;

  const mockCategory = {
    id: categoryId,
    name: 'Groceries',
    icon: '🛒',
    isDefault: false,
    userId,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    const mockService = {
      create: jest.fn(),
      findAll: jest.fn(),
      findOne: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [CategoriesController],
      providers: [{ provide: CategoriesService, useValue: mockService }],
    }).compile();

    controller = module.get<CategoriesController>(CategoriesController);
    service = module.get(CategoriesService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('create', () => {
    it('should call service.create with userId and dto', async () => {
      const dto = { name: 'Groceries', icon: '🛒' };
      service.create.mockResolvedValue(mockCategory as any);

      const result = await controller.create(mockRequest, dto);

      expect(service.create).toHaveBeenCalledWith(userId, dto);
      expect(result).toEqual(mockCategory);
    });
  });

  describe('findAll', () => {
    it('should call service.findAll with userId and query', async () => {
      const query = { page: 1, limit: 20 };
      const paginatedResult = {
        items: [mockCategory],
        total: 1,
        page: 1,
        limit: 20,
        totalPages: 1,
      };
      service.findAll.mockResolvedValue(paginatedResult as any);

      const result = await controller.findAll(mockRequest, query);

      expect(service.findAll).toHaveBeenCalledWith(userId, query);
      expect(result).toEqual(paginatedResult);
    });
  });

  describe('findOne', () => {
    it('should call service.findOne with id and userId', async () => {
      service.findOne.mockResolvedValue(mockCategory as any);

      const result = await controller.findOne(mockRequest, categoryId);

      expect(service.findOne).toHaveBeenCalledWith(categoryId, userId);
      expect(result).toEqual(mockCategory);
    });

    it('should propagate NotFoundException from service', async () => {
      service.findOne.mockRejectedValue(
        new NotFoundException('Category not found'),
      );

      await expect(
        controller.findOne(mockRequest, 'nonexistent-id'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('should call service.update with id, userId, and dto', async () => {
      const dto = { name: 'Meals' };
      const updated = { ...mockCategory, name: 'Meals' };
      service.update.mockResolvedValue(updated as any);

      const result = await controller.update(mockRequest, categoryId, dto);

      expect(service.update).toHaveBeenCalledWith(categoryId, userId, dto);
      expect(result).toEqual(updated);
    });

    it('should propagate NotFoundException from service', async () => {
      service.update.mockRejectedValue(
        new NotFoundException('Category not found'),
      );

      await expect(
        controller.update(mockRequest, 'nonexistent-id', { name: 'X' } as any),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('should call service.remove with id and userId', async () => {
      service.remove.mockResolvedValue({ deleted: true });

      const result = await controller.remove(mockRequest, categoryId);

      expect(service.remove).toHaveBeenCalledWith(categoryId, userId);
      expect(result).toEqual({ deleted: true });
    });

    it('should propagate NotFoundException from service', async () => {
      service.remove.mockRejectedValue(
        new NotFoundException('Category not found'),
      );

      await expect(
        controller.remove(mockRequest, 'nonexistent-id'),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
