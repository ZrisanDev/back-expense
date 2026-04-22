import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { ExpensesService } from './expenses.service';
import { Expense, ExpenseStatus } from './entities/expense.entity';

describe('ExpensesService', () => {
  let service: ExpensesService;
  let repo: jest.Mocked<Repository<Expense>>;

  const userId = 'user-123';
  const expenseId = 'exp-456';

  const mockExpense: Partial<Expense> = {
    id: expenseId,
    userId,
    amount: 50.0,
    currency: 'USD',
    categoryId: 'cat-789',
    vendor: 'Coffee Shop',
    date: '2024-01-15',
    status: ExpenseStatus.NEEDS_REVIEW,
    isDuplicateSuspect: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockQueryBuilder: any = {
    leftJoinAndSelect: jest.fn().mockReturnThis(),
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
        ExpensesService,
        {
          provide: getRepositoryToken(Expense),
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

    service = module.get<ExpensesService>(ExpensesService);
    repo = module.get(getRepositoryToken(Expense));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create an expense without duplicate warning', async () => {
      const dto = {
        amount: 50.0,
        currency: 'USD',
        vendor: 'Coffee Shop',
        date: '2024-01-15',
      };
      (repo.findOne as jest.Mock).mockResolvedValue(null);
      (repo.create as jest.Mock).mockReturnValue({
        ...dto,
        userId,
        isDuplicateSuspect: false,
      });
      (repo.save as jest.Mock).mockResolvedValue({
        ...mockExpense,
        ...dto,
      });

      const result = await service.create(userId, dto as any);

      expect(repo.findOne).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            userId,
            amount: dto.amount,
            date: dto.date,
            vendor: dto.vendor,
          }),
        }),
      );
      expect(repo.create).toHaveBeenCalledWith({
        ...dto,
        userId,
        isDuplicateSuspect: false,
      });
      expect(repo.save).toHaveBeenCalled();
      expect(result.duplicateWarning).toBeNull();
    });

    it('should create expense with duplicate warning when duplicate found', async () => {
      const dto = {
        amount: 50.0,
        currency: 'USD',
        vendor: 'Coffee Shop',
        date: '2024-01-15',
      };
      const duplicateExpense = { ...mockExpense, id: 'exp-previous' };
      (repo.findOne as jest.Mock).mockResolvedValue(duplicateExpense);
      (repo.create as jest.Mock).mockReturnValue({
        ...dto,
        userId,
        isDuplicateSuspect: true,
      });
      (repo.save as jest.Mock).mockResolvedValue({
        ...mockExpense,
        isDuplicateSuspect: true,
      });

      const result = await service.create(userId, dto as any);

      expect(result.duplicateWarning).toBe(
        `Possible duplicate of expense ${duplicateExpense.id}`,
      );
    });
  });

  describe('findAll', () => {
    it('should return paginated expenses for user', async () => {
      const query = {
        page: 1,
        limit: 20,
        sortBy: 'createdAt',
        sortOrder: 'DESC' as const,
      };
      const items = [mockExpense];
      mockQueryBuilder.getManyAndCount.mockResolvedValue([items, 1]);

      const result = await service.findAll(userId, query);

      expect(repo.createQueryBuilder).toHaveBeenCalledWith('expense');
      expect(mockQueryBuilder.where).toHaveBeenCalledWith(
        'expense.userId = :userId',
        {
          userId,
        },
      );
      expect(result).toEqual({
        items,
        total: 1,
        page: 1,
        limit: 20,
        totalPages: 1,
      });
    });

    it('should apply status filter when provided', async () => {
      const query = { status: ExpenseStatus.NEEDS_REVIEW };
      mockQueryBuilder.getManyAndCount.mockResolvedValue([[mockExpense], 1]);

      await service.findAll(userId, query);

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'expense.status = :status',
        { status: ExpenseStatus.NEEDS_REVIEW },
      );
    });

    it('should apply vendor search filter when provided', async () => {
      const query = { vendor: 'coffee' };
      mockQueryBuilder.getManyAndCount.mockResolvedValue([[mockExpense], 1]);

      await service.findAll(userId, query);

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'expense.vendor ILIKE :vendor',
        { vendor: '%coffee%' },
      );
    });
  });

  describe('findOne', () => {
    it('should return an expense owned by the user', async () => {
      (repo.findOne as jest.Mock).mockResolvedValue(mockExpense);

      const result = await service.findOne(expenseId, userId);

      expect(repo.findOne).toHaveBeenCalledWith({
        where: { id: expenseId, userId },
        relations: ['category'],
      });
      expect(result).toEqual(mockExpense);
    });

    it('should throw NotFoundException when expense not found', async () => {
      (repo.findOne as jest.Mock).mockResolvedValue(null);

      await expect(service.findOne('nonexistent-id', userId)).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.findOne('nonexistent-id', userId)).rejects.toThrow(
        'Expense not found',
      );
    });
  });

  describe('update', () => {
    it('should update an expense in NEEDS_REVIEW status', async () => {
      jest.spyOn(service, 'findOne').mockResolvedValue(mockExpense as Expense);
      (repo.save as jest.Mock).mockResolvedValue({
        ...mockExpense,
        amount: 75.0,
      });

      const result = await service.update(expenseId, userId, { amount: 75.0 });

      expect(service.findOne).toHaveBeenCalledWith(expenseId, userId);
      expect(repo.save).toHaveBeenCalledWith(
        expect.objectContaining({ amount: 75.0 }),
      );
    });

    it('should throw BadRequestException when expense status is not editable', async () => {
      const approvedExpense = {
        ...mockExpense,
        status: ExpenseStatus.APPROVED,
      };
      jest
        .spyOn(service, 'findOne')
        .mockResolvedValue(approvedExpense as Expense);

      await expect(
        service.update(expenseId, userId, { amount: 75.0 }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('approve', () => {
    it('should approve an expense in NEEDS_REVIEW status', async () => {
      jest.spyOn(service, 'findOne').mockResolvedValue(mockExpense as Expense);
      (repo.save as jest.Mock).mockResolvedValue({
        ...mockExpense,
        status: ExpenseStatus.APPROVED,
      });

      const result = await service.approve(expenseId, userId);

      expect(service.findOne).toHaveBeenCalledWith(expenseId, userId);
      expect(repo.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: ExpenseStatus.APPROVED }),
      );
    });

    it('should throw BadRequestException when expense is not in NEEDS_REVIEW', async () => {
      const uploadedExpense = {
        ...mockExpense,
        status: ExpenseStatus.UPLOADED,
      };
      jest
        .spyOn(service, 'findOne')
        .mockResolvedValue(uploadedExpense as Expense);

      await expect(service.approve(expenseId, userId)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('remove', () => {
    it('should remove an expense and return { deleted: true }', async () => {
      jest.spyOn(service, 'findOne').mockResolvedValue(mockExpense as Expense);
      (repo.remove as jest.Mock).mockResolvedValue(mockExpense);

      const result = await service.remove(expenseId, userId);

      expect(service.findOne).toHaveBeenCalledWith(expenseId, userId);
      expect(repo.remove).toHaveBeenCalledWith(mockExpense);
      expect(result).toEqual({ deleted: true });
    });

    it('should throw NotFoundException when removing non-existent expense', async () => {
      jest.spyOn(service, 'findOne').mockImplementation(() => {
        throw new NotFoundException('Expense not found');
      });

      await expect(service.remove('nonexistent-id', userId)).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
