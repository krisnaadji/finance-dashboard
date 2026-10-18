import { createAdminClient } from '@/lib/supabase-server';
import { requireUser } from '@/lib/server-auth';
import { apiError, checkMutationRequest } from '@/lib/api-response';
import { requireResource } from '@/lib/resource-access';
import { isBusinessDate, parseAmount, parseFinancialJson } from '@/lib/financial-validation';
import { parseTransactionInput, validateTransactionCategory, transactionCategoryProjection } from '@/lib/transaction-validation';
import { NextResponse } from 'next/server';

const transactionSnapshotFields = ['amount', 'type', 'date', 'description', 'category_id'] as const;


export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireUser();
    if (!auth.ok) return auth.response;
    const requestError = checkMutationRequest(req, true);
    if (requestError) return requestError;
    let body: unknown;
    try {
      body = parseFinancialJson(await req.text());
    } catch {
      return apiError(400, 'invalid_request');
    }
    const input = parseTransactionInput(body, false);
    if (!input) return apiError(400, 'invalid_request');
    const { id } = await params;
    const resource = await requireResource('transactions', id, auth.user, false);
    if (!resource.ok) return resource.response;
    const old = resource.row;
    const amount = input.amount ?? parseAmount(old.amount);
    const type = input.type ?? old.type;
    const date = input.date ?? old.date;
    const description = input.description ?? old.description ?? '';
    const categoryId = Object.hasOwn(input, 'category_id') ? input.category_id ?? null : old.category_id;
    if (amount === null || (type !== 'income' && type !== 'expense') || !isBusinessDate(date) ||
        typeof description !== 'string' || (categoryId !== null && typeof categoryId !== 'string'))
      return apiError(400, 'invalid_request');
    const db = createAdminClient();
    const categoryError = await validateTransactionCategory(db, resource.access.accountId, type, categoryId,
      categoryId === old.category_id && type === old.type);
    if (categoryError) return categoryError;
    let update = db.from('transactions').update({
      ...input,
      edited_by_name: resource.access.displayName, updated_at: new Date().toISOString(),
    }).eq('id', id).eq('account_id', resource.access.accountId);
    for (const field of transactionSnapshotFields) {
      update = old[field] === null ? update.is(field, null) : update.eq(field, old[field]);
    }
    const updated = await update.select('*,amount_text:amount::text').maybeSingle();
    if (updated.error) return apiError(503, 'dependency_unavailable');
    if (!updated.data) return apiError(409, 'conflict');
    if (typeof updated.data.amount_text !== 'string') return apiError(503, 'dependency_unavailable');
    const { amount_text, ...row } = updated.data;
    const projection = await transactionCategoryProjection(db,resource.access.accountId,type,categoryId);
    return NextResponse.json({ ...row, description: row.description ?? '', amount: amount_text, ...projection });
  } catch {
    return apiError(500, 'internal_error');
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireUser();
    if (!auth.ok) return auth.response;
    const requestError = checkMutationRequest(req, false);
    if (requestError) return requestError;
    const { id } = await params;
    const resource = await requireResource('transactions', id, auth.user, true);
    if (!resource.ok) return resource.response;
    const removed = await createAdminClient().from('transactions').delete()
      .eq('id', id).eq('account_id', resource.access.accountId).select('id').maybeSingle();
    if (removed.error) return apiError(503, 'dependency_unavailable');
    if (!removed.data) return apiError(404, 'not_found');
    return NextResponse.json({ ok: true });
  } catch {
    return apiError(500, 'internal_error');
  }
}
