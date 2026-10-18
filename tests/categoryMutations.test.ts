import { expect, it } from 'vitest';
import { resetSecurityState } from './helpers/securityState';
import { ids } from './helpers/dashboardDb';
import * as categories from '../src/app/api/categories/route';
import { POST as budget } from '../src/app/api/budgets/route';
import { POST as transaction } from '../src/app/api/transactions/route';
import { PATCH as editTransaction } from '../src/app/api/transactions/[id]/route';
function request(method:string,body:unknown) {return new Request('https://app.example/api/categories',{method,headers:{origin:'https://app.example','content-type':'application/json'},body:JSON.stringify(body)});}
it('creates translated custom children with stable parent identity',async()=>{const db=resetSecurityState(ids.owner);const response=await categories.POST(request('POST',{account_id:ids.a,name_id:'Makan di Luar',name_en:'Dining Out',type:'expense',parent_id:ids.expense}));expect(response.status).toBe(200);expect(await response.json()).toMatchObject({account_id:ids.a,parent_id:ids.expense,name_id:'Makan di Luar',name_en:'Dining Out',is_custom:true,code:null});expect(db.tables.categories).toHaveLength(5);});
it.each([{parent_id:ids.foreign},{parent_id:ids.income},{parent_id:ids.inactive},{code:'salary'},{is_custom:false},{name:'Legacy alias'},{name_id:null,name_en:null}])('rejects invalid category create %j',async(extra)=>{const db=resetSecurityState(ids.owner);const before=structuredClone(db.tables.categories);const response=await categories.POST(request('POST',{account_id:ids.a,name_en:'New detail',type:'expense',...extra}));expect(response.status).toBe(400);expect(db.tables.categories).toEqual(before);});
it.each([{parent_id:ids.income},{account_id:ids.b},{type:'income'},{code:'expense.other'}])('rejects identity edits %j',async(extra)=>{const db=resetSecurityState(ids.owner);const before=structuredClone(db.tables.categories);expect((await categories.PATCH(request('PATCH',{id:ids.expense,name_en:'Changed',...extra}))).status).toBe(400);expect(db.tables.categories).toEqual(before);});
it('history includes inactive labels only when requested by a member',async()=>{resetSecurityState(ids.member);const url=`https://app.example/api/categories?account_id=${ids.a}`;expect((await (await categories.GET(new Request(url))).json()).some((c:{id:string})=>c.id===ids.inactive)).toBe(false);const response=await categories.GET(new Request(url+'&include_inactive=true'));expect(response.status).toBe(200);expect(await response.json()).toContainEqual(expect.objectContaining({id:ids.inactive,name_en:'Old Food',is_active:false}));resetSecurityState(ids.outsider);expect((await categories.GET(new Request(url+'&include_inactive=true'))).status).toBe(403);});
it('rejects child budgets and new selection under an inactive parent while retaining historical child edits',async()=>{const db=resetSecurityState(ids.owner);const childId=db.id();db.tables.categories.push({...db.tables.categories[0],id:childId,parent_id:ids.expense});expect((await budget(request('POST',{account_id:ids.a,category_id:childId,amount:'100.00'}))).status).toBe(400);db.tables.categories[0].is_active=false;expect((await transaction(request('POST',{account_id:ids.a,category_id:childId,type:'expense',amount:'0.01',date:'2026-10-12'}))).status).toBe(400);db.tables.transactions[0].category_id=childId;const edited=await editTransaction(request('PATCH',{description:'Retained history',category_id:childId,type:'expense'}),{params:Promise.resolve({id:ids.transaction})});expect(edited.status).toBe(200);expect(await edited.json()).toMatchObject({category_id:childId,categories:{id:childId},parent:{id:ids.expense,is_active:false},amount:'35.50'});expect(db.tables.budgets[0].amount).toBe('100.00');});
it('edits only supplied bilingual labels and preserves transaction references', async () => {
  const db = resetSecurityState(ids.owner);
  const history = structuredClone(db.tables.transactions);
  const response = await categories.PATCH(request('PATCH', {id:ids.expense,name_en:'Dining'}));
  expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({name_id:'Makanan',name_en:'Dining',id:ids.expense});
  expect(db.tables.transactions).toEqual(history);
  expect((await categories.PATCH(request('PATCH',{id:ids.expense,name_id:null}))).status).toBe(200);
  expect(db.tables.categories[0]).toMatchObject({name_id:null,name_en:'Dining'});
  expect((await categories.PATCH(request('PATCH',{id:ids.expense,name_en:null}))).status).toBe(400);
  expect((await categories.PATCH(request('PATCH',{id:ids.expense}))).status).toBe(400);
});
it('permits untranslated custom labels and soft-deactivates without changing history', async () => {
  const db = resetSecurityState(ids.owner);
  const response = await categories.POST(request('POST',{account_id:ids.a,name_id:'Kucing',type:'expense'}));
  expect(response.status).toBe(200);
  const row = await response.json();
  expect(row).toMatchObject({name_id:'Kucing',name_en:null,parent_id:null});
  db.tables.transactions[0].category_id=row.id;
  expect((await categories.DELETE(new Request(`https://app.example/api/categories?id=${row.id}`,{method:'DELETE'}))).status).toBe(200);
  expect(db.tables.categories.find(c=>c.id===row.id)).toMatchObject({is_active:false});
  expect(db.tables.transactions[0].category_id).toBe(row.id);
});
it('denies member category edits and salary children without writes', async () => {
  const db = resetSecurityState(ids.member);
  const before = structuredClone(db.tables.categories);
  expect((await categories.POST(request('POST',{account_id:ids.a,name_id:'Baru',type:'expense'}))).status).toBe(403);
  expect((await categories.PATCH(request('PATCH',{id:ids.expense,name_en:'Changed'}))).status).toBe(403);
  expect((await categories.DELETE(new Request(`https://app.example/api/categories?id=${ids.expense}`,{method:'DELETE'}))).status).toBe(403);
  expect(db.tables.categories).toEqual(before);
  const ownerDb = resetSecurityState(ids.owner);
  expect((await categories.POST(request('POST',{account_id:ids.a,name_en:'Salary detail',type:'income',parent_id:ids.income}))).status).toBe(400);
  expect(ownerDb.tables.categories).toHaveLength(4);
});
