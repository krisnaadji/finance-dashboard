import { createAdminClient } from '@/lib/supabase-server';
import { NextResponse } from 'next/server';
import { requireUser, requireAccountMember, requireAccountOwner } from '@/lib/server-auth';
import { isUuid, isRecord, parseAmount, parseFinancialJson } from '@/lib/financial-validation';
import { apiError, checkMutationRequest } from '@/lib/api-response';
import { requireResource } from '@/lib/resource-access';
import { validateTransactionCategory } from '@/lib/transaction-validation';


// GET: list all budgets for an account
export async function GET(req: Request) {
  try {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;
  const { searchParams } = new URL(req.url);
  const accountId = searchParams.get('account_id');
  if (!isUuid(accountId)) return apiError(400, 'invalid_request');
  const access = await requireAccountMember(accountId, auth.user);
  if (!access.ok) return access.response;

  const admin = createAdminClient();
  const { data, error } = await admin.from('budgets').select('*').eq('account_id', accountId);
  if (error) return apiError(503, 'dependency_unavailable');

  return NextResponse.json(data ?? []);
  } catch {
    return apiError(500, 'internal_error');
  }
}

// POST: upsert budget for a category
export async function POST(req: Request) {
  try {
    const auth = await requireUser();
    if (!auth.ok) return auth.response;
    const check = checkMutationRequest(req, true);
    if (check) return check;
    const body = await req.text().then(parseFinancialJson).catch(() => null);
    if (!isRecord(body) || Object.keys(body).some(k => !['account_id', 'category_id', 'amount'].includes(k)) ||
        !isUuid(body.account_id) || !isUuid(body.category_id)) return apiError(400, 'invalid_request');
    const amount = parseAmount(body.amount);
    if (amount === null) return apiError(400, 'invalid_request');
    const access = await requireAccountOwner(body.account_id, auth.user);
    if (!access.ok) return access.response;
    const db = createAdminClient();
    const categoryError = await validateTransactionCategory(db, body.account_id, 'expense', body.category_id, false);
    if (categoryError) return categoryError;
    const saved = await db.from('budgets').upsert({
      account_id: body.account_id, category_id: body.category_id, amount, updated_at: new Date().toISOString(),
    }, { onConflict: 'account_id,category_id' }).select('*').single();
    if (saved.error) return apiError(503, 'dependency_unavailable');
    if (!saved.data) return apiError(404, 'not_found');
    return NextResponse.json(saved.data);
  } catch {
    return apiError(500, 'internal_error');
  }
}

// DELETE: remove budget
export async function DELETE(req: Request) {
  try {
    const auth = await requireUser();
    if (!auth.ok) return auth.response;
    const check = checkMutationRequest(req, false);
    if (check) return check;
    const id = new URL(req.url).searchParams.get('id');
    if (!isUuid(id)) return apiError(400, 'invalid_request');
    const resource = await requireResource('budgets', id, auth.user, true);
    if (!resource.ok) return resource.response;
    const removed = await createAdminClient().from('budgets').delete()
      .eq('id', id).eq('account_id', resource.access.accountId).select('id').maybeSingle();
    if (removed.error) return apiError(503, 'dependency_unavailable');
    if (!removed.data) return apiError(404, 'not_found');
    return NextResponse.json({ ok: true });
  } catch {
    return apiError(500, 'internal_error');
  }
}
