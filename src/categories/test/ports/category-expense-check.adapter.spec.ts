import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Expense } from '../../../expenses/entities/expense.entity';
import { CategoryExpenseCheckAdapter } from '../../ports/category-expense-check.adapter';

describe('CategoryExpenseCheckAdapter', () => {
  let adapter: CategoryExpenseCheckAdapter;
  let expenseRepo: jest.Mocked<Repository<Expense>>;

  const mockExpenseQueryBuilder: any = {
    where: jest.fn().mockReturnThis(),
    getCount: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CategoryExpenseCheckAdapter,
        {
          provide: getRepositoryToken(Expense),
          useValue: {
            createQueryBuilder: jest.fn(() => mockExpenseQueryBuilder),
          },
        },
      ],
    }).compile();

    adapter = module.get<CategoryExpenseCheckAdapter>(
      CategoryExpenseCheckAdapter,
    );
    expenseRepo = module.get(getRepositoryToken(Expense));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(adapter).toBeDefined();
  });

  it('should return count when expenses reference the category', async () => {
    mockExpenseQueryBuilder.getCount.mockResolvedValue(3);

    const result = await adapter.countByCategoryId('cat-456');

    expect(result).toBe(3);
    expect(expenseRepo.createQueryBuilder).toHaveBeenCalledWith('expense');
    expect(mockExpenseQueryBuilder.where).toHaveBeenCalledWith(
      'expense.categoryId = :categoryId',
      { categoryId: 'cat-456' },
    );
  });

  it('should return 0 when no expenses reference the category', async () => {
    mockExpenseQueryBuilder.getCount.mockResolvedValue(0);

    const result = await adapter.countByCategoryId('cat-789');

    expect(result).toBe(0);
  });
});
