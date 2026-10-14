import type { User } from '@supabase/supabase-js';
import { createAdminClient } from './supabase-server';
import { apiError } from './api-response';
import { isRecord, isUuid } from './financial-validation';
import { requireAccountMember, requireAccountOwner, type AccessSuccess, type ApiFailure } from './server-auth';
export type ResourceSuccess = AccessSuccess & { row: Record<string, unknown> };
export type ResourceResult = ResourceSuccess | ApiFailure;
export async function requireResource(table: 'transactions'|'categories'|'budgets', id: string, user: User, ownerOnly: boolean):
  Promise<ResourceResult> {
  if (!isUuid(id)) return { ok:false,response:apiError(400,'invalid_request') };
  const db = createAdminClient();
  const result = table === 'transactions'
    ? await db.from('transactions').select('*,amount_text:amount::text').eq('id', id).maybeSingle()
    : await db.from(table).select('*').eq('id', id).maybeSingle();
  if (result.error) return { ok:false,response:apiError(503,'dependency_unavailable') };
  if (!isRecord(result.data) || !isUuid(result.data.account_id)) return { ok:false,response:apiError(403,'forbidden') };
  if (table === 'transactions' && typeof result.data.amount_text !== 'string')
    return { ok:false,response:apiError(503,'dependency_unavailable') };
  const allowed = ownerOnly ? await requireAccountOwner(result.data.account_id,user) : await requireAccountMember(result.data.account_id,user);
  if (!allowed.ok) return allowed;
  const row = table === 'transactions' && isRecord(result.data)
    ? (({ amount_text, ...transaction }) => ({ ...transaction, amount: amount_text }))(result.data)
    : result.data;
  return { ...allowed,row };
}
