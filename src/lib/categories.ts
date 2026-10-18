import { isRecord, isUuid } from './financial-validation';

export type CategoryType = 'income' | 'expense';
export type CategoryLocale = 'id' | 'en';
export interface Category {
  id: string; account_id: string; code: string | null; name_id: string | null; name_en: string | null;
  parent_id: string | null; type: CategoryType; is_custom: boolean; is_active: boolean; sort_order: number;
}
export const CATEGORY_COLUMNS = 'id,account_id,code,name_id,name_en,parent_id,type,is_custom,is_active,sort_order';
export function categoryLabel(c: Pick<Category, 'name_id' | 'name_en'>, locale: CategoryLocale): string {
  return (locale === 'en' ? c.name_en?.trim() || c.name_id?.trim() : c.name_id?.trim() || c.name_en?.trim()) || '';
}
function rootFrom(c: Category, byId: ReadonlyMap<string, Category>): Category {
  if (!c.parent_id) return c;
  const parent = byId.get(c.parent_id);
  if (!parent || parent.parent_id !== null || parent.id === c.id || parent.account_id !== c.account_id || parent.type !== c.type || parent.code === 'salary')
    throw new Error('invalid_category_hierarchy');
  return parent;
}
export function categoryRoot(c: Category, categories: readonly Category[]): Category {
  return rootFrom(c, new Map(categories.map(row => [row.id, row])));
}
export function categoryPath(c: Category, categories: readonly Category[], locale: CategoryLocale): string {
  const root = categoryRoot(c, categories);
  return root.id === c.id ? categoryLabel(c, locale) : `${categoryLabel(root, locale)} / ${categoryLabel(c, locale)}`;
}
export function selectableCategories(categories: readonly Category[], type: CategoryType): Category[] {
  const byId = new Map(categories.map(row => [row.id, row]));
  return categories.filter(c => c.type === type && c.is_active && rootFrom(c, byId).is_active);
}
export function resolveCategoryId(id: string | null | undefined, type: CategoryType, categories: readonly Category[]): Category | null {
  if (id === null || id === undefined) return null;
  const c = selectableCategories(categories, type).find(row => row.id === id);
  if (!c) throw new Error('invalid_category_selection');
  return c;
}
export function decodeCategory(value: unknown): Category {
  if (!isRecord(value) || !isUuid(value.id) || !isUuid(value.account_id) ||
      (value.code !== null && typeof value.code !== 'string') ||
      (value.name_id !== null && typeof value.name_id !== 'string') ||
      (value.name_en !== null && typeof value.name_en !== 'string') ||
      !(typeof value.name_id === 'string' && value.name_id.trim() || typeof value.name_en === 'string' && value.name_en.trim()) ||
      (value.parent_id !== null && !isUuid(value.parent_id)) || (value.type !== 'income' && value.type !== 'expense') ||
      typeof value.is_custom !== 'boolean' || typeof value.is_active !== 'boolean' || !Number.isSafeInteger(value.sort_order))
    throw new Error('invalid_category');
  return {id:value.id,account_id:value.account_id,code:value.code,name_id:value.name_id,name_en:value.name_en,parent_id:value.parent_id,
    type:value.type,is_custom:value.is_custom,is_active:value.is_active,sort_order:value.sort_order as number};
}
