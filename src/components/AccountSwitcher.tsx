'use client';
import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';

interface Account {
  id: string;
  name: string;
  type: string;
  role: string;
}

// Module-level store
let _accountId = '';
let _accountRole = 'owner';
let _accountType = 'personal';
let _refresh: (() => void) | null = null;
const _subs = new Set<() => void>();

export function refreshAccountSwitcher() {
  _refresh?.();
}

export function setSelectedAccountId(id: string, role = 'owner', type = 'personal') {
  _set(id, role, type);
}

export function useAccountId() {
  const [id, setId] = useState(_accountId);
  useEffect(() => {
    const cb = () => setId(_accountId);
    _subs.add(cb);
    if (_accountId !== id) setId(_accountId);
    return () => {
      _subs.delete(cb);
    };
  }, []);
  return id;
}

export function useAccountRole() {
  const [role, setRole] = useState(_accountRole);
  useEffect(() => {
    const cb = () => setRole(_accountRole);
    _subs.add(cb);
    if (_accountRole !== role) setRole(_accountRole);
    return () => {
      _subs.delete(cb);
    };
  }, []);
  return role;
}

export function useAccountType() {
  const [type, setType] = useState(_accountType);
  useEffect(() => {
    const cb = () => setType(_accountType);
    _subs.add(cb);
    if (_accountType !== type) setType(_accountType);
    return () => {
      _subs.delete(cb);
    };
  }, []);
  return type;
}

export function AccountSwitcher() {
  const t = useTranslations('accounts');
  const h = useTranslations('hierarchy');
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [current, setCurrent] = useState(_accountId);
  const [loadError, setLoadError] = useState(false);

  function loadAccounts() {
    setLoadError(false);
    fetch('/api/accounts')
      .then(async r => { if (!r.ok) throw new Error(); return r.json(); })
      .then((data: Account[]) => {
        if (!Array.isArray(data)) throw new Error();
        setAccounts(data);
        if (!data.length) return;
        const requested = _accountId || new URLSearchParams(window.location.search).get('account_id');
        const selected = data.find(a => a.id === requested) ?? data[0];
        _set(selected.id, selected.role, selected.type);
        setCurrent(selected.id);
      }).catch(() => setLoadError(true));
  }

  useEffect(() => {
    _refresh = loadAccounts;
    loadAccounts();
    return () => {
      _refresh = null;
    };
  }, []);

  if (loadError) return <div role="alert" className="p-2 text-sm text-red-300">{h('loadFailed')} <button type="button" onClick={loadAccounts} className="min-h-11 rounded border border-white/20 px-3 text-white focus-visible:outline-emerald-400">{h('retry')}</button></div>;
  if (!accounts.length) return null;

  function handleChange(id: string) {
    const account = accounts.find(a => a.id === id);
    if (!account) return;
    setCurrent(id);
    const url = new URL(window.location.href);
    for (const key of ['category_id', 'subcategory_id', 'category_scope']) url.searchParams.delete(key);
    window.history.replaceState(null, '', url);
    _set(account.id, account.role, account.type);
  }

  return (
    <div className="px-1">
      <label htmlFor="account-switcher" className="mb-1.5 block px-2 text-sm font-medium text-white/70">
        {t('title')}
      </label>
      <select id="account-switcher"
        value={current}
        onChange={(e) => handleChange(e.target.value)}
        className="min-h-11 w-full bg-white/[0.06] border border-white/20 text-white text-sm rounded-lg px-3 py-2 cursor-pointer hover:bg-white/[0.1] transition-colors focus-visible:outline-emerald-400"
      >
        {accounts.map((a) => (
          <option key={a.id} value={a.id} className="bg-[#1a1a1f] text-white">
            {a.name}
          </option>
        ))}
      </select>
    </div>
  );
}

function _set(id: string, role: string, type: string) {
  _accountId = id;
  _accountRole = role;
  _accountType = type;
  const url = new URL(window.location.href);
  url.searchParams.set('account_id', id);
  window.history.replaceState(null, '', url);
  _subs.forEach((fn) => fn());
}
