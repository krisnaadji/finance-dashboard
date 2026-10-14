import { isBusinessDate, isRecord, isUuid } from './financial-validation';

export type Money = string;
export interface CategoryTotal { id: string | null; name: string; amount: Money }
export interface TopTransaction { id: string; date: string; description: string; amount: Money; category: string }
export interface Summary {
  income: Money;
  expense: Money;
  net: Money;
  categories: CategoryTotal[];
  spendingByCategoryId: Record<string, Money>;
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

function decodeCategory(value: unknown): CategoryTotal {
  if (!isRecord(value) || (value.id !== null && !isUuid(value.id)) ||
      typeof value.name !== 'string' || !validMoney(value.amount)) throw new Error('invalid_finance_report');
  return { id: value.id, name: value.name, amount: value.amount };
}

function decodeTopTransactions(value: unknown): TopTransaction[] {
  if (!Array.isArray(value)) throw new Error('invalid_finance_report');
  return value.map(row => {
    if (!isRecord(row) || !isUuid(row.id) || !isBusinessDate(row.date) ||
        typeof row.description !== 'string' || !validMoney(row.amount) || typeof row.category !== 'string')
      throw new Error('invalid_finance_report');
    return { id: row.id, date: row.date, description: row.description, amount: row.amount, category: row.category };
  });
}

export function decodeFinanceSummary(value: unknown): Summary {
  if (!isRecord(value) || !validMoney(value.income) || !validMoney(value.expense) ||
      !validMoney(value.net, true) || !Array.isArray(value.categories) || !isRecord(value.byMonth))
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
    categories: value.categories.map(decodeCategory),
    spendingByCategoryId: decodeMoneyMap(value.spendingByCategoryId),
    byMonth,
    topExpenses: decodeTopTransactions(value.topExpenses),
    topIncomes: decodeTopTransactions(value.topIncomes),
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
