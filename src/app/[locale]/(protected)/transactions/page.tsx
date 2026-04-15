'use client';
import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useAccountId, useAccountRole, useAccountType } from '@/components/AccountSwitcher';
import { TransactionTable } from '@/components/TransactionTable';
import { startOfMonth, today } from '@/lib/utils';

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

const PAGE_SIZE_OPTIONS = [5, 10, 20, 50, 100, 'All'] as const;
type PageSizeOption = (typeof PAGE_SIZE_OPTIONS)[number];

export default function TransactionsPage() {
  const t = useTranslations('transactions');
  const accountId = useAccountId();
  const accountRole = useAccountRole();
  const accountType = useAccountType();
  const isOwner = accountRole === 'owner';
  const isGroup = accountType === 'group';

  const [from, setFrom] = useState(startOfMonth());
  const [to, setTo] = useState(today());
  const [type, setType] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [txns, setTxns] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<PageSizeOption>(20);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [jumpInput, setJumpInput] = useState('');

  useEffect(() => {
    if (!accountId) return;
    fetch(`/api/categories?account_id=${accountId}`)
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setCategories(data);
      });
  }, [accountId]);

  useEffect(() => {
    setPage(1);
  }, [accountId, from, to, type, categoryId, search, pageSize]);

  useEffect(() => {
    if (!accountId) return;
    setLoading(true);
    const params = new URLSearchParams({
      account_id: accountId,
      from,
      to,
      page: String(page),
      page_size: pageSize === 'All' ? '99999' : String(pageSize),
      ...(type && { type }),
      ...(categoryId && { category_id: categoryId }),
      ...(search && { search }),
    });
    fetch(`/api/transactions?${params}`)
      .then((r) => r.json())
      .then((res) => {
        setTxns(res.data ?? []);
        setTotal(res.total ?? 0);
        setTotalPages(res.totalPages ?? 1);
        setLoading(false);
      });
  }, [accountId, from, to, type, categoryId, search, page, pageSize]);

  function handleJump() {
    const n = parseInt(jumpInput);
    if (!isNaN(n) && n >= 1 && n <= totalPages) setPage(n);
    setJumpInput('');
  }

  async function exportCSV() {
    const params = new URLSearchParams({
      account_id: accountId,
      from,
      to,
      page: '1',
      page_size: '99999',
      ...(type && { type }),
      ...(categoryId && { category_id: categoryId }),
      ...(search && { search }),
    });

    const res = await fetch(`/api/transactions?${params}`);
    const data = await res.json();
    const rows = data.data ?? [];

    if (!rows.length) return;

    const headers = ['Date', 'Description', 'Category', 'Type', 'Amount'];
    const lines = [
      headers.join(','),
      ...rows.map((t: Transaction) =>
        [
          t.date,
          `"${(t.description ?? '').replace(/"/g, '""')}"`,
          `"${(t.categories?.name ?? '—').replace(/"/g, '""')}"`,
          t.type,
          t.amount,
        ].join(','),
      ),
    ];

    const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `transactions-${from}-${to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (!accountId)
    return (
      <div className="text-center py-20 text-white/30">
        <p className="text-4xl mb-3">◎</p>
        <p className="text-sm">Loading account...</p>
      </div>
    );

  const hasActiveFilters = !!(type || categoryId || search);
  const filteredCategories = categories.filter((c) => !type || c.type === type);
  const showPagination = pageSize !== 'All' && totalPages > 1;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-semibold text-white">{t('title')}</h1>
        <button
          onClick={exportCSV}
          className="rounded-lg bg-white/[0.06] border border-white/[0.1] text-white/60 px-3 py-1.5 text-sm hover:bg-white/[0.1] whitespace-nowrap"
        >
          ↓ Export CSV
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row sm:flex-wrap gap-2 mb-4">
        <div className="flex gap-2 w-full sm:w-auto">
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="flex-1 sm:flex-none rounded-lg border border-white/[0.1] bg-white/[0.06] text-white px-3 py-1.5 text-sm [color-scheme:dark]"
          />
          <span className="text-white/20 self-center">—</span>
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="flex-1 sm:flex-none rounded-lg border border-white/[0.1] bg-white/[0.06] text-white px-3 py-1.5 text-sm [color-scheme:dark]"
          />
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <select
            value={type}
            onChange={(e) => {
              setType(e.target.value);
              setCategoryId('');
            }}
            className="flex-1 rounded-lg border border-white/[0.1] bg-white/[0.06] text-white px-3 py-1.5 text-sm"
          >
            <option value="" className="bg-[#1a1a1f]">
              All types
            </option>
            <option value="expense" className="bg-[#1a1a1f]">
              Expense
            </option>
            <option value="income" className="bg-[#1a1a1f]">
              Income
            </option>
          </select>
          <select
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            className="flex-1 rounded-lg border border-white/[0.1] bg-white/[0.06] text-white px-3 py-1.5 text-sm"
          >
            <option value="" className="bg-[#1a1a1f]">
              All categories
            </option>
            {filteredCategories.map((c) => (
              <option key={c.id} value={c.id} className="bg-[#1a1a1f]">
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex gap-2 w-full sm:w-auto sm:flex-1 sm:max-w-xs">
          <input
            type="text"
            placeholder="Search description..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && setSearch(searchInput)}
            className="flex-1 rounded-lg border border-white/[0.1] bg-white/[0.06] text-white placeholder:text-white/20 px-3 py-1.5 text-sm"
          />
          <button
            onClick={() => setSearch(searchInput)}
            className="rounded-lg bg-white/[0.06] border border-white/[0.1] text-white/60 px-3 py-1.5 text-sm hover:bg-white/[0.1] whitespace-nowrap"
          >
            Search
          </button>
          {search && (
            <button
              onClick={() => {
                setSearch('');
                setSearchInput('');
              }}
              className="rounded-lg bg-white/[0.06] border border-white/[0.1] text-white/40 px-3 py-1.5 text-sm hover:bg-white/[0.1]"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Active filters + result count + page size */}
      <div className="flex gap-2 mb-3 flex-wrap items-center">
        {hasActiveFilters && (
          <>
            {type && (
              <span className="text-xs bg-emerald-500/10 text-emerald-400 rounded-full px-2.5 py-1">
                {type}
                <button
                  onClick={() => {
                    setType('');
                    setCategoryId('');
                  }}
                  className="ml-1.5 opacity-60 hover:opacity-100"
                >
                  ✕
                </button>
              </span>
            )}
            {categoryId && (
              <span className="text-xs bg-emerald-500/10 text-emerald-400 rounded-full px-2.5 py-1">
                {categories.find((c) => c.id === categoryId)?.name}
                <button
                  onClick={() => setCategoryId('')}
                  className="ml-1.5 opacity-60 hover:opacity-100"
                >
                  ✕
                </button>
              </span>
            )}
            {search && (
              <span className="text-xs bg-emerald-500/10 text-emerald-400 rounded-full px-2.5 py-1">
                "{search}"
                <button
                  onClick={() => {
                    setSearch('');
                    setSearchInput('');
                  }}
                  className="ml-1.5 opacity-60 hover:opacity-100"
                >
                  ✕
                </button>
              </span>
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
              value={String(pageSize)}
              onChange={(e) =>
                setPageSize(
                  e.target.value === 'All' ? 'All' : (Number(e.target.value) as PageSizeOption),
                )
              }
              className="rounded-lg border border-white/[0.1] bg-white/[0.06] text-white px-2 py-1 text-xs"
            >
              {PAGE_SIZE_OPTIONS.map((s) => (
                <option key={String(s)} value={String(s)} className="bg-[#1a1a1f]">
                  {s}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {loading && <p className="text-white/30 text-sm animate-pulse mb-3">Loading...</p>}

      <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] overflow-hidden">
        <TransactionTable
          transactions={txns}
          onDelete={(id) => setTxns((prev) => prev.filter((t) => t.id !== id))}
          onUpdate={(updated) =>
            setTxns((prev) => prev.map((t) => (t.id === updated.id ? updated : t)))
          }
          isOwner={isOwner}
          isGroup={isGroup}
        />
      </div>

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
