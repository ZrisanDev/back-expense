export const CATEGORY_EXPENSE_CHECK_PORT = 'CATEGORY_EXPENSE_CHECK_PORT';

export interface CategoryExpenseCheckPort {
  countByCategoryId(categoryId: string): Promise<number>;
}
