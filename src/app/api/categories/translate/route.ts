import { NextResponse } from 'next/server';
import { requireUser, requireAccountOwner } from '@/lib/server-auth';
import { apiError, checkMutationRequest } from '@/lib/api-response';
import { createAdminClient } from '@/lib/supabase-server';
import { isRecord, isUuid } from '@/lib/financial-validation';
import { CategoryTranslationError, translateCategoryName, validCategoryLabel } from '@/lib/category-translation';

export async function POST(req: Request) {
  try {
    const auth=await requireUser(); if(!auth.ok) return auth.response;
    const check=checkMutationRequest(req,true); if(check) return check;
    const declared=req.headers.get('content-length');
    if(declared!==null && (!/^\d+$/.test(declared) || Number(declared)>4096)) return apiError(400,'invalid_request');
    if(!req.body) return apiError(400,'invalid_request');
    const reader=req.body.getReader();
    const chunks:Uint8Array[]=[];
    let size=0;
    try {
      while(true) {
        const part=await reader.read(); if(part.done) break;
        size+=part.value.byteLength;
        if(size>4096) {await reader.cancel(); return apiError(400,'invalid_request');}
        chunks.push(part.value);
      }
    } finally {reader.releaseLock();}
    const bytes=new Uint8Array(size);let offset=0;
    for(const chunk of chunks) {bytes.set(chunk,offset);offset+=chunk.length;}
    let body:unknown;
    try {body=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));} catch {return apiError(400,'invalid_request');}
    if(!isRecord(body) || Object.keys(body).some(k=>!['account_id','name','source','target'].includes(k)) ||
      !isUuid(body.account_id) || !validCategoryLabel(body.name) ||
      (body.source!=='id' && body.source!=='en') || (body.target!=='id' && body.target!=='en') || body.source===body.target) return apiError(400,'invalid_request');
    const access=await requireAccountOwner(body.account_id,auth.user);if(!access.ok) return access.response;
    const quota=await createAdminClient().rpc('reserve_category_translation',{p_user_id:auth.user.id,p_account_id:body.account_id});
    if(quota.error || typeof quota.data!=='boolean') return apiError(503,'dependency_unavailable');
    if(!quota.data) return apiError(429,'rate_limited');
    return NextResponse.json({translation:await translateCategoryName({name:body.name.trim(),source:body.source,target:body.target})});
  } catch(error) {
    if(error instanceof CategoryTranslationError) return apiError(error.status,error.status===504?'translation_timeout':'translation_unavailable');
    return apiError(503,'dependency_unavailable');
  }
}
