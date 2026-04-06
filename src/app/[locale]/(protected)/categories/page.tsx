'use client';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';

interface Category {
  id: string;
  name: string;
  type: string;
  is_custom: boolean;
  is_active: boolean;
}

export default function CategoriesPage() {
  const t = useTranslations('categories');
  const searchParams = useSearchParams();
  const accountId = searchParams.get('account_id') ?? '';
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
    setCats((prev) => [...prev, data]);
    setName('');
    setAdding(false);
  }

  const income = cats.filter((c) => c.type === 'income');
  const expense = cats.filter((c) => c.type === 'expense');

  return (
    <div className="max-w-2xl">
      <h1 className="text-xl font-semibold mb-6">{t('title')}</h1>

      <div className="rounded-xl border border-white/[0.06] p-5 bg-white/[0.03] mb-6">
        <h2 className="font-medium mb-3">{t('addCustom')}</h2>
        <div className="flex gap-3">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t('name')}
            className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm"
          />
          <select
            value={type}
            onChange={(e) => setType(e.target.value as 'income' | 'expense')}
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm"
          >
            <option value="expense">{t('expense')}</option>
            <option value="income">{t('income')}</option>
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

      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-xl border border-white/[0.06] p-5 bg-white/[0.03]">
          <h3 className="font-medium text-emerald-400 mb-3">{t('income')}</h3>
          <ul className="space-y-1">
            {income.map((c) => (
              <li key={c.id} className="text-sm text-white/70 flex items-center gap-2">
                <span>{c.name}</span>
                {c.is_custom && <span className="text-xs text-emerald-400">{t('custom')}</span>}
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-xl border border-white/[0.06] p-5 bg-white/[0.03]">
          <h3 className="font-medium text-red-400 mb-3">{t('expense')}</h3>
          <ul className="space-y-1">
            {expense.map((c) => (
              <li key={c.id} className="text-sm text-white/70 flex items-center gap-2">
                <span>{c.name}</span>
                {c.is_custom && <span className="text-xs text-emerald-400">{t('custom')}</span>}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
