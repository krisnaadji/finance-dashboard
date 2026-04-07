'use client';
import { useEffect, useState, createContext, useContext } from 'react';

interface Account {
  id: string;
  name: string;
  type: string;
}

// Module-level store — survives client-side navigation, resets on full page reload
let _accountId = '';
const _subs = new Set<() => void>();
function _set(id: string) {
  _accountId = id;
  _subs.forEach((f) => f());
}

// Hook for any page that needs the current account ID
export function useAccountId() {
  const [id, setId] = useState(_accountId); // initialise from module var — no SSR issue
  useEffect(() => {
    const cb = () => setId(_accountId);
    _subs.add(cb);
    if (_accountId !== id) setId(_accountId); // sync if already loaded
    return () => {
      _subs.delete(cb);
    };
  }, []); // empty deps — subscribe once
  return id;
}

export function AccountSwitcher() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [current, setCurrent] = useState(_accountId);

  useEffect(() => {
    fetch('/api/accounts')
      .then((r) => r.json())
      .then((data: Account[]) => {
        if (!Array.isArray(data) || !data.length) return;
        setAccounts(data);
        if (!_accountId) {
          // only set if not already selected
          _set(data[0].id);
          setCurrent(data[0].id);
        }
      });
  }, []); // runs once on mount — NO router.replace, NO dependency on pathname

  if (!accounts.length) return null;

  function handleChange(id: string) {
    setCurrent(id);
    _set(id);
  }

  return (
    <div className="px-1">
      <p className="text-[10px] font-medium text-white/30 uppercase tracking-widest mb-1.5 px-2">
        Account
      </p>
      <select
        value={current}
        onChange={(e) => handleChange(e.target.value)}
        className="w-full bg-white/[0.06] border border-white/[0.08] text-white text-sm rounded-lg px-3 py-2 appearance-none cursor-pointer hover:bg-white/[0.1] transition-colors"
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
