import { isBusinessDate, isRecord, isUuid } from './financial-validation';
import { decodeCategory, type Category } from './categories';

export type Money = string;
export interface CategoryTotal { id: string | null; name_id: string | null; name_en: string | null; amount: Money }
export interface CategoryDetail { parentId: string | null; categoryId: string | null; amount: Money }
export interface TopTransaction { id: string; date: string; description: string; amount: Money; category: Category | null; parent: Category | null }
export interface TransactionRow {
  id: string; account_id: string; date: string; description: string; amount: Money;
  type: 'income' | 'expense'; category_id: string | null; categories: Category | null; parent: Category | null;
  [key: string]: unknown;
}
export interface Summary {
  income: Money;
  expense: Money;
  net: Money;
  categories: CategoryTotal[];
  spendingByCategoryId: Record<string, Money>;
  categoryDetails: CategoryDetail[];
  byMonth: Record<string, { income: Money; expense: Money }>;
  topExpenses: TopTransaction[];
  topIncomes: TopTransaction[];
}
export interface BudgetSpending { spendingByCategoryId: Record<string, Money> }

const MONEY = /^(?:0|[1-9]\d*)\.\d{2}$/;
const SIGNED_MONEY = /^-?(?:0|[1-9]\d*)\.\d{2}$/;
const MONTH = /^\d{4}-(?:0[1-9]|1[0-2])$/;

function validMoney(value: unknown, signed = false): value is Money {
  return typeof value === 'string' && (signed ? SIGNED_MONEY : MONEY).test(value) && value !== '-0.00';
}

function decodeMoneyMap(value: unknown): Record<string, Money> {
  if (!isRecord(value)) throw new Error('invalid_finance_report');
  const result: Record<string, Money> = {};
  for (const [id, amount] of Object.entries(value)) {
    if (!isUuid(id) || !validMoney(amount)) throw new Error('invalid_finance_report');
    result[id] = amount;
  }
  return result;
}

function decodeCategoryTotal(value: unknown): CategoryTotal {
  if (!isRecord(value) || (value.id !== null && !isUuid(value.id)) ||
      (value.name_id !== null && typeof value.name_id !== 'string') ||
      (value.name_en !== null && typeof value.name_en !== 'string') ||
      (value.id !== null && !(typeof value.name_id === 'string' && value.name_id.trim() ||
        typeof value.name_en === 'string' && value.name_en.trim())) ||
      (value.id === null && (value.name_id !== null || value.name_en !== null)) ||
      !validMoney(value.amount)) throw new Error('invalid_finance_report');
  return { id: value.id, name_id: value.name_id, name_en: value.name_en, amount: value.amount };
}

function decodeCategoryDetail(value: unknown): CategoryDetail {
  if (!isRecord(value) || (value.parentId !== null && !isUuid(value.parentId)) ||
      (value.categoryId !== null && !isUuid(value.categoryId)) ||
      (value.parentId === null) !== (value.categoryId === null) || !validMoney(value.amount)) throw new Error('invalid_finance_report');
  return {parentId:value.parentId,categoryId:value.categoryId,amount:value.amount};
}

function decodeProjection(categoryValue: unknown, parentValue: unknown, accountId?: string, type?: 'income' | 'expense', categoryId?: string | null) {
  const category = categoryValue === null ? null : decodeCategory(categoryValue);
  const parent = parentValue === null ? null : decodeCategory(parentValue);
  if (!category) {
    if (parent) throw new Error('invalid_category_projection');
    return {category:null,parent:null};
  }
  if ((accountId !== undefined && category.account_id !== accountId) ||
      (type !== undefined && category.type !== type) ||
      (categoryId !== undefined && category.id !== categoryId)) throw new Error('invalid_category_projection');
  if (category.parent_id === null) {
    if (parent) throw new Error('invalid_category_projection');
  } else if (!parent || parent.id !== category.parent_id || parent.id === category.id ||
      parent.parent_id !== null || parent.account_id !== category.account_id ||
      parent.type !== category.type || parent.code === 'salary') throw new Error('invalid_category_projection');
  return {category,parent};
}

function decodeTopTransactions(value: unknown, type: 'income' | 'expense'): TopTransaction[] {
  if (!Array.isArray(value)) throw new Error('invalid_finance_report');
  return value.map(row => {
    if (!isRecord(row) || !isUuid(row.id) || !isBusinessDate(row.date) ||
        typeof row.description !== 'string' || !validMoney(row.amount))
      throw new Error('invalid_finance_report');
    const projection = decodeProjection(row.categories,row.parent,undefined,type);
    return { id: row.id, date: row.date, description: row.description, amount: row.amount, ...projection };
  });
}

export function decodeFinanceSummary(value: unknown): Summary {
  if (!isRecord(value) || !validMoney(value.income) || !validMoney(value.expense) ||
      !validMoney(value.net, true) || !Array.isArray(value.categories) || !Array.isArray(value.categoryDetails) || !isRecord(value.byMonth))
    throw new Error('invalid_finance_report');
  const byMonth: Summary['byMonth'] = {};
  for (const [month, totals] of Object.entries(value.byMonth)) {
    if (!MONTH.test(month) || !isRecord(totals) || !validMoney(totals.income) || !validMoney(totals.expense))
      throw new Error('invalid_finance_report');
    byMonth[month] = { income: totals.income, expense: totals.expense };
  }
  return {
    income: value.income,
    expense: value.expense,
    net: value.net,
    categories: value.categories.map(decodeCategoryTotal),
    categoryDetails: value.categoryDetails.map(decodeCategoryDetail),
    spendingByCategoryId: decodeMoneyMap(value.spendingByCategoryId),
    byMonth,
    topExpenses: decodeTopTransactions(value.topExpenses,'expense'),
    topIncomes: decodeTopTransactions(value.topIncomes,'income'),
  };
}

export function decodeFinanceBudgetSpending(value: unknown): BudgetSpending {
  if (!isRecord(value)) throw new Error('invalid_finance_budget_spending');
  try {
    return { spendingByCategoryId: decodeMoneyMap(value.spendingByCategoryId) };
  } catch {
    throw new Error('invalid_finance_budget_spending');
  }
}

export function decodeTransactionView(value: unknown): {
  rows: TransactionRow[]; total: number; summary: Pick<Summary, 'income' | 'expense' | 'net'>;
} {
  if (!isRecord(value) || !Array.isArray(value.rows) || !Number.isSafeInteger(value.total) ||
      (value.total as number) < value.rows.length ||
      !isRecord(value.summary) || !validMoney(value.summary.income) || !validMoney(value.summary.expense) ||
      !validMoney(value.summary.net, true)) throw new Error('invalid_transaction_view');
  const rows = value.rows.map(row => {
    if (!isRecord(row) || !isUuid(row.id) || !isUuid(row.account_id) || !isBusinessDate(row.date) ||
        (row.description !== null && typeof row.description !== 'string') ||
        !validMoney(row.amount) || (row.type !== 'income' && row.type !== 'expense') ||
        (row.category_id !== null && !isUuid(row.category_id))) throw new Error('invalid_transaction_view');
    const projection = decodeProjection(row.categories,row.parent,row.account_id,row.type,row.category_id);
    return {...row,description:row.description??'',categories:projection.category,parent:projection.parent} as TransactionRow;
  });
  return {rows,total:value.total as number,summary:{income:value.summary.income,expense:value.summary.expense,net:value.summary.net}};
}
