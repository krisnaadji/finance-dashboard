'use client';
import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { formatIDR, formatDate } from '@/lib/utils';
import { useAccountId } from '@/components/AccountSwitcher';

interface Transaction {
  id: string;
  date: string;
  description: string;
  amount: number;
  type: string;
  categories: { name: string } | null;
}
interface Category {
  id: string;
  name: string;
  type: string;
}
interface Props {
  transactions: Transaction[];
  onDelete: (id: string) => void;
  onUpdate: (txn: Transaction) => void;
}

export function TransactionTable({ transactions, onDelete, onUpdate }: Props) {
  const t = useTranslations('transactions');
  const accountId = useAccountId();
  const [cats, setCats] = useState<Category[]>([]);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({
    description: '',
    amount: '',
    type: 'expense',
    date: '',
    category_id: '',
  });
  const [saving, setSaving] = useState(false);

  // Load categories for the dropdown
  useEffect(() => {
    if (!accountId) return;
    fetch('/api/categories?account_id=' + accountId)
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setCats(data);
      });
  }, [accountId]);

  function startEdit(txn: Transaction) {
    setEditing(txn.id);
    const catMatch = cats.find((c) => c.name === txn.categories?.name);
    setEditForm({
      description: txn.description,
      amount: String(txn.amount),
      type: txn.type,
      date: txn.date.slice(0, 10),
      category_id: catMatch?.id ?? '',
    });
  }

  async function saveEdit(id: string) {
    setSaving(true);
    const res = await fetch('/api/transactions/' + id, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        description: editForm.description,
        amount: Number(editForm.amount),
        type: editForm.type,
        date: editForm.date,
        category_id: editForm.category_id || null,
      }),
    });
    const updated = await res.json();
    if (updated.id) onUpdate(updated);
    setSaving(false);
    setEditing(null);
  }

  async function handleDelete(id: string) {
    if (!confirm(t('confirmDelete'))) return;
    setDeleting(id);
    await fetch('/api/transactions/' + id, { method: 'DELETE' });
    setDeleting(null);
    onDelete(id);
  }

  if (!transactions.length)
    return <p className="text-center text-white/30 py-12 text-sm">{t('empty')}</p>;

  const inp =
    'bg-white/[0.06] border border-white/[0.1] text-white rounded-lg px-2 py-1.5 text-sm w-full';

  // Shared edit form JSX used in both mobile and desktop
  function EditForm({ id, mobile }: { id: string; mobile?: boolean }) {
    const filteredCats = cats.filter((c) => c.type === editForm.type);
    return (
      <div className={mobile ? 'space-y-2' : 'flex flex-wrap gap-2 items-center'}>
        <input
          className={inp + (mobile ? '' : ' flex-1 min-w-40')}
          placeholder="Description"
          value={editForm.description}
          onChange={(e) => setEditForm((f) => ({ ...f, description: e.target.value }))}
        />
        <input
          className={inp + (mobile ? '' : ' w-32')}
          type="number"
          placeholder="Amount"
          value={editForm.amount}
          onChange={(e) => setEditForm((f) => ({ ...f, amount: e.target.value }))}
        />
        <input
          className={inp + (mobile ? '' : ' w-36')}
          type="date"
          style={{ colorScheme: 'dark' }}
          value={editForm.date}
          onChange={(e) => setEditForm((f) => ({ ...f, date: e.target.value }))}
        />
        <select
          className={inp + (mobile ? '' : ' w-28')}
          value={editForm.type}
          onChange={(e) => setEditForm((f) => ({ ...f, type: e.target.value, category_id: '' }))}
        >
          <option value="expense" className="bg-[#1a1a1f]">
            {t('expense')}
          </option>
          <option value="income" className="bg-[#1a1a1f]">
            {t('income')}
          </option>
        </select>
        <select
          className={inp + (mobile ? '' : ' w-36')}
          value={editForm.category_id}
          onChange={(e) => setEditForm((f) => ({ ...f, category_id: e.target.value }))}
        >
          <option value="">— Category —</option>
          {filteredCats.map((c) => (
            <option key={c.id} value={c.id} className="bg-[#1a1a1f]">
              {c.name}
            </option>
          ))}
        </select>
        <div className={mobile ? 'flex gap-2 pt-1' : 'flex gap-2'}>
          <button
            onClick={() => saveEdit(id)}
            disabled={saving}
            className="rounded-lg bg-emerald-600 text-white px-3 py-1.5 text-sm disabled:opacity-40 whitespace-nowrap"
          >
            {saving ? '...' : 'Save'}
          </button>
          <button
            onClick={() => setEditing(null)}
            className="rounded-lg bg-white/[0.06] text-white/60 px-3 py-1.5 text-sm whitespace-nowrap"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* ── MOBILE: card view ── */}
      <div className="md:hidden divide-y divide-white/[0.06]">
        {transactions.map((txn) => (
          <div key={txn.id} className="p-4">
            {editing === txn.id ? (
              <EditForm id={txn.id} mobile />
            ) : (
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-white text-sm truncate">{txn.description}</p>
                  <p className="text-xs text-white/40 mt-0.5">
                    {formatDate(txn.date)} · {txn.categories?.name ?? '—'}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1.5 shrink-0">
                  <span
                    className={
                      'text-sm font-semibold ' +
                      (txn.type === 'income' ? 'text-emerald-400' : 'text-red-400')
                    }
                  >
                    {txn.type === 'income' ? '+' : '-'}
                    {formatIDR(txn.amount)}
                  </span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => startEdit(txn)}
                      className="text-xs text-white/30 hover:text-white/60"
                    >
                      {t('edit')}
                    </button>
                    <button
                      onClick={() => handleDelete(txn.id)}
                      disabled={deleting === txn.id}
                      className="text-xs text-red-400/60 hover:text-red-400 disabled:opacity-40"
                    >
                      {deleting === txn.id ? '...' : t('delete')}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* ── DESKTOP: table view ── */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-white/[0.08]">
            <tr>
              {[t('date'), t('description'), t('category'), t('type'), t('amount'), ''].map((h) => (
                <th
                  key={h}
                  className="text-left py-3 px-4 text-[11px] font-medium text-white/30 uppercase tracking-wider"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {transactions.map((txn) => (
              <tr key={txn.id} className="border-b border-white/[0.04] hover:bg-white/[0.03]">
                {editing === txn.id ? (
                  <td colSpan={6} className="px-4 py-3">
                    <EditForm id={txn.id} />
                  </td>
                ) : (
                  <>
                    <td className="px-4 py-3 text-white/40 text-xs whitespace-nowrap">
                      {formatDate(txn.date)}
                    </td>
                    <td className="px-4 py-3 text-white/80 font-medium">{txn.description}</td>
                    <td className="px-4 py-3 text-white/40">{txn.categories?.name ?? '—'}</td>
                    <td className="px-4 py-3">
                      <span
                        className={
                          'rounded-full px-2 py-0.5 text-xs font-medium ' +
                          (txn.type === 'income'
                            ? 'bg-emerald-500/10 text-emerald-400'
                            : 'bg-red-500/10 text-red-400')
                        }
                      >
                        {txn.type === 'income' ? t('income') : t('expense')}
                      </span>
                    </td>
                    <td
                      className={
                        'px-4 py-3 font-medium whitespace-nowrap ' +
                        (txn.type === 'income' ? 'text-emerald-400' : 'text-red-400')
                      }
                    >
                      {txn.type === 'income' ? '+' : '-'}
                      {formatIDR(txn.amount)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-3">
                        <button
                          onClick={() => startEdit(txn)}
                          className="text-xs text-white/30 hover:text-white/60"
                        >
                          {t('edit')}
                        </button>
                        <button
                          onClick={() => handleDelete(txn.id)}
                          disabled={deleting === txn.id}
                          className="text-xs text-red-400/60 hover:text-red-400 disabled:opacity-40"
                        >
                          {deleting === txn.id ? '...' : t('delete')}
                        </button>
                      </div>
                    </td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
