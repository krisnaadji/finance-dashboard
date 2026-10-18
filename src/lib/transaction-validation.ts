import type { NextResponse } from 'next/server';
import { apiError } from './api-response';
import { isBusinessDate, isRecord, isUuid, parseAmount } from './financial-validation';
import type { SupabaseClient } from '@supabase/supabase-js';
import { CATEGORY_COLUMNS, decodeCategory, type Category } from './categories';
import type { TransactionFilters } from './transaction-filters';
export type TransactionInput = { account_id?: string; description?: string; amount?: string;
  type?: 'income'|'expense'; date?: string; category_id?: string|null };
const createKeys: Record<string, true> = { account_id: true, description: true, amount: true, type: true, date: true, category_id: true };
const editKeys: Record<string, true> = { description: true, amount: true, type: true, date: true, category_id: true };
export function parseTransactionInput(value: unknown, create: boolean): TransactionInput|null {
  if (!isRecord(value) || !Object.keys(value).length || Object.keys(value).some(k => !Object.hasOwn(create ? createKeys : editKeys, k))) return null;
  const result: TransactionInput = {};
  if (Object.hasOwn(value,'account_id')) { if (!isUuid(value.account_id)) return null; result.account_id = value.account_id; }
  if (Object.hasOwn(value,'description')) { if (typeof value.description !== 'string') return null; result.description = value.description; }
  if (Object.hasOwn(value,'amount')) { const amount = parseAmount(value.amount); if (amount===null) return null; result.amount = amount; }
  if (Object.hasOwn(value,'type')) { if (value.type!=='income' && value.type!=='expense') return null; result.type = value.type; }
  if (Object.hasOwn(value,'date')) { if (!isBusinessDate(value.date)) return null; result.date = value.date; }
  if (Object.hasOwn(value,'category_id')) { if (value.category_id!==null && !isUuid(value.category_id)) return null; result.category_id = value.category_id; }
  if (create && (!result.account_id || !result.amount || !result.type || !result.date)) return null;
  return result;
}
export async function validateTransactionCategory(
  db: SupabaseClient, accountId: string, type: 'income'|'expense',
  categoryId: string|null, allowInactive: boolean, rootOnly = false,
): Promise<NextResponse|null> {
  // Unchanged historical references are not new selections, including legacy corrupt references.
  if (allowInactive) return null;
  if (categoryId===null) return null;
  if (!isUuid(categoryId)) return apiError(400,'invalid_request');
  const category = await db.from('categories').select('id,account_id,type,is_active,parent_id,code').eq('id',categoryId).eq('account_id',accountId).maybeSingle();
  if (category.error) return apiError(503,'dependency_unavailable');
  if (!category.data || category.data.type!==type || category.data.is_active!==true ||
      (rootOnly && category.data.parent_id !== null)) return apiError(400,'invalid_request');
  if (category.data.parent_id) {
    const parent = await db.from('categories').select('id,type,is_active,parent_id,code').eq('id',category.data.parent_id).eq('account_id',accountId).maybeSingle();
    if (parent.error) return apiError(503,'dependency_unavailable');
    if (!parent.data || parent.data.type !== type || parent.data.is_active !== true || parent.data.parent_id !== null || parent.data.code === 'salary')
      return apiError(400,'invalid_request');
  }
  return null;
}

export async function transactionCategoryProjection(db: SupabaseClient, accountId: string, type: 'income'|'expense', id: string|null): Promise<{
  categories:Category|null;parent:Category|null;categoryProjectionError?:'dependency_unavailable';
}> {
  const empty = {categories:null,parent:null};
  if (!id) return empty;
  try {
    const selected = await db.from('categories').select(CATEGORY_COLUMNS).eq('id',id).eq('account_id',accountId).maybeSingle();
    if (selected.error) throw new Error('category_projection_unavailable');
    if (!selected.data || selected.data.type !== type) return empty;
    const categories = decodeCategory(selected.data);
    if (!categories.parent_id) return {categories,parent:null};
    const result = await db.from('categories').select(CATEGORY_COLUMNS).eq('id',categories.parent_id).eq('account_id',accountId).maybeSingle();
    if (result.error) throw new Error('category_projection_unavailable');
    if (!result.data || result.data.type !== type || result.data.parent_id !== null || result.data.code === 'salary') return empty;
    return {categories,parent:decodeCategory(result.data)};
  } catch {
    return {...empty,categoryProjectionError:'dependency_unavailable'};
  }
}
export async function validateTransactionFilters(db: SupabaseClient, filters: TransactionFilters, params: URLSearchParams) {
  if (!filters.categoryId) return null;
  const root = await db.from('categories').select('id,account_id,parent_id,type').eq('id', filters.categoryId)
    .eq('account_id', filters.accountId).maybeSingle();
  if (root.error) return apiError(503, 'dependency_unavailable');
  if (!root.data || (filters.type && root.data.type !== filters.type) ||
      (root.data.parent_id && (filters.subcategoryId || params.has('category_scope')))) return apiError(400, 'invalid_request');
  if (filters.subcategoryId) {
    const child = await db.from('categories').select('id,parent_id,type').eq('id', filters.subcategoryId)
      .eq('account_id', filters.accountId).maybeSingle();
    if (child.error) return apiError(503, 'dependency_unavailable');
    if (!child.data || child.data.parent_id !== root.data.id || child.data.type !== root.data.type) return apiError(400, 'invalid_request');
  }
  return null;
}
