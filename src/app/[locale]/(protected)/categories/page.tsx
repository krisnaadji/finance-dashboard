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
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [deleting, setDeleting] = useState<string | null>(null);

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

  async function saveEdit(id: string) {
    const res = await fetch('/api/categories', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, name: editName.trim() }),
    });
    const data = await res.json();
    if (data.id) setCats((prev) => prev.map((c) => (c.id === id ? { ...c, name: data.name } : c)));
    setEditingId(null);
  }

  async function deleteCategory(id: string) {
    if (!confirm('Delete this category?')) return;
    setDeleting(id);
    await fetch('/api/categories?id=' + id, { method: 'DELETE' });
    setCats((prev) => prev.filter((c) => c.id !== id));
    setDeleting(null);
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
              <li key={c.id} className="flex items-center justify-between gap-2">
                {editingId === c.id ? (
                  // Edit mode
                  <div className="flex gap-2 flex-1">
                    <input
                      className="flex-1 bg-white/[0.06] border border-white/[0.1] text-white rounded-lg px-2 py-1 text-sm"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && saveEdit(c.id)}
                      autoFocus
                    />
                    <button
                      onClick={() => saveEdit(c.id)}
                      className="text-xs bg-emerald-600 text-white px-2 py-1 rounded-lg"
                    >
                      Save
                    </button>
                    <button
                      onClick={() => setEditingId(null)}
                      className="text-xs text-white/40 px-2 py-1"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  // View mode
                  <>
                    <span className="text-sm text-white/80">{c.name}</span>
                    <div className="flex items-center gap-2">
                      {c.is_custom ? (
                        <span className="text-[10px] bg-emerald-500/20 text-emerald-400 rounded px-1.5 py-0.5">
                          Custom
                        </span>
                      ) : (
                        <span className="text-[10px] text-white/20">Default</span>
                      )}
                      {c.is_custom && (
                        <button
                          onClick={() => {
                            setEditingId(c.id);
                            setEditName(c.name);
                          }}
                          className="text-xs text-white/30 hover:text-white/60"
                        >
                          Edit
                        </button>
                      )}
                      {c.is_custom && (
                        <button
                          onClick={() => deleteCategory(c.id)}
                          disabled={deleting === c.id}
                          className="text-xs text-red-400/60 hover:text-red-400 disabled:opacity-40"
                        >
                          {deleting === c.id ? '...' : 'Delete'}
                        </button>
                      )}
                    </div>
                  </>
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
              <li key={c.id} className="flex items-center justify-between gap-2">
                {editingId === c.id ? (
                  // Edit mode
                  <div className="flex gap-2 flex-1">
                    <input
                      className="flex-1 bg-white/[0.06] border border-white/[0.1] text-white rounded-lg px-2 py-1 text-sm"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && saveEdit(c.id)}
                      autoFocus
                    />
                    <button
                      onClick={() => saveEdit(c.id)}
                      className="text-xs bg-emerald-600 text-white px-2 py-1 rounded-lg"
                    >
                      Save
                    </button>
                    <button
                      onClick={() => setEditingId(null)}
                      className="text-xs text-white/40 px-2 py-1"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  // View mode
                  <>
                    <span className="text-sm text-white/80">{c.name}</span>
                    <div className="flex items-center gap-2">
                      {c.is_custom ? (
                        <span className="text-[10px] bg-emerald-500/20 text-emerald-400 rounded px-1.5 py-0.5">
                          Custom
                        </span>
                      ) : (
                        <span className="text-[10px] text-white/20">Default</span>
                      )}
                      {c.is_custom && (
                        <button
                          onClick={() => {
                            setEditingId(c.id);
                            setEditName(c.name);
                          }}
                          className="text-xs text-white/30 hover:text-white/60"
                        >
                          Edit
                        </button>
                      )}
                      {c.is_custom && (
                        <button
                          onClick={() => deleteCategory(c.id)}
                          disabled={deleting === c.id}
                          className="text-xs text-red-400/60 hover:text-red-400 disabled:opacity-40"
                        >
                          {deleting === c.id ? '...' : 'Delete'}
                        </button>
                      )}
                    </div>
                  </>
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
