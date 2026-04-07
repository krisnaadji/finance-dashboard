'use client';
import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useAccountId } from '@/components/AccountSwitcher';

interface Category {
  id: string;
  name: string;
  type: string;
  is_custom: boolean;
  is_active: boolean;
}

export default function CategoriesPage() {
  const t = useTranslations('categories');
  const accountId = useAccountId();

  const [cats, setCats] = useState<Category[]>([]);
  const [name, setName] = useState('');
  const [type, setType] = useState<'income' | 'expense'>('expense');
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    if (!accountId) return;
    fetch('/api/categories?account_id=' + accountId)
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setCats(data);
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

  const income = cats.filter((c) => c.type === 'income');
  const expense = cats.filter((c) => c.type === 'expense');

  if (!accountId)
    return (
      <div className="text-center py-20 text-white/30">
        <p className="text-4xl mb-3">◎</p>
        <p className="text-sm">Loading account...</p>
      </div>
    );

  return (
    <div className="max-w-2xl">
      <h1 className="text-xl font-semibold text-white mb-6">{t('title')}</h1>

      {/* Add custom category */}
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

      {/* Category lists — default + custom */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-5">
          <h3 className="font-medium text-emerald-400 mb-3">{t('income')}</h3>
          {income.length === 0 && <p className="text-white/30 text-sm">No categories yet</p>}
          <ul className="space-y-2">
            {income.map((c) => (
              <li key={c.id} className="flex items-center justify-between">
                <span className="text-sm text-white/80">{c.name}</span>
                {c.is_custom ? (
                  <span className="text-[10px] bg-emerald-500/20 text-emerald-400 rounded px-1.5 py-0.5">
                    Custom
                  </span>
                ) : (
                  <span className="text-[10px] text-white/20">Default</span>
                )}
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-5">
          <h3 className="font-medium text-red-400 mb-3">{t('expense')}</h3>
          {expense.length === 0 && <p className="text-white/30 text-sm">No categories yet</p>}
          <ul className="space-y-2">
            {expense.map((c) => (
              <li key={c.id} className="flex items-center justify-between">
                <span className="text-sm text-white/80">{c.name}</span>
                {c.is_custom ? (
                  <span className="text-[10px] bg-emerald-500/20 text-emerald-400 rounded px-1.5 py-0.5">
                    Custom
                  </span>
                ) : (
                  <span className="text-[10px] text-white/20">Default</span>
                )}
              </li>
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
