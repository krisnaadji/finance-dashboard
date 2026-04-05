'use client';
import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { LinkCodeModal } from '@/components/LinkCodeModal';

interface Account {
  id: string;
  name: string;
  type: string;
  wa_chat_id: string | null;
}

export default function AccountsPage() {
  const t = useTranslations('accounts');
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [name, setName] = useState('');
  const [type, setType] = useState<'personal' | 'group'>('personal');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    fetch('/api/accounts')
      .then((r) => r.json())
      .then(setAccounts);
  }, []);

  async function createAccount() {
    if (!name.trim()) return;
    setCreating(true);
    const res = await fetch('/api/accounts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name.trim(), type }),
    });
    const data = await res.json();
    setAccounts((prev) => [...prev, data]);
    setName('');
    setCreating(false);
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-xl font-semibold mb-6">{t('title')}</h1>

      <div className="rounded-xl border border-gray-100 p-5 bg-white mb-6">
        <h2 className="font-medium mb-3">{t('create')}</h2>
        <div className="flex gap-3">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t('name')}
            className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm"
          />
          <select
            value={type}
            onChange={(e) => setType(e.target.value as any)}
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm"
          >
            <option value="personal">{t('personal')}</option>
            <option value="group">{t('group')}</option>
          </select>
          <button
            onClick={createAccount}
            disabled={creating || !name.trim()}
            className="rounded-lg bg-blue-600 text-white px-4 py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            {creating ? '...' : t('create')}
          </button>
        </div>
      </div>

      <div className="space-y-4">
        {accounts.map((acc) => (
          <div key={acc.id}>
            <div className="flex items-center gap-3 mb-3">
              <span className="font-medium">{acc.name}</span>
              <span className="text-xs bg-gray-100 text-gray-500 rounded-full px-2 py-0.5">
                {acc.type}
              </span>
              {acc.wa_chat_id && <span className="text-xs text-green-600">✓ WhatsApp linked</span>}
            </div>
            <LinkCodeModal accountId={acc.id} accountName={acc.name} />
          </div>
        ))}
      </div>
    </div>
  );
}
