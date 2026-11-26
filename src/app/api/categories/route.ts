import { createAdminClient } from '@/lib/supabase-server';
import { NextResponse } from 'next/server';
import type { User } from '@supabase/supabase-js';
import { requireUser, requireAccountMember, requireAccountOwner } from '@/lib/server-auth';
import { isUuid, isRecord } from '@/lib/financial-validation';
import { apiError, checkMutationRequest } from '@/lib/api-response';
import { requireResource } from '@/lib/resource-access';
import { CATEGORY_COLUMNS, decodeCategory } from '@/lib/categories';

const labelKeys = ['name_id','name_en'] as const;

function labels(body: Record<string, unknown>, existing?: Record<string, unknown>) {
  const result: Partial<Record<(typeof labelKeys)[number], string|null>> = {};
  for (const key of labelKeys) {
    if (!Object.hasOwn(body,key)) continue;
    const value = body[key];
    if (value !== null && typeof value !== 'string') return null;
    if (typeof value === 'string') {
      const label = value.trim();
      if ([...label].length > 120 || /[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/u.test(label)) return null;
      result[key] = label || null;
    } else result[key] = null;
  }
  return labelKeys.some(key => {
    const value = Object.hasOwn(result,key) ? result[key] : existing?.[key];
    return typeof value === 'string' && value.trim();
  }) ? result : null;
}
function mutationError(code?: string) {
  if (code === '23505') return apiError(409,'conflict');
  if (code === '23514' || code === '23503' || code === '22023') return apiError(400,'invalid_request');
  return apiError(503,'dependency_unavailable');
}
export async function GET(req: Request) {
  try {
    const auth=await requireUser(); if(!auth.ok) return auth.response;
    const params=new URL(req.url).searchParams;
    const accountId=params.get('account_id');
    const inactive=params.get('include_inactive');
    if(!isUuid(accountId) || (inactive!==null && inactive!=='true' && inactive!=='false')) return apiError(400,'invalid_request');
    const access=await requireAccountMember(accountId,auth.user); if(!access.ok) return access.response;
    let query=createAdminClient().from('categories').select(CATEGORY_COLUMNS).eq('account_id',accountId);
    if(inactive!=='true') query=query.eq('is_active',true);
    const result=await query.order('type').order('sort_order').order('id');
    if(result.error) return apiError(503,'dependency_unavailable');
    try {
      const rows = (result.data??[]).map(decodeCategory);
      if (inactive==='true') return NextResponse.json(rows);
      const roots = new Set(rows.filter(row=>row.parent_id===null).map(row=>row.id));
      return NextResponse.json(rows.filter(row=>row.parent_id===null || roots.has(row.parent_id)));
    }
    catch { return apiError(503,'dependency_unavailable'); }
  } catch { return apiError(500,'internal_error'); }
}
export async function POST(req: Request) {
  try {
    const auth=await requireUser(); if(!auth.ok) return auth.response;
    const check=checkMutationRequest(req,true); if(check) return check;
    const body=await req.json().catch(()=>null);
    if(!isRecord(body) || Object.keys(body).some(k=>!['account_id','name_id','name_en','parent_id','type'].includes(k)) ||
      !isUuid(body.account_id) || (body.type!=='income' && body.type!=='expense') ||
      (body.parent_id!==undefined && body.parent_id!==null && !isUuid(body.parent_id))) return apiError(400,'invalid_request');
    const names=labels(body); if(!names) return apiError(400,'invalid_request');
    const access=await requireAccountOwner(body.account_id,auth.user); if(!access.ok) return access.response;
    const db=createAdminClient();
    if(body.parent_id) {
      const parent=await db.from('categories').select('id,type,parent_id,is_active,code').eq('account_id',body.account_id).eq('id',body.parent_id).maybeSingle();
      if(parent.error) return apiError(503,'dependency_unavailable');
      if(!parent.data || parent.data.type!==body.type || parent.data.parent_id!==null || !parent.data.is_active || parent.data.code==='salary') return apiError(400,'invalid_request');
    }
    const inserted=await db.from('categories').insert({account_id:body.account_id,name_id:names.name_id??null,name_en:names.name_en??null,parent_id:body.parent_id??null,type:body.type,is_custom:true,is_active:true}).select(CATEGORY_COLUMNS).single();
    if(inserted.error) return mutationError(inserted.error.code);
    if(!inserted.data) return apiError(404,'not_found');
    return NextResponse.json(decodeCategory(inserted.data));
  } catch { return apiError(500,'internal_error'); }
}
async function mutateCategory(id:string,user:User,patch:Record<string,unknown>|null) {
  const resource=await requireResource('categories',id,user,true); if(!resource.ok) return resource.response;
  if(resource.row.is_custom!==true) return apiError(403,'forbidden');
  const names=patch===null?null:labels(patch,resource.row);
  if(patch!==null && !names) return apiError(400,'invalid_request');
  const fields=patch===null?{is_active:false}:names!;
  const updated=await createAdminClient().from('categories').update(fields)
    .eq('id',id).eq('account_id',resource.access.accountId).eq('is_custom',true).select(CATEGORY_COLUMNS).maybeSingle();
  if(updated.error) return mutationError(updated.error.code);
  if(!updated.data) return apiError(404,'not_found');
  return NextResponse.json(names===null?{ok:true}:decodeCategory(updated.data));
}
export async function PATCH(req:Request) {
  try {
    const auth=await requireUser(); if(!auth.ok) return auth.response;
    const check=checkMutationRequest(req,true); if(check) return check;
    const body=await req.json().catch(()=>null);
    if(!isRecord(body) || Object.keys(body).some(k=>!['id','name_id','name_en'].includes(k)) || !isUuid(body.id) ||
      (!Object.hasOwn(body,'name_id') && !Object.hasOwn(body,'name_en'))) return apiError(400,'invalid_request');
    return await mutateCategory(body.id,auth.user,body);
  } catch { return apiError(500,'internal_error'); }
}
export async function DELETE(req:Request) {
  try {
    const auth=await requireUser(); if(!auth.ok) return auth.response;
    const check=checkMutationRequest(req,false); if(check) return check;
    const id=new URL(req.url).searchParams.get('id'); if(!isUuid(id)) return apiError(400,'invalid_request');
    return await mutateCategory(id,auth.user,null);
  } catch { return apiError(500,'internal_error'); }
}
