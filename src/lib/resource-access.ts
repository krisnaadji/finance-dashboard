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
  const result = await createAdminClient().from(table).select('*').eq('id',id).maybeSingle();
  if (result.error) return { ok:false,response:apiError(503,'dependency_unavailable') };
  if (!isRecord(result.data) || !isUuid(result.data.account_id)) return { ok:false,response:apiError(403,'forbidden') };
  const allowed = ownerOnly ? await requireAccountOwner(result.data.account_id,user) : await requireAccountMember(result.data.account_id,user);
  if (!allowed.ok) return allowed;
  return { ...allowed,row:result.data };
}
