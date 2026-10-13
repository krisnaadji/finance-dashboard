import type { NextResponse } from 'next/server';
import { apiError } from './api-response';
import { isBusinessDate, isRecord, isUuid, parseAmount } from './financial-validation';
import type { SupabaseClient } from '@supabase/supabase-js';
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
  categoryId: string|null, allowInactive: boolean,
): Promise<NextResponse|null> {
  if (categoryId===null) return null;
  if (!isUuid(categoryId)) return apiError(400,'invalid_request');
  const category = await db.from('categories').select('id,account_id,type,is_active').eq('id',categoryId).eq('account_id',accountId).maybeSingle();
  if (category.error) return apiError(503,'dependency_unavailable');
  if (!category.data || category.data.type!==type || (!allowInactive && category.data.is_active!==true)) return apiError(400,'invalid_request');
  return null;
}
