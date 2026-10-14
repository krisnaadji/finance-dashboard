import { isBusinessDate, isUuid } from './financial-validation';

export interface TransactionFilters {
  accountId: string;
  from: string | null;
  to: string | null;
  type: 'income' | 'expense' | null;
  categoryId: string | null;
  search: string | null;
}

export function parseTransactionFilters(params: URLSearchParams): TransactionFilters | null {
  const accountId = params.get('account_id');
  const rawFrom = params.get('from');
  const rawTo = params.get('to');
  const rawType = params.get('type');
  const rawCategoryId = params.get('category_id');
  const rawSearch = params.get('search');

  if (!isUuid(accountId) ||
      (rawFrom && !isBusinessDate(rawFrom)) ||
      (rawTo && !isBusinessDate(rawTo)) ||
      (rawFrom && rawTo && rawFrom > rawTo) ||
      (rawType && rawType !== 'income' && rawType !== 'expense') ||
      (rawCategoryId && !isUuid(rawCategoryId))) return null;

  return {
    accountId,
    from: rawFrom || null,
    to: rawTo || null,
    type: rawType ? rawType as 'income' | 'expense' : null,
    categoryId: rawCategoryId || null,
    search: rawSearch || null,
  };
}
