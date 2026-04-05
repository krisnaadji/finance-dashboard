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
        // Guard against non-array responses (e.g. 401 error object)
        if (!Array.isArray(data)) return;
        setAccounts(data);
        if (!current && data.length > 0) {
          router.replace('?account_id=' + data[0].id);
        }
      });
  }, []);

  if (!accounts.length) return null;

  return (
    <select
      value={current}
      onChange={(e) => router.push('?account_id=' + e.target.value)}
      className="rounded-lg border border-gray-200 px-3 py-2 text-sm bg-white"
    >
      {accounts.map((a) => (
        <option key={a.id} value={a.id}>
          {a.name} ({a.type})
        </option>
      ))}
    </select>
  );
}
