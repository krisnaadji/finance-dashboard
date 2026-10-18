import { isBusinessDate, isUuid } from './financial-validation';

export interface TransactionFilters {
  accountId: string;
  from: string | null;
  to: string | null;
  type: 'income' | 'expense' | null;
  categoryId: string | null;
  subcategoryId: string | null;
  categoryScope: 'all' | 'direct';
  locale: 'id' | 'en';
  search: string | null;
}

export function parseTransactionFilters(params: URLSearchParams): TransactionFilters | null {
  for (const key of ['account_id','from','to','type','category_id','subcategory_id','category_scope','locale','search']) {
    if (params.getAll(key).length > 1) return null;
  }
  const accountId = params.get('account_id');
  const rawFrom = params.get('from');
  const rawTo = params.get('to');
  const rawType = params.get('type');
  const rawCategoryId = params.get('category_id');
  const rawSearch = params.get('search');
  const subcategoryId = params.get('subcategory_id');
  const scope = params.get('category_scope');
  const locale = params.get('locale');

  if (!isUuid(accountId) ||
      (rawFrom !== null && !isBusinessDate(rawFrom)) ||
      (rawTo !== null && !isBusinessDate(rawTo)) ||
      (rawFrom && rawTo && rawFrom > rawTo) ||
      (rawType !== null && rawType !== 'income' && rawType !== 'expense') ||
      (rawCategoryId !== null && !isUuid(rawCategoryId)) ||
      (subcategoryId !== null && !isUuid(subcategoryId)) ||
      (scope !== null && scope !== 'all' && scope !== 'direct') ||
      (locale !== null && locale !== 'id' && locale !== 'en') ||
      (scope !== null && !rawCategoryId) ||
      (subcategoryId && (!rawCategoryId || scope === 'direct'))) return null;

  return {
    accountId,
    from: rawFrom || null,
    to: rawTo || null,
    type: rawType ? rawType as 'income' | 'expense' : null,
    categoryId: rawCategoryId || null,
    subcategoryId,
    categoryScope: scope === 'direct' ? 'direct' : 'all',
    locale: locale === 'en' ? 'en' : 'id',
    search: rawSearch || null,
  };
}
