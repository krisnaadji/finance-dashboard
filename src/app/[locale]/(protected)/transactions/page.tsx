'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useAccountId, useAccountRole, useAccountType } from '@/components/AccountSwitcher';
import { TransactionTable } from '@/components/TransactionTable';
import { AddTransactionModal } from '@/components/AddTransactionModal';
import { PeriodControl, createInitialPeriodValue, type PeriodValue } from '@/components/PeriodControl';
import { GlassCard } from '@/components/ui/GlassCard';
import { GlassButton } from '@/components/ui/GlassButton';
import { categoryLabel, categoryPath, type Category, type CategoryLocale } from '@/lib/categories';
import type { Summary, TransactionRow } from '@/lib/reporting-contract';
import { parseTransactionFilters } from '@/lib/transaction-filters';
import { formatIDR } from '@/lib/utils';

const control = 'min-h-11 min-w-0 rounded-lg border border-white/20 bg-[#141a20] px-3 py-2 text-sm text-white focus-visible:outline-emerald-400';
function initialQuery() { return typeof window === 'undefined' ? new URLSearchParams() : new URLSearchParams(window.location.search); }

export default function TransactionsPage() {
  const t = useTranslations('transactions'); const h = useTranslations('hierarchy');
  const locale = useLocale() as CategoryLocale;
  const accountId = useAccountId(); const owner = useAccountRole() === 'owner'; const group = useAccountType() === 'group';
  const [period, setPeriod] = useState<PeriodValue>(() => createInitialPeriodValue(new Date(), true));
  const [type, setType] = useState(() => { const value = initialQuery().get('type'); return value === 'income' || value === 'expense' ? value : ''; });
  const [categoryId, setCategoryId] = useState(''); const [detail, setDetail] = useState('');
  const [search, setSearch] = useState(() => initialQuery().get('search') ?? '');
  const [draftSearch, setDraftSearch] = useState(search);
  const [categories, setCategories] = useState<Category[]>([]); const [categoryAccount, setCategoryAccount] = useState('');
  const [rows, setRows] = useState<TransactionRow[]>([]); const [summary, setSummary] = useState<Pick<Summary, 'income' | 'expense' | 'net'> | null>(null);
  const [total, setTotal] = useState(0); const [page, setPage] = useState(1); const [size, setSize] = useState(20);
  const [loading, setLoading] = useState(false); const [error, setError] = useState(''); const [filterNotice, setFilterNotice] = useState('');
  const [tick, setTick] = useState(0); const [addOpen, setAddOpen] = useState(false);
  const [catalogTick, setCatalogTick] = useState(0);
  const [catalogError, setCatalogError] = useState(false);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const catalogScope = useRef('');
  const catalogRequest = useRef('');
  catalogRequest.current = `${accountId}|${catalogTick}`;
  const [exporting, setExporting] = useState(false); const [exportError, setExportError] = useState('');
  const [savedNotice, setSavedNotice] = useState('');
  const restored = useRef(false); const currentKey = useRef('');
  const restoredQuery = useRef(initialQuery());
  const periodReady = period.valid && (period.mode !== 'salary_cycle' || period.resolvedAccountId === accountId);
  useEffect(() => {
    const switchingAccount = catalogScope.current !== accountId;
    catalogScope.current = accountId;
    if (switchingAccount) {
      setCategories([]); setCategoryId(''); setDetail(''); setCategoryAccount(''); setRows([]); setSummary(null); setTotal(0); setAddOpen(false); setPage(1); setSavedNotice('');
    }
    if (!accountId) { setCatalogLoading(false); return; }
    const requested = `${accountId}|${catalogTick}`;
    const controller = new AbortController(); setCatalogError(false); setCatalogLoading(true);
    fetch(`/api/categories?account_id=${accountId}&include_inactive=true`, { signal: controller.signal })
      .then(async r => { if (!r.ok) throw new Error(); return r.json(); })
      .then((cats: Category[]) => {
        if (controller.signal.aborted || catalogRequest.current !== requested) return;
        setCategories(cats); setCategoryAccount(accountId);
        if (!restored.current) {
          restored.current = true; const q = restoredQuery.current; const requested = q.get('category_id');
          const category = cats.find(c => c.id === requested && (!q.get('type') || c.type === q.get('type')));
          if (requested && category && (!q.get('account_id') || q.get('account_id') === accountId)) {
            setCategoryId(category.id);
            const child = q.get('subcategory_id');
            if (child && cats.some(c => c.id === child && c.parent_id === category.id && c.type === category.type)) setDetail(child);
            else if (!category.parent_id && q.get('category_scope') === 'direct') setDetail('direct');
            else if (child) setFilterNotice(h('filtersReset'));
          } else if (requested) setFilterNotice(h('filtersReset'));
        }
      }).catch(() => { if (!controller.signal.aborted && catalogRequest.current === requested) setCatalogError(true); })
      .finally(() => { if (!controller.signal.aborted && catalogRequest.current === requested) setCatalogLoading(false); });
    return () => controller.abort();
  }, [accountId, h, catalogTick]);
  const params = useMemo(() => {
    if (!accountId || categoryAccount !== accountId || !periodReady || catalogLoading || catalogError) return null;
    const q = new URLSearchParams({ account_id: accountId, from: period.from, to: period.to, locale });
    if (type) q.set('type', type); if (search.trim()) q.set('search', search.trim());
    if (categoryId) { q.set('category_id', categoryId); if (detail === 'direct') q.set('category_scope', 'direct'); else if (detail) q.set('subcategory_id', detail); }
    return parseTransactionFilters(q) ? q.toString() : null;
  }, [accountId, categoryAccount, periodReady, period.from, period.to, locale, type, search, categoryId, detail, catalogLoading, catalogError]);
  const key = `${params}|${page}|${size}|${tick}`; currentKey.current = key;
  useEffect(() => { setPage(1); }, [params, size]);
  useEffect(() => {
    setRows([]); setTotal(0); setSummary(null);
    if (!params) { setLoading(false); return; }
    const controller = new AbortController(); const requested = key; setLoading(true); setError('');
    fetch(`/api/transactions?${params}&page=${page}&page_size=${size}`, { signal: controller.signal })
      .then(async r => { if (!r.ok) throw new Error(); return r.json(); })
      .then(data => { if (!controller.signal.aborted && currentKey.current === requested) { setRows(data.data); setTotal(data.total); setSummary(data.summary); } })
      .catch(() => { if (!controller.signal.aborted && currentKey.current === requested) setError(h('loadFailed')); })
      .finally(() => { if (!controller.signal.aborted && currentKey.current === requested) setLoading(false); });
    return () => controller.abort();
  }, [params, page, size, tick, key, h]);
  useEffect(() => {
    if (!params) return;
    const url = new URL(window.location.href); const normalized = new URLSearchParams(params);
    for (const name of ['account_id', 'type', 'category_id', 'subcategory_id', 'category_scope', 'search']) {
      const value = normalized.get(name); if (value) url.searchParams.set(name, value); else url.searchParams.delete(name);
    }
    window.history.replaceState(null, '', url);
  }, [params]);
  async function exportCSV() {
    if (!params || exporting) return;
    const requested = key; setExporting(true); setExportError('');
    try {
      const r = await fetch(`/api/transactions/export?${params}`);
      if (!r.ok) { const body = await r.json().catch(() => null); throw new Error(body?.code === 'export_limit_exceeded' ? t('exportLimitExceeded') : t('exportFailed')); }
      const blob = await r.blob(); if (currentKey.current !== requested) return;
      const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `transactions-${period.from}-${period.to}.csv`; a.click(); window.setTimeout(() => URL.revokeObjectURL(url), 0);
    } catch (e) { if (currentKey.current === requested) setExportError(e instanceof Error ? e.message : t('exportFailed')); }
    finally { setExporting(false); }
  }
  const parent = categories.find(c => c.id === categoryId); const totalPages = Math.max(1, Math.ceil(total / size));
  return <div className="space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-2"><h1 className="text-xl font-semibold text-white">{t('title')}</h1><div className="flex gap-2"><GlassButton onClick={() => setAddOpen(true)} disabled={!accountId}>{t('add')}</GlassButton><GlassButton onClick={exportCSV} disabled={!params || exporting}>{t(exporting ? 'exporting' : 'exportCsv')}</GlassButton></div></div>
    <AddTransactionModal accountId={accountId} open={addOpen} onClose={() => setAddOpen(false)} onCreated={() => setTick(n => n + 1)} />
    <GlassCard className="space-y-3 p-4"><PeriodControl accountId={accountId} value={period} onChange={setPeriod} />
      <div className="grid gap-3 sm:grid-cols-3"><label className="text-sm text-white/70">{h('type')}<select className={control + ' w-full'} value={type} onChange={e => { setType(e.target.value); setCategoryId(''); setDetail(''); }}><option value="">{h('allTypes')}</option><option value="expense">{t('expense')}</option><option value="income">{t('income')}</option></select></label>
      <label className="text-sm text-white/70">{t('category')}<select className={control + ' w-full'} value={categoryId} onChange={e => { setCategoryId(e.target.value); setDetail(''); }}><option value="">{h('allCategories')}</option>{categories.filter(c => !c.parent_id && (!type || c.type === type)).map(c => <option key={c.id} value={c.id}>{categoryLabel(c, locale)}</option>)}{parent?.parent_id && <option value={parent.id}>{categoryPath(parent, categories, locale)}</option>}</select></label>
      {parent && !parent.parent_id && <label className="text-sm text-white/70">{h('subcategory')}<select className={control + ' w-full'} value={detail} onChange={e => setDetail(e.target.value)}><option value="">{h('allDetail')}</option><option value="direct">{h('direct')}</option>{categories.filter(c => c.parent_id === categoryId).map(c => <option key={c.id} value={c.id}>{categoryLabel(c, locale)}</option>)}</select></label>}</div>
      <form onSubmit={e => { e.preventDefault(); setSearch(draftSearch); }} className="flex flex-wrap items-end gap-2"><label className="min-w-0 flex-1 text-sm text-white/70">{h('search')}<input className={control + ' w-full'} value={draftSearch} onChange={e => setDraftSearch(e.target.value)} /></label><GlassButton type="submit">{h('search')}</GlassButton>{search && <GlassButton onClick={() => { setSearch(''); setDraftSearch(''); }}>{h('clear')}</GlassButton>}</form>
    </GlassCard>
    {filterNotice && <p role="status" className="text-amber-300">{filterNotice}</p>}
    {savedNotice && <p role="status" className="text-amber-300">{savedNotice}</p>}
    {catalogLoading && <p role="status" className="text-white/70">{h('loading')}</p>}
    {catalogError && <div role="alert" className="text-red-300">{h('loadFailed')} <GlassButton onClick={() => setCatalogTick(n => n + 1)}>{h('retry')}</GlassButton></div>}
    {summary && <GlassCard className="flex flex-wrap gap-5 p-4 text-white"><span>{t('income')}: {formatIDR(summary.income)}</span><span>{t('expense')}: {formatIDR(summary.expense)}</span><span>{h('net')}: {formatIDR(summary.net)}</span></GlassCard>}
    {exportError && <p role="alert" className="text-red-300">{exportError}</p>}
    {error && <div role="alert" className="text-red-300">{error} <GlassButton onClick={() => setTick(n => n + 1)}>{h('retry')}</GlassButton></div>}
    {loading && <p role="status" className="text-white/70">{h('loading')}</p>}
    <div className="flex flex-wrap items-center justify-between gap-3 text-white/70"><span>{h('transactionCount', { count: total })}</span><label>{h('show')} <select className={control} value={size} onChange={e => setSize(Number(e.target.value))}>{[5, 10, 20, 50, 100, 99999].map(s => <option key={s} value={s}>{s === 99999 ? h('allDetail') : s}</option>)}</select></label></div>
    {!loading && !error && !catalogLoading && !catalogError && params && <GlassCard><TransactionTable transactions={rows} onDelete={() => setTick(n => n + 1)} onUpdate={txn => { setSavedNotice(txn.categoryProjectionError ? h('savedCategoryUnavailable') : ''); setTick(n => n + 1); }} isOwner={owner} isGroup={group} /></GlassCard>}
    {totalPages > 1 && <div className="flex flex-wrap items-center justify-between gap-3 text-white/70"><GlassButton disabled={page <= 1} onClick={() => setPage(p => p - 1)}>{h('previous')}</GlassButton><label>{h('page')} <input aria-label={h('page')} type="number" min={1} max={totalPages} value={page} onChange={e => { const p = Number(e.target.value); if (Number.isInteger(p) && p >= 1 && p <= totalPages) setPage(p); }} className={control + ' w-20'} /> / {totalPages}</label><GlassButton disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>{h('next')}</GlassButton></div>}
  </div>;
}
