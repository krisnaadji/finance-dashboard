'use client';
import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

interface Account {
  id: string;
  name: string;
  type: string;
}

export function AccountSwitcher() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const router = useRouter();
  const searchParams = useSearchParams();
  const current = searchParams.get('account_id') ?? '';

  useEffect(() => {
    fetch('/api/accounts')
      .then((r) => r.json())
      .then((data) => {
        if (!Array.isArray(data)) return;
        setAccounts(data);
        if (!current && data.length > 0) router.replace('?account_id=' + data[0].id);
      });
  }, []);

  if (!accounts.length) return null;

  const active = accounts.find((a) => a.id === current) ?? accounts[0];

  return (
    <div className="px-1">
      <p className="text-[10px] font-medium text-white/30 uppercase tracking-widest mb-1.5 px-2">
        Account
      </p>
      <select
        value={current}
        onChange={(e) => router.push('?account_id=' + e.target.value)}
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
