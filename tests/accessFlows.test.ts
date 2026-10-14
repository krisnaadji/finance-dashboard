import {beforeEach,expect,it} from 'vitest';
import {resetSecurityState,state} from './helpers/securityState';
import {ids} from './helpers/dashboardDb';
import {PATCH as displayName} from '../src/app/api/members/display-name/route';
import {POST as linkCode} from '../src/app/api/accounts/[id]/link-code/route';
import {POST as issueInvite} from '../src/app/api/accounts/[id]/invite/route';
import {POST as redeem} from '../src/app/api/invite/[token]/route';
import {GET as callback} from '../src/app/api/auth/callback/route';
beforeEach(()=>resetSecurityState(ids.owner));
it('profile updates only the caller and cannot claim a zero-row success',async()=>{
 const db=resetSecurityState(ids.member); const other=db.tables.members.find(r=>r.user_id===ids.owner)!.display_name;
 const req=()=>new Request('https://app.example/api/members/display-name',{method:'PATCH',headers:{'content-type':'application/json'},body:JSON.stringify({accountId:ids.a,displayName:'Edited'})});
 expect((await displayName(req())).status).toBe(200);
 expect(db.tables.members.find(r=>r.user_id===ids.owner)!.display_name).toBe(other);
 expect(db.tables.members.find(r=>r.user_id===ids.member)!.display_name).toBe('Edited');
 db.failures.push({table:'members',mode:'update',zero:true}); expect((await displayName(req())).status).toBe(404);
});
it.each([linkCode,issueInvite])('inactive accounts cannot issue credentials',async(handler)=>{
 const db=resetSecurityState(ids.owner); db.tables.accounts[0].is_active=false;
 expect((await handler(new Request('https://app.example/api/issue',{method:'POST'}),{params:Promise.resolve({id:ids.a})})).status).toBe(403);
 expect(db.tables.link_codes).toEqual([]); expect(db.tables.invite_tokens).toEqual([]);
});
it('inactive invitation target cannot grant membership or consume token',async()=>{
 const db=resetSecurityState(ids.outsider); db.tables.accounts[0].is_active=false;
 db.rpcOverride=async(name)=>name==='redeem_finance_invite'
  ? {data:{code:'forbidden'},error:null} : {data:null,error:{code:'08006'}};
 db.tables.invite_tokens=[{id:db.id(),account_id:ids.a,token:'fixture-token',used:false,expires_at:new Date(Date.now()+60000).toISOString()}];
 const before=db.tables.members.map(r=>({...r}));
 expect((await redeem(new Request('https://app.example/api/invite/fixture-token',{method:'POST'}),{params:Promise.resolve({token:'fixture-token'})})).status).toBe(403);
 expect(db.tables.members).toEqual(before); expect(db.tables.invite_tokens[0].used).toBe(false);
});
it('invitation procedure outage is not reported as success',async()=>{
 const db=resetSecurityState(ids.outsider);
 db.tables.invite_tokens=[{id:db.id(),account_id:ids.a,token:'fixture-token',used:false,expires_at:new Date(Date.now()+60000).toISOString()}];
 db.rpcOverride=async()=>({data:null,error:{code:'08006'}});
 expect((await redeem(new Request('https://app.example/api/invite/fixture-token',{method:'POST'}),{params:Promise.resolve({token:'fixture-token'})})).status).toBe(503);
 expect(db.tables.invite_tokens[0].used).toBe(false);
});
it.each(['https://outsider.example/','//outsider.example/','/\\outsider.example/'])('callback rejects external target %s',async(next)=>{
 expect((await callback(new Request(`https://app.example/api/auth/callback?code=fixture&next=${encodeURIComponent(next)}`))).status).toBe(400);
});
it('callback preserves English destination and does not mask exchange failure',async()=>{
 const good=await callback(new Request('https://app.example/api/auth/callback?code=fixture&next=%2Fen%2Ftransactions'));
 expect(good.headers.get('location')).toBe('https://app.example/en/transactions');
 state.exchangeError={status:503};
 const bad=await callback(new Request('https://app.example/api/auth/callback?code=fixture'));
 expect(bad.headers.get('location')).toBe('https://app.example/en/login?error=auth');
});
