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

  useEffect(() => {
    if (!accountId) return;
    fetch(`/api/categories?account_id=${accountId}`)
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setCategories(data);
      });
  }, [accountId]);

  useEffect(() => {
    if (!accountId) return;
    setLoading(true);
    const params = new URLSearchParams({
      account_id: accountId,
      from,
      to,
      ...(type && { type }),
      ...(categoryId && { category_id: categoryId }),
      ...(search && { search }),
    });
    fetch(`/api/transactions?${params}`)
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setTxns(data);
          setLoading(false);
        }
      });
  }, [accountId, from, to, type, categoryId, search]);

  if (!accountId)
    return (
      <div className="text-center py-20 text-white/30">
        <p className="text-4xl mb-3">◎</p>
        <p className="text-sm">Loading account...</p>
      </div>
    );

  const hasActiveFilters = !!(type || categoryId || search);
  const filteredCategories = categories.filter((c) => !type || c.type === type);

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 gap-3">
        <h1 className="text-xl font-semibold text-white">{t('title')}</h1>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row sm:flex-wrap gap-2 mb-4">
        {/* Row 1: Date range */}
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

        {/* Row 2: Type + Category */}
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

        {/* Row 3: Search */}
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

      {/* Active filters summary */}
      {hasActiveFilters && (
        <div className="flex gap-2 mb-3 flex-wrap items-center">
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
          <span className="text-xs text-white/30">
            {txns.length} result{txns.length !== 1 ? 's' : ''}
          </span>
        </div>
      )}

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
    </div>
  );
}
