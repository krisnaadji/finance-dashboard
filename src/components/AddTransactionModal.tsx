'use client';
import { useEffect, useId, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { CategorySelector } from '@/components/CategorySelector';
import { categoryLabel, categoryPath, type Category, type CategoryLocale } from '@/lib/categories';
import { parseAmount } from '@/lib/financial-validation';
import { formatIDR, today } from '@/lib/utils';
import { GlassButton } from '@/components/ui/GlassButton';


interface Transaction {
  id: string;
  date: string;
  description: string;
  amount: string;
  type: string;
  categories: Category | null;
  parent: Category | null;
  category_id?: string | null;
  categoryProjectionError?: 'dependency_unavailable';
  recorded_by_name?: string;
  recorded_by_phone?: string;
  edited_by_name?: string;
}

interface BudgetWarning {
  category_name: string;
  category: Category;
  spent: string;
  limit: string;
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
  const h = useTranslations('hierarchy');
  const titleId = useId();
  const dialog = useRef<HTMLDivElement>(null);
  const requestRevision = useRef(0);
  const scope = useRef({ accountId, open });
  scope.current = { accountId, open };
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const locale = useLocale() as CategoryLocale;

  const [type, setType] = useState<'expense' | 'income'>('expense');
  const [date, setDate] = useState(today());
  const [amount, setAmount] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [description, setDescription] = useState('');

  const [cats, setCats] = useState<Category[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [catalogError, setCatalogError] = useState(false);
  const [catalogTick, setCatalogTick] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [savedNotice, setSavedNotice] = useState('');
  const [categoryUnavailable, setCategoryUnavailable] = useState(false);
  const [warning, setWarning] = useState<BudgetWarning | null>(null);
  const [successTxn, setSuccessTxn] = useState<Transaction | null>(null);

  useEffect(() => {
    setCats([]);
    setCategoryId('');
    if (!open || !accountId) return;
    const controller = new AbortController(); setCatalogLoading(true); setCatalogError(false);
    fetch('/api/categories?include_inactive=true&account_id=' + accountId, { signal: controller.signal })
      .then(async r => { if (!r.ok) throw new Error(); return r.json(); })
      .then(data => { if (!controller.signal.aborted && scope.current.accountId === accountId && scope.current.open && Array.isArray(data)) setCats(data); })
      .catch(() => { if (!controller.signal.aborted) setCatalogError(true); })
      .finally(() => { if (!controller.signal.aborted) setCatalogLoading(false); });
    return () => controller.abort();
  }, [open, accountId, catalogTick]);

  // Reset form every time the modal opens fresh
  useEffect(() => {
    requestRevision.current++;
    if (!open) return;
    setType('expense');
    setDate(today());
    setAmount('');
    setCategoryId('');
    setDescription('');
    setSaving(false);
    setError('');
    setSavedNotice(''); setCategoryUnavailable(false);
    setWarning(null);
    setSuccessTxn(null);
  }, [open, accountId]);

  // When type changes, clear the selected category if it no longer matches
  useEffect(() => {
    if (!categoryId) return;
    const cat = cats.find((c) => c.id === categoryId);
    if (cat && cat.type !== type) setCategoryId('');
  }, [type, categoryId, cats]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeRef.current();
      if (e.key !== 'Tab') return;
      const items = dialog.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled)');
      if (!items?.length) return;
      if (e.shiftKey && document.activeElement === items[0]) { e.preventDefault(); items[items.length - 1].focus(); }
      else if (!e.shiftKey && document.activeElement === items[items.length - 1]) { e.preventDefault(); items[0].focus(); }
    };
    dialog.current?.querySelector<HTMLElement>('button, input')?.focus();
    window.addEventListener('keydown', onKey);
    return () => { requestRevision.current++; window.removeEventListener('keydown', onKey); previous?.focus(); };
  }, [open, accountId]);

  if (!open) return null;


  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    const amt = parseAmount(amount);
    if (amt === null) {
      setError(t('amountInvalid'));
      return;
    }
    setSaving(true);
    const revision = ++requestRevision.current;
    const isCurrent = () => revision === requestRevision.current && scope.current.open && scope.current.accountId === accountId;
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
      if (!isCurrent()) return;
      if (!res.ok) {
        setError(data.error ?? t('saveFailed'));
        setSaving(false);
        return;
      }
      onCreated(data.transaction);
      if (data.budgetWarning || data.budgetWarningError || data.categoryProjectionError) {
        setWarning(data.budgetWarning ?? null);
        setCategoryUnavailable(!!data.categoryProjectionError);
        setSavedNotice([data.categoryProjectionError ? h('savedCategoryUnavailable') : '', data.budgetWarningError ? h('budgetWarningUnavailable') : ''].filter(Boolean).join(' '));
        setSuccessTxn(data.transaction); setSaving(false); return;
      }
      // Otherwise just close
      setSaving(false);
      onClose();
    } catch {
      if (isCurrent()) { setError(t('saveFailed')); setSaving(false); }
    }
  }

  return (
    <div
      className="fixed inset-0 z-[200] overflow-y-auto bg-black/70"
      onClick={onClose}
    >
      <div className="flex min-h-full items-start sm:items-center justify-center p-4 pt-8 sm:pt-4">
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-md">
      <div
        ref={dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="w-full p-5 shadow-2xl rounded-2xl border"
        style={{ background: 'rgba(8,12,16,0.97)', borderColor: 'rgba(255,255,255,0.12)' }}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 id={titleId} className="text-lg font-semibold text-white">{t('title')}</h2>
          <button
            onClick={onClose}
            className="text-white/40 hover:text-white/80 text-xl leading-none focus-visible:outline-emerald-400"
            aria-label={h('cancel')}
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
            <p>{t(warning.over ? 'budgetOver' : 'budgetNear', { category: categoryLabel(warning.category, locale), spent: formatIDR(warning.spent), limit: formatIDR(warning.limit), pct: warning.pct })}</p>
            {!categoryUnavailable && <p className="mt-2 break-words">{successTxn.categories ? categoryPath(successTxn.categories, successTxn.parent ? [successTxn.parent, successTxn.categories] : [successTxn.categories], locale) : h('uncategorized')}</p>}
            <div className="mt-3 flex justify-end">
              <GlassButton onClick={onClose}>OK</GlassButton>
            </div>
          </div>
        )}
        {successTxn && savedNotice && <div role="status" className="mb-4 text-sm text-amber-300"><p>{savedNotice}</p><GlassButton onClick={onClose}>{h('back')}</GlassButton></div>}

        {!successTxn && (
          <form onSubmit={handleSubmit} className="space-y-3"><fieldset disabled={saving} className="space-y-3">
            {/* Type toggle */}
            <div>
              <p className="text-xs text-white/40 mb-1">{t('type')}</p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setType('expense')}
                  aria-pressed={type === 'expense'}
                  className={`rounded-lg border px-3 py-2 text-sm transition-colors focus-visible:outline-emerald-400 ${
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
                  aria-pressed={type === 'income'}
                  className={`rounded-lg border px-3 py-2 text-sm transition-colors focus-visible:outline-emerald-400 ${
                    type === 'income'
                      ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
                      : 'border-white/[0.1] bg-white/[0.04] text-white/60 hover:bg-white/[0.08]'
                  }`}
                >
                  + {t('income')}
                </button>
              </div>
            </div>

            {/* Date */}
            <div>
              <label htmlFor={`${titleId}-date`} className="block text-xs text-white/40 mb-1">{t('date')}</label>
              <input
                type="date"
                id={`${titleId}-date`}
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
                className="w-full rounded-lg border border-white/[0.1] bg-white/[0.06] text-white px-3 py-2 text-sm [color-scheme:dark] appearance-none focus-visible:outline-emerald-400"
              />
            </div>

            {/* Amount */}
            <div>
              <label htmlFor={`${titleId}-amount`} className="block text-xs text-white/40 mb-1">{t('amount')}</label>
              <input
                type="number"
                id={`${titleId}-amount`}
                inputMode="decimal"
                min="0"
                step="any"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
                placeholder="0"
                className="w-full rounded-lg border border-white/[0.1] bg-white/[0.06] text-white px-3 py-2 text-sm [appearance:textfield] focus-visible:outline-emerald-400"
              />
            </div>

            {catalogLoading && <p role="status" className="text-sm text-white/70">{h('loading')}</p>}
            {catalogError && <div role="alert" className="text-sm text-red-300">{h('loadFailed')} <GlassButton onClick={() => setCatalogTick(n => n + 1)}>{h('retry')}</GlassButton></div>}
            <CategorySelector categories={cats} type={type} value={categoryId || null} onChange={id => setCategoryId(id ?? '')} locale={locale} disabled={saving || catalogLoading || catalogError} />

            {/* Description */}
            <div>
              <label htmlFor={`${titleId}-description`} className="block text-xs text-white/40 mb-1">{t('description')}</label>
              <input
                type="text"
                id={`${titleId}-description`}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={t('descriptionPlaceholder')}
                className="w-full rounded-lg border border-white/[0.1] bg-white/[0.06] text-white placeholder:text-white/20 px-3 py-2 text-sm focus-visible:outline-emerald-400"
              />
            </div>

            {error && (
              <p role="alert" className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <GlassButton type="button" variant="ghost" onClick={onClose}>
                {t('cancel')}
              </GlassButton>
              <GlassButton type="submit" variant="primary" disabled={saving} className="px-4 py-2">
                {saving ? t('saving') : t('save')}
              </GlassButton>
            </div>
          </fieldset></form>
        )}
      </div>
      </div>
      </div>
    </div>
  );
}
