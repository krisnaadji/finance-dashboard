import { describe, expect, it } from 'vitest';
import { categoryLabel, categoryPath, categoryRoot, resolveCategoryId, selectableCategories, type Category } from '../src/lib/categories';
const root: Category = { id:'11111111-1111-4111-8111-111111111111',account_id:'22222222-2222-4222-8222-222222222222',code:'expense.food',name_id:'Makanan',name_en:'Food',parent_id:null,type:'expense',is_custom:false,is_active:true,sort_order:0 };
const child: Category = {...root,id:'33333333-3333-4333-8333-333333333333',code:null,parent_id:root.id,name_id:'Warung',name_en:'Dining'};
describe('category identity and history',()=>{
 it('falls back only for presentation and preserves inactive paths',()=>{ const inactive={...root,is_active:false}; expect(categoryLabel({...child,name_en:null},'en')).toBe('Warung'); expect(categoryPath(child,[inactive,child],'en')).toBe('Food / Dining'); expect(categoryRoot(child,[inactive,child])).toEqual(inactive); expect(selectableCategories([inactive,child],'expense')).toEqual([]); });
 it('resolves exact eligible identities, never unknown or disabled IDs',()=>{ expect(resolveCategoryId(null,'expense',[root,child])).toBeNull(); expect(resolveCategoryId(child.id,'expense',[root,child])).toEqual(child); expect(()=>resolveCategoryId('missing','expense',[root,child])).toThrow(); expect(()=>resolveCategoryId(child.id,'income',[root,child])).toThrow(); expect(()=>resolveCategoryId(child.id,'expense',[{...root,is_active:false},child])).toThrow(); });
 it('rejects corrupt foreign and missing parents instead of leaking labels',()=>{ expect(()=>categoryPath(child,[child],'id')).toThrow(); expect(()=>categoryRoot(child,[{...root,account_id:'foreign'},child])).toThrow(); });
});
