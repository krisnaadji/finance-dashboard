'use client';
import { useState, useEffect, useRef } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { CategorySelector } from '@/components/CategorySelector';
import { categoryPath, type Category, type CategoryLocale, type CategoryType } from '@/lib/categories';
import { formatIDR, formatDate } from '@/lib/utils';
import { useAccountId } from '@/components/AccountSwitcher';

interface Transaction {
  id: string;
  date: string;
  description: string;
  amount: string;
  category_id: string | null;
  type: string;
  categories: Category | null;
  parent: Category | null;
  categoryProjectionError?: 'dependency_unavailable';
  recorded_by_name?: string;
  recorded_by_phone?: string;
  edited_by_name?: string;
}
interface Props {
  transactions: Transaction[];
  onDelete: (id: string) => void;
  onUpdate: (txn: Transaction) => void;
  isOwner?: boolean;
  isGroup?: boolean;
}

export function TransactionTable({ transactions, onDelete, onUpdate, isOwner, isGroup }: Props) {
  const t = useTranslations('transactions');
  const h = useTranslations('hierarchy');
  const locale = useLocale() as CategoryLocale;
  const accountId = useAccountId();
  const [error, setError] = useState('');
  const currentAccount = useRef(accountId);
  currentAccount.current = accountId;
  const [cats, setCats] = useState<Category[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [catalogError, setCatalogError] = useState(false);
  const [catalogTick, setCatalogTick] = useState(0);
  const editRevision = useRef(0);
  const catalogAccount = useRef('');
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

  useEffect(() => {
    if (catalogAccount.current !== accountId) {
      catalogAccount.current = accountId; editRevision.current++; setEditing(null); setCats([]); setError(''); setSaving(false); setDeleting(null);
    }
    if (!accountId) return;
    const controller = new AbortController(); setCatalogLoading(true); setCatalogError(false);
    fetch('/api/categories?include_inactive=true&account_id=' + accountId, { signal: controller.signal })
      .then(async r => { if (!r.ok) throw new Error(); return r.json(); })
      .then(data => { if (!controller.signal.aborted && Array.isArray(data)) setCats(data); })
      .catch(() => { if (!controller.signal.aborted) setCatalogError(true); })
      .finally(() => { if (!controller.signal.aborted) setCatalogLoading(false); });
    return () => controller.abort();
  }, [accountId, catalogTick]);

  function startEdit(txn: Transaction) {
    editRevision.current++;
    setSaving(false);
    setEditing(txn.id);
    setError('');
    setEditForm({
      description: txn.description,
      amount: String(txn.amount),
      type: txn.type,
      date: txn.date.slice(0, 10),
      category_id: txn.category_id ?? '',
    });
  }

  async function saveEdit(id: string) {
    setSaving(true); setError('');
    const account = accountId;
    const revision = editRevision.current;
    const original = transactions.find(txn => txn.id === id);
    try {
      const res = await fetch('/api/transactions/' + id, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description: editForm.description, amount: editForm.amount, type: editForm.type, date: editForm.date,
          ...((editForm.category_id || null) !== original?.category_id || editForm.type !== original?.type ? { category_id: editForm.category_id || null } : {}),
        }),
      });
      if (!res.ok) { if (res.status === 409 && account === currentAccount.current && revision === editRevision.current) { setError(h('editConflict')); return; } throw new Error(); }
      const updated = await res.json();
      if (account !== currentAccount.current || revision !== editRevision.current) return;
      onUpdate(updated); setEditing(null);
    } catch { if (account === currentAccount.current && revision === editRevision.current) setError(h('saveFailed')); }
    finally { if (account === currentAccount.current && revision === editRevision.current) setSaving(false); }
  }

  async function handleDelete(id: string) {
    if (!confirm(t('confirmDelete'))) return;
    const account = accountId; setDeleting(id); setError('');
    try {
      const response = await fetch('/api/transactions/' + id, { method: 'DELETE' });
      if (!response.ok) throw new Error();
      if (account === currentAccount.current) onDelete(id);
    } catch { if (account === currentAccount.current) setError(h('saveFailed')); }
    finally { if (account === currentAccount.current) setDeleting(null); }
  }

  if (!transactions.length)
    return <p className="text-center text-white/30 py-12 text-sm">{t('empty')}</p>;

  const inp =
    'min-h-11 bg-white/[0.06] border border-white/[0.1] text-white rounded-lg px-2 py-1.5 text-sm w-full box-border focus-visible:outline-emerald-400';

  // Shared edit form JSX used in both mobile and desktop.
  // Keep this as a render helper, not a nested component, so inputs are not
  // remounted on every keystroke and mobile keyboards keep focus.
  function renderEditForm(id: string, mobile?: boolean) {
    const original = transactions.find(txn => txn.id === id);
    const history = [original?.parent, original?.categories].filter((c): c is Category => !!c && !cats.some(option => option.id === c.id));
    return <fieldset disabled={saving} className={mobile ? 'space-y-3 w-full' : 'flex flex-wrap gap-3 items-end'}>
      <label className="block min-w-0 flex-1 text-sm text-white/70">{t('description')}
        <input className={inp} value={editForm.description} onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))} />
      </label>
      <label className="block min-w-0 text-sm text-white/70">{t('amount')}
        <input className={inp} inputMode="decimal" value={editForm.amount} onChange={e => setEditForm(f => ({ ...f, amount: e.target.value }))} />
      </label>
      <label className="block min-w-0 text-sm text-white/70">{t('date')}
        <input className={inp} type="date" style={{ colorScheme: 'dark', maxWidth: '100%', appearance: 'none' }} value={editForm.date} onChange={e => setEditForm(f => ({ ...f, date: e.target.value }))} />
      </label>
      <label className="block min-w-0 text-sm text-white/70">{t('type')}
        <select className={inp} value={editForm.type} onChange={e => setEditForm(f => ({ ...f, type: e.target.value, category_id: '' }))}>
          <option value="expense" className="bg-[#1a1a1f]">{t('expense')}</option>
          <option value="income" className="bg-[#1a1a1f]">{t('income')}</option>
        </select>
      </label>
      <CategorySelector categories={[...cats, ...history]} type={editForm.type as CategoryType} value={editForm.category_id || null} onChange={value => setEditForm(f => ({ ...f, category_id: value ?? '' }))} locale={locale} historicalValue={original?.categories} disabled={saving || catalogLoading || catalogError} />
      <div className="flex gap-2">
        <button type="button" onClick={() => saveEdit(id)} disabled={saving} className="min-h-11 rounded-lg bg-emerald-600 px-3 py-1.5 text-sm text-white disabled:opacity-40 focus-visible:outline-emerald-400">{h(saving ? 'saving' : 'save')}</button>
        <button type="button" onClick={() => { editRevision.current++; setEditing(null); }} className="min-h-11 rounded-lg bg-white/[0.06] px-3 py-1.5 text-sm text-white/80 focus-visible:outline-emerald-400">{h('cancel')}</button>
      </div>
    </fieldset>;
  }

  return (
    <div>
      {error && <p role="alert" className="p-3 text-red-300">{error}</p>}
      {catalogLoading && editing && <p role="status" className="p-3 text-white/70">{h('loading')}</p>}
      {catalogError && <div role="alert" className="p-3 text-red-300">{h('loadFailed')} <button type="button" onClick={() => setCatalogTick(n => n + 1)} className="min-h-11 rounded border border-white/20 px-3 text-white focus-visible:outline-emerald-400">{h('retry')}</button></div>}
      {/* ── MOBILE: card view ── */}
      <div className="md:hidden divide-y divide-white/[0.06]">
        {transactions.map((txn) => (
          <div key={txn.id} className="p-4">
            {editing === txn.id ? (
              renderEditForm(txn.id, true)
            ) : (
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-white text-sm truncate">{txn.description}</p>
                  <p className="text-xs text-white/40 mt-0.5">
                    {formatDate(txn.date, locale)} · {txn.categories ? categoryPath(txn.categories, txn.parent ? [txn.parent, txn.categories] : [txn.categories], locale) : h('uncategorized')}
                  </p>
                  {isGroup && txn.recorded_by_name && (
                    <p className="text-[10px] text-white/25 mt-0.5">by {txn.recorded_by_name}</p>
                  )}
                  {isGroup && txn.edited_by_name && (
                    <p className="text-[10px] text-white/20 mt-0.5">
                      edited by {txn.edited_by_name}
                    </p>
                  )}
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
                    <>
                        <button
                          onClick={() => startEdit(txn)}
                          className="min-h-11 min-w-11 text-xs text-white/80 hover:text-white focus-visible:outline-emerald-400"
                        >
                          {t('edit')}
                        </button>
                        {isOwner !== false && <button
                          onClick={() => handleDelete(txn.id)}
                          disabled={deleting === txn.id}
                          className="min-h-11 min-w-11 text-xs text-red-300 hover:text-red-200 disabled:opacity-40 focus-visible:outline-emerald-400"
                        >
                          {deleting === txn.id ? '...' : t('delete')}
                        </button>}
                    </>
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
                    {renderEditForm(txn.id)}
                  </td>
                ) : (
                  <>
                    <td className="px-4 py-3 text-white/40 text-xs whitespace-nowrap">
                      {formatDate(txn.date, locale)}
                    </td>
                    <td className="px-4 py-3 text-white/80 font-medium">{txn.description}</td>
                    <td className="px-4 py-3 text-white/70">{txn.categories ? categoryPath(txn.categories, txn.parent ? [txn.parent, txn.categories] : [txn.categories], locale) : h('uncategorized')}</td>
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
                      <>
                          <div className="flex gap-3">
                            <button
                              onClick={() => startEdit(txn)}
                              className="text-xs text-white/30 hover:text-white/60"
                            >
                              {t('edit')}
                            </button>
                            {isOwner !== false && <button
                              onClick={() => handleDelete(txn.id)}
                              disabled={deleting === txn.id}
                              className="text-xs text-red-400/60 hover:text-red-400 disabled:opacity-40"
                            >
                              {deleting === txn.id ? '...' : t('delete')}
                            </button>}
                          </div>
                      </>
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
