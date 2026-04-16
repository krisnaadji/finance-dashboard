'use client';
import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useAccountId, useAccountRole } from '@/components/AccountSwitcher';
import { formatIDR, startOfMonth, today } from '@/lib/utils';

interface Category {
  id: string;
  name: string;
  type: string;
  is_custom: boolean;
  is_active: boolean;
}

interface Budget {
  id: string;
  category_id: string;
  amount: number;
}

interface Spending {
  category_id: string;
  spent: number;
}

export default function CategoriesPage() {
  const t = useTranslations('categories');
  const accountId = useAccountId();
  const accountRole = useAccountRole();
  const isOwner = accountRole === 'owner';

  const [cats, setCats] = useState<Category[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [spending, setSpending] = useState<Spending[]>([]);
  const [name, setName] = useState('');
  const [type, setType] = useState<'income' | 'expense'>('expense');
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editBudget, setEditBudget] = useState('');
  const [deleting, setDeleting] = useState<string | null>(null);

  useEffect(() => {
    if (!accountId) return;
    Promise.all([
      fetch('/api/categories?account_id=' + accountId).then((r) => r.json()),
      fetch('/api/budgets?account_id=' + accountId).then((r) => r.json()),
      fetch(
        `/api/transactions?account_id=${accountId}&from=${startOfMonth()}&to=${today()}&page_size=99999`,
      ).then((r) => r.json()),
    ]).then(([catsData, budgetsData, txnsData]) => {
      if (Array.isArray(catsData)) setCats(catsData);
      if (Array.isArray(budgetsData)) setBudgets(budgetsData);
      const txns = txnsData.data ?? [];
      const spendMap: Record<string, number> = {};
      for (const txn of txns.filter((t: any) => t.type === 'expense')) {
        if (txn.category_id)
          spendMap[txn.category_id] = (spendMap[txn.category_id] ?? 0) + Number(txn.amount);
      }
      setSpending(Object.entries(spendMap).map(([category_id, spent]) => ({ category_id, spent })));
    });
  }, [accountId]);

  async function addCategory() {
    if (!name.trim() || !accountId) return;
    setAdding(true);
    const res = await fetch('/api/categories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ account_id: accountId, name: name.trim(), type }),
    });
    const data = await res.json();
    if (data.id) setCats((prev) => [...prev, data]);
    setName('');
    setAdding(false);
  }

  async function saveEdit(id: string) {
    const cat = cats.find((c) => c.id === id);

    // Only update name for custom categories
    if (cat?.is_custom) {
      const res = await fetch('/api/categories', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, name: editName.trim() }),
      });
      const data = await res.json();
      if (data.id)
        setCats((prev) => prev.map((c) => (c.id === id ? { ...c, name: data.name } : c)));
    }

    // Save or remove budget
    const budgetAmount = parseFloat(editBudget);
    const existingBudget = budgets.find((b) => b.category_id === id);

    if (!isNaN(budgetAmount) && budgetAmount > 0) {
      const bRes = await fetch('/api/budgets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ account_id: accountId, category_id: id, amount: budgetAmount }),
      });
      const bData = await bRes.json();
      if (bData.id) {
        setBudgets((prev) =>
          existingBudget ? prev.map((b) => (b.category_id === id ? bData : b)) : [...prev, bData],
        );
      }
    } else if (existingBudget && (isNaN(budgetAmount) || budgetAmount === 0)) {
      await fetch('/api/budgets?id=' + existingBudget.id, {
        method: 'DELETE',
        credentials: 'include',
      });
      setBudgets((prev) => prev.filter((b) => b.category_id !== id));
    }

    setEditingId(null);
  }

  async function deleteCategory(id: string) {
    if (!confirm('Delete this category?')) return;
    setDeleting(id);
    await fetch('/api/categories?id=' + id, { method: 'DELETE' });
    setCats((prev) => prev.filter((c) => c.id !== id));
    setDeleting(null);
  }

  function startEdit(c: Category) {
    setEditingId(c.id);
    setEditName(c.name);
    const budget = budgets.find((b) => b.category_id === c.id);
    setEditBudget(budget ? String(budget.amount) : '');
  }

  function getBudgetInfo(catId: string) {
    const budget = budgets.find((b) => b.category_id === catId);
    const spent = spending.find((s) => s.category_id === catId)?.spent ?? 0;
    if (!budget) return null;
    const pct = Math.min((spent / budget.amount) * 100, 100);
    const over = spent > budget.amount;
    return { budget, spent, pct, over };
  }

  const income = cats.filter((c) => c.type === 'income');
  const expense = cats.filter((c) => c.type === 'expense');

  if (!accountId)
    return (
      <div className="text-center py-20 text-white/30">
        <p className="text-4xl mb-3">◎</p>
        <p className="text-sm">Loading account...</p>
      </div>
    );

  function CategoryItem({ c }: { c: Category }) {
    const budgetInfo = c.type === 'expense' ? getBudgetInfo(c.id) : null;

    if (editingId === c.id) {
      return (
        <li className="space-y-2 py-2">
          {/* Name — custom only */}
          {c.is_custom && (
            <input
              className="w-full bg-white/[0.06] border border-white/[0.1] text-white rounded-lg px-2 py-1 text-sm"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && saveEdit(c.id)}
              autoFocus={c.is_custom}
              placeholder="Category name"
            />
          )}
          {/* Budget — expense only */}
          {c.type === 'expense' && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-white/40 whitespace-nowrap">Budget/mo</span>
              <input
                type="number"
                className="flex-1 bg-white/[0.06] border border-white/[0.1] text-white rounded-lg px-2 py-1 text-sm"
                placeholder="0 = no limit"
                value={editBudget}
                onChange={(e) => setEditBudget(e.target.value)}
                autoFocus={!c.is_custom}
              />
            </div>
          )}
          <div className="flex gap-2">
            <button
              onClick={() => saveEdit(c.id)}
              className="text-xs bg-emerald-600 text-white px-2 py-1 rounded-lg"
            >
              Save
            </button>
            <button onClick={() => setEditingId(null)} className="text-xs text-white/40 px-2 py-1">
              Cancel
            </button>
          </div>
        </li>
      );
    }

    return (
      <li className="py-1.5">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm text-white/80">{c.name}</span>
          <div className="flex items-center gap-2 shrink-0">
            {c.is_custom ? (
              <span className="text-[10px] bg-emerald-500/20 text-emerald-400 rounded px-1.5 py-0.5">
                Custom
              </span>
            ) : (
              <span className="text-[10px] text-white/20">Default</span>
            )}
            {/* Edit: show for owner on expense cats (budget) or custom cats (name) */}
            {isOwner && (c.type === 'expense' || c.is_custom) && (
              <button
                onClick={() => startEdit(c)}
                className="text-xs text-white/30 hover:text-white/60"
              >
                Edit
              </button>
            )}
            {/* Delete: custom only */}
            {isOwner && c.is_custom && (
              <button
                onClick={() => deleteCategory(c.id)}
                disabled={deleting === c.id}
                className="text-xs text-red-400/60 hover:text-red-400 disabled:opacity-40"
              >
                {deleting === c.id ? '...' : 'Delete'}
              </button>
            )}
          </div>
        </div>

        {/* Budget progress bar */}
        {budgetInfo && (
          <div className="mt-1.5">
            <div className="flex justify-between items-center mb-1">
              <span className={`text-[10px] ${budgetInfo.over ? 'text-red-400' : 'text-white/30'}`}>
                Rp{formatIDR(budgetInfo.spent)} / Rp{formatIDR(budgetInfo.budget.amount)}
                {budgetInfo.over && ' ⚠️'}
              </span>
              <span className={`text-[10px] ${budgetInfo.over ? 'text-red-400' : 'text-white/30'}`}>
                {Math.round((budgetInfo.spent / budgetInfo.budget.amount) * 100)}%
              </span>
            </div>
            <div className="h-1 rounded-full bg-white/[0.06] overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  budgetInfo.over
                    ? 'bg-red-500'
                    : budgetInfo.pct >= 80
                      ? 'bg-amber-500'
                      : 'bg-emerald-500'
                }`}
                style={{
                  width: `${Math.min((budgetInfo.spent / budgetInfo.budget.amount) * 100, 100)}%`,
                }}
              />
            </div>
          </div>
        )}

        {/* Hint for owner on expense cats with no budget */}
        {!budgetInfo && c.type === 'expense' && isOwner && (
          <p className="text-[10px] text-white/15 mt-0.5">No budget · click Edit to set</p>
        )}
      </li>
    );
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-xl font-semibold text-white mb-6">{t('title')}</h1>

      {/* Add custom category — owner only */}
      {isOwner && (
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-5 mb-6">
          <h2 className="font-medium text-white mb-3">{t('addCustom')}</h2>
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('name')}
              className="flex-1 rounded-lg border border-white/[0.1] bg-white/[0.06] text-white placeholder-white/30 px-3 py-2 text-sm"
            />
            <select
              value={type}
              onChange={(e) => setType(e.target.value as 'income' | 'expense')}
              className="rounded-lg border border-white/[0.1] bg-white/[0.06] text-white px-3 py-2 text-sm"
            >
              <option value="expense" className="bg-[#1a1a1f]">
                {t('expense')}
              </option>
              <option value="income" className="bg-[#1a1a1f]">
                {t('income')}
              </option>
            </select>
            <button
              onClick={addCategory}
              disabled={adding || !name.trim()}
              className="rounded-lg bg-emerald-600 text-white px-4 py-2 text-sm font-medium hover:bg-emerald-500 disabled:opacity-40 transition-colors"
            >
              {adding ? '...' : t('addCustom')}
            </button>
          </div>
        </div>
      )}

      {/* Category lists */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-5">
          <h3 className="font-medium text-emerald-400 mb-3">{t('income')}</h3>
          {income.length === 0 && <p className="text-white/30 text-sm">No categories yet</p>}
          <ul className="divide-y divide-white/[0.04]">
            {income.map((c) => (
              <CategoryItem key={c.id} c={c} />
            ))}
          </ul>
        </div>
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-5">
          <h3 className="font-medium text-red-400 mb-3">{t('expense')}</h3>
          {expense.length === 0 && <p className="text-white/30 text-sm">No categories yet</p>}
          <ul className="divide-y divide-white/[0.04]">
            {expense.map((c) => (
              <CategoryItem key={c.id} c={c} />
            ))}
          </ul>
        </div>
      </div>
      <p className="text-white/20 text-xs mt-4">
        Default categories are read-only. Add custom categories above.
      </p>
    </div>
  );
}
