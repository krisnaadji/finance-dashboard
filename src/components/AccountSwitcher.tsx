'use client';
import { useEffect, useState } from 'react';

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
  _accountId = id;
  _accountRole = role;
  _accountType = type;
  _subs.forEach((f) => f());
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
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [current, setCurrent] = useState(_accountId);

  function loadAccounts() {
    fetch('/api/accounts')
      .then((r) => r.json())
      .then((data: Account[]) => {
        if (!Array.isArray(data) || !data.length) return;
        setAccounts(data);
        if (!_accountId) {
          _set(data[0].id, data[0].role, data[0].type);
          setCurrent(data[0].id);
        }
      });
  }

  useEffect(() => {
    _refresh = loadAccounts;
    loadAccounts();
    return () => {
      _refresh = null;
    };
  }, []);

  if (!accounts.length) return null;

  function handleChange(id: string) {
    const account = accounts.find((a) => a.id === id);
    setCurrent(id);
    _set(id, account?.role ?? 'member', account?.type ?? 'personal');
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

function _set(id: string, role: string, type: string) {
  _accountId = id;
  _accountRole = role;
  _accountType = type;
  _subs.forEach((fn) => fn());
}
