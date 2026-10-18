'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useAccountId, useAccountRole, useAccountType } from '@/components/AccountSwitcher';
import { TransactionTable } from '@/components/TransactionTable';
import { AddTransactionModal } from '@/components/AddTransactionModal';
import { PeriodControl, createInitialPeriodValue, type PeriodValue } from '@/components/PeriodControl';
import { GlowBadge } from '@/components/ui/GlowBadge';
import { GlassCard } from '@/components/ui/GlassCard';
import { GlassButton } from '@/components/ui/GlassButton';
import { categoryLabel, categoryPath, type Category, type CategoryLocale } from '@/lib/categories';
import type { Summary, TransactionRow } from '@/lib/reporting-contract';
import { parseTransactionFilters } from '@/lib/transaction-filters';
import { formatIDR } from '@/lib/utils';

const PAGE_SIZE_OPTIONS = [5, 10, 20, 50, 100, 99999];
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
  const [jumpInput, setJumpInput] = useState('');
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
  const filteredCategories = categories.filter(c => !c.parent_id && (!type || c.type === type));
  const hasActiveFilters = !!(type || categoryId || search);
  const showPagination = size !== 99999 && totalPages > 1;
  function handleJump() { const n = Number(jumpInput); if (Number.isInteger(n) && n >= 1 && n <= totalPages) setPage(n); setJumpInput(''); }
  return (
    <div>
      <div className="flex items-center justify-between mb-4 gap-2">
        <h1 className="text-xl font-semibold text-white">{t('title')}</h1>
        <div className="flex gap-2">
          <GlassButton variant="primary" onClick={() => setAddOpen(true)}>
            + {t('add')}
          </GlassButton>
          <GlassButton variant="ghost" onClick={exportCSV} disabled={!params || exporting} aria-busy={exporting}>
            {t('exportCsv')}
          </GlassButton>
        </div>
      </div>
      {exporting && <p className="mb-3 text-sm text-white" role="status" aria-live="polite">{t('exporting')}</p>}
      {exportError && <p className="mb-3 text-sm text-white" role="alert">{exportError}</p>}

      <AddTransactionModal
        accountId={accountId}
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onCreated={() => setTick((n) => n + 1)}
      />

      {/* Filters */}
      <GlassCard className="p-3 md:p-4 mb-4">
        <div className="flex flex-col sm:flex-row sm:flex-wrap gap-2">
          <PeriodControl
            accountId={accountId}
            value={period}
            onChange={setPeriod}
            className="w-full"
          />
          <div className="flex gap-2 w-full sm:w-auto">
            <select
              aria-label={h('type')}
              value={type}
              onChange={(e) => {
                setType(e.target.value);
                setCategoryId(''); setDetail('');
              }}
              className="flex-1 rounded-lg border border-white/[0.1] bg-white/[0.06] text-white px-3 py-1.5 text-sm"
            >
              <option value="" className="bg-[#1a1a1f]">
                {h('allTypes')}
              </option>
              <option value="expense" className="bg-[#1a1a1f]">
                Expense
              </option>
              <option value="income" className="bg-[#1a1a1f]">
                Income
              </option>
            </select>
            <select
              aria-label={t('category')}
              value={categoryId}
              onChange={(e) => { setCategoryId(e.target.value); setDetail(''); }}
              className="flex-1 rounded-lg border border-white/[0.1] bg-white/[0.06] text-white px-3 py-1.5 text-sm"
            >
              <option value="" className="bg-[#1a1a1f]">
                {h('allCategories')}
              </option>
              {filteredCategories.map((c) => (
                <option key={c.id} value={c.id} className="bg-[#1a1a1f]">
                  {categoryLabel(c, locale)}
                </option>
              ))}
            </select>
          </div>
          {parent && !parent.parent_id && <select aria-label={h('subcategory')} value={detail} onChange={e => setDetail(e.target.value)} className="min-w-0 rounded-lg border border-white/[0.1] bg-white/[0.06] text-white px-3 py-1.5 text-sm"><option value="" className="bg-[#1a1a1f]">{h('allDetail')}</option><option value="direct" className="bg-[#1a1a1f]">{h('direct')}</option>{categories.filter(c => c.parent_id === parent.id).map(c => <option key={c.id} value={c.id} className="bg-[#1a1a1f]">{categoryLabel(c, locale)}</option>)}</select>}
          <div className="flex gap-2 w-full sm:w-auto sm:flex-1 sm:max-w-xs">
            <input
              type="text"
              aria-label={h('search')}
              placeholder="Search description..."
              value={draftSearch}
              onChange={(e) => setDraftSearch(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && setSearch(draftSearch)}
              className="flex-1 rounded-lg border border-white/[0.1] bg-white/[0.06] text-white placeholder:text-white/20 px-3 py-1.5 text-sm"
            />
            <button
              onClick={() => setSearch(draftSearch)}
              className="rounded-lg bg-white/[0.06] border border-white/[0.1] text-white/60 px-3 py-1.5 text-sm hover:bg-white/[0.1] whitespace-nowrap"
            >
              Search
            </button>
            {search && (
              <button
                onClick={() => {
                  setSearch('');
                  setDraftSearch('');
                }}
                className="rounded-lg bg-white/[0.06] border border-white/[0.1] text-white/40 px-3 py-1.5 text-sm hover:bg-white/[0.1]"
              >
                ✕
              </button>
            )}
          </div>
        </div>
      </GlassCard>

      {filterNotice && <p role="status" className="mb-3 text-xs text-amber-300">{filterNotice}</p>}
      {savedNotice && <p role="status" className="mb-3 text-xs text-amber-300">{savedNotice}</p>}
      {catalogError && <div role="alert" className="mb-3 text-sm text-red-300">{h('loadFailed')} <GlassButton onClick={() => setCatalogTick(n => n + 1)}>{h('retry')}</GlassButton></div>}
      {error && <div role="alert" className="mb-3 text-sm text-red-300">{error} <GlassButton onClick={() => setTick(n => n + 1)}>{h('retry')}</GlassButton></div>}
      {summary && <div className="mb-3 flex flex-wrap gap-4 text-xs text-white/40"><span>{t('income')}: {formatIDR(summary.income)}</span><span>{t('expense')}: {formatIDR(summary.expense)}</span><span>{h('net')}: {formatIDR(summary.net)}</span></div>}
      {/* Active filters + result count + page size */}
      <div className="flex gap-2 mb-3 flex-wrap items-center">
        {hasActiveFilters && (
          <>
            {type && (
              <GlowBadge
                color="sky"
                className="cursor-pointer"
                onClick={() => {
                  setType('');
                  setCategoryId('');
                }}
              >
                {type} ×
              </GlowBadge>
            )}
            {categoryId && (
              <GlowBadge color="sky" className="cursor-pointer" onClick={() => { setCategoryId(''); setDetail(''); }}>
                {parent ? categoryPath(parent, categories, locale) : ''} ×
              </GlowBadge>
            )}
            {search && (
              <GlowBadge
                color="sky"
                className="cursor-pointer"
                onClick={() => {
                  setSearch('');
                  setDraftSearch('');
                }}
              >
                &ldquo;{search}&rdquo; ×
              </GlowBadge>
            )}
          </>
        )}
        <div className="ml-auto flex items-center gap-3">
          <span className="text-xs text-white/30">
            {total} transaction{total !== 1 ? 's' : ''}
          </span>
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-white/30">Show</span>
            <select
              aria-label={h('show')}
              value={String(size)}
              onChange={(e) =>
                setSize(
                  Number(e.target.value),
                )
              }
              className="rounded-lg border border-white/[0.1] bg-white/[0.06] text-white px-2 py-1 text-xs"
            >
              {PAGE_SIZE_OPTIONS.map((s) => (
                <option key={String(s)} value={String(s)} className="bg-[#1a1a1f]">
                  {s === 99999 ? 'All' : s}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {loading && <p className="text-white/30 text-sm animate-pulse mb-3">Loading...</p>}

      {!loading && !error && !catalogLoading && !catalogError && params && <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] overflow-hidden"><TransactionTable transactions={rows} onDelete={() => setTick(n => n + 1)} onUpdate={txn => { setSavedNotice(txn.categoryProjectionError ? h('savedCategoryUnavailable') : ''); setTick(n => n + 1); }} isOwner={owner} isGroup={group} /></div>}

      {/* Pagination */}
      {showPagination && (
        <div className="flex items-center justify-between mt-4 gap-3 flex-wrap">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="rounded-lg bg-white/[0.06] border border-white/[0.1] text-white/60 px-4 py-1.5 text-sm hover:bg-white/[0.1] disabled:opacity-30 disabled:cursor-not-allowed"
          >
            ← Prev
          </button>

          {/* Jump to page */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-white/30">Page</span>
            <input
              type="number"
              aria-label={h('page')}
              min={1}
              max={totalPages}
              value={jumpInput}
              placeholder={String(page)}
              onChange={(e) => setJumpInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleJump()}
              className="w-14 rounded-lg border border-white/[0.1] bg-white/[0.06] text-white text-center px-2 py-1 text-xs [appearance:textfield]"
            />
            <span className="text-xs text-white/30">of {totalPages}</span>
            <button
              onClick={handleJump}
              className="rounded-lg bg-white/[0.06] border border-white/[0.1] text-white/40 px-2.5 py-1 text-xs hover:bg-white/[0.1]"
            >
              Go
            </button>
          </div>

          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="rounded-lg bg-white/[0.06] border border-white/[0.1] text-white/60 px-4 py-1.5 text-sm hover:bg-white/[0.1] disabled:opacity-30 disabled:cursor-not-allowed"
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
}
