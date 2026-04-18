'use client';
import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { formatIDR, today } from '@/lib/utils';

interface Category {
  id: string;
  name: string;
  type: string;
}

interface Transaction {
  id: string;
  date: string;
  description: string;
  amount: number;
  type: string;
  categories: { name: string } | null;
  recorded_by_name?: string;
  recorded_by_phone?: string;
  edited_by_name?: string;
}

interface BudgetWarning {
  category_name: string;
  spent: number;
  limit: number;
  pct: number;
  over: boolean;
}

interface Props {
  accountId: string;
  open: boolean;
  onClose: () => void;
  onCreated: (txn: Transaction) => void;
}

export function AddTransactionModal({ accountId, open, onClose, onCreated }: Props) {
  const t = useTranslations('addTransaction');

  const [type, setType] = useState<'expense' | 'income'>('expense');
  const [date, setDate] = useState(today());
  const [amount, setAmount] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [description, setDescription] = useState('');

  const [cats, setCats] = useState<Category[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [warning, setWarning] = useState<BudgetWarning | null>(null);
  const [successTxn, setSuccessTxn] = useState<Transaction | null>(null);

  // Load categories whenever the modal opens or account changes
  useEffect(() => {
    if (!open || !accountId) return;
    fetch('/api/categories?account_id=' + accountId)
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setCats(data);
      });
  }, [open, accountId]);

  // Reset form every time the modal opens fresh
  useEffect(() => {
    if (!open) return;
    setType('expense');
    setDate(today());
    setAmount('');
    setCategoryId('');
    setDescription('');
    setError('');
    setWarning(null);
    setSuccessTxn(null);
  }, [open]);

  // When type changes, clear the selected category if it no longer matches
  useEffect(() => {
    if (!categoryId) return;
    const cat = cats.find((c) => c.id === categoryId);
    if (cat && cat.type !== type) setCategoryId('');
  }, [type, categoryId, cats]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const filteredCats = cats.filter((c) => c.type === type);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    const amt = Number(amount);
    if (!amt || isNaN(amt) || amt <= 0) {
      setError(t('amountInvalid'));
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          account_id: accountId,
          type,
          amount: amt,
          date,
          description,
          category_id: categoryId || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? t('saveFailed'));
        setSaving(false);
        return;
      }
      // Notify parent immediately so lists/summaries refresh
      onCreated(data.transaction);
      // If there's a budget warning, keep the modal open to show it
      if (data.budgetWarning) {
        setWarning(data.budgetWarning);
        setSuccessTxn(data.transaction);
        setSaving(false);
        return;
      }
      // Otherwise just close
      onClose();
    } catch {
      setError(t('saveFailed'));
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-white/[0.08] bg-[#1a1a1f] p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white">{t('title')}</h2>
          <button
            onClick={onClose}
            className="text-white/40 hover:text-white/80 text-xl leading-none"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {/* Budget warning banner (shown after a successful save) */}
        {warning && successTxn && (
          <div
            className={`rounded-lg border p-3 mb-4 text-xs ${
              warning.over
                ? 'border-red-500/30 bg-red-500/10 text-red-300'
                : 'border-amber-500/30 bg-amber-500/10 text-amber-300'
            }`}
          >
            <p className="font-medium mb-1">
              {warning.over ? '⚠️ Over budget' : '⚠️ Near limit'}
            </p>
            <p>
              {warning.category_name}: Rp{formatIDR(warning.spent)} / Rp
              {formatIDR(warning.limit)} ({warning.pct}%)
            </p>
            <div className="mt-3 flex justify-end">
              <button
                onClick={onClose}
                className="rounded-lg bg-white/[0.08] border border-white/[0.12] text-white/80 px-3 py-1 text-xs hover:bg-white/[0.12]"
              >
                OK
              </button>
            </div>
          </div>
        )}

        {!successTxn && (
          <form onSubmit={handleSubmit} className="space-y-3">
            {/* Type toggle */}
            <div>
              <label className="block text-xs text-white/40 mb-1">{t('type')}</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setType('expense')}
                  className={`rounded-lg border px-3 py-2 text-sm transition-colors ${
                    type === 'expense'
                      ? 'border-red-500/40 bg-red-500/10 text-red-300'
                      : 'border-white/[0.1] bg-white/[0.04] text-white/60 hover:bg-white/[0.08]'
                  }`}
                >
                  − {t('expense')}
                </button>
                <button
                  type="button"
                  onClick={() => setType('income')}
                  className={`rounded-lg border px-3 py-2 text-sm transition-colors ${
                    type === 'income'
                      ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
                      : 'border-white/[0.1] bg-white/[0.04] text-white/60 hover:bg-white/[0.08]'
                  }`}
                >
                  + {t('income')}
                </button>
              </div>
            </div>

            {/* Date + Amount */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs text-white/40 mb-1">{t('date')}</label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  required
                  className="w-full rounded-lg border border-white/[0.1] bg-white/[0.06] text-white px-3 py-2 text-sm [color-scheme:dark]"
                />
              </div>
              <div>
                <label className="block text-xs text-white/40 mb-1">{t('amount')}</label>
                <input
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="any"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  required
                  placeholder="0"
                  className="w-full rounded-lg border border-white/[0.1] bg-white/[0.06] text-white px-3 py-2 text-sm [appearance:textfield]"
                />
              </div>
            </div>

            {/* Category */}
            <div>
              <label className="block text-xs text-white/40 mb-1">
                {t('categoryOptional')}
              </label>
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="w-full rounded-lg border border-white/[0.1] bg-white/[0.06] text-white px-3 py-2 text-sm"
              >
                <option value="" className="bg-[#1a1a1f]">
                  {t('categoryNone')}
                </option>
                {filteredCats.map((c) => (
                  <option key={c.id} value={c.id} className="bg-[#1a1a1f]">
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Description */}
            <div>
              <label className="block text-xs text-white/40 mb-1">{t('description')}</label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={t('descriptionPlaceholder')}
                className="w-full rounded-lg border border-white/[0.1] bg-white/[0.06] text-white placeholder:text-white/20 px-3 py-2 text-sm"
              />
            </div>

            {error && (
              <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg border border-white/[0.1] bg-white/[0.04] text-white/60 px-4 py-2 text-sm hover:bg-white/[0.08]"
              >
                {t('cancel')}
              </button>
              <button
                type="submit"
                disabled={saving}
                className="rounded-lg bg-emerald-600 text-white px-4 py-2 text-sm font-medium hover:bg-emerald-500 disabled:opacity-40 transition-colors"
              >
                {saving ? t('saving') : t('save')}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
