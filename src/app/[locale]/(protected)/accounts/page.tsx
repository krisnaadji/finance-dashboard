'use client';
import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { LinkCodeModal } from '@/components/LinkCodeModal';

interface Account {
  id: string;
  name: string;
  type: 'personal' | 'group';
  wa_chat_id: string | null;
}

export default function AccountsPage() {
  const t = useTranslations('accounts');
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [name, setName] = useState('');
  const [type, setType] = useState<'personal' | 'group'>('personal');
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editType, setEditType] = useState<'personal' | 'group'>('personal');
  const [deleting, setDeleting] = useState<string | null>(null);
  const now = new Date().toLocaleDateString('id-ID', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  useEffect(() => {
    fetch('/api/accounts')
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setAccounts(data);
      });
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

  async function saveEdit(id: string) {
    const res = await fetch('/api/accounts', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, name: editName.trim(), type: editType }),
    });
    const data = await res.json();
    if (data.id) setAccounts((prev) => prev.map((a) => (a.id === id ? { ...a, ...data } : a)));
    setEditingId(null);
  }

  async function deleteAccount(id: string) {
    if (!confirm('Delete this account? Transactions will be preserved.')) return;
    setDeleting(id);
    await fetch('/api/accounts?id=' + id, { method: 'DELETE' });
    setAccounts((prev) => prev.filter((a) => a.id !== id));
    setDeleting(null);
  }

  return (
    <div className="max-w-2xl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-1">
        <h1 className="text-xl font-semibold text-white">{t('title')}</h1>
        <p className="text-xs text-white/40">{now}</p>
      </div>

      <div className="rounded-xl border border-white/[0.06] p-5 bg-white/[0.03] mb-6">
        <h2 className="font-medium text-white mb-3">{t('create')}</h2>
        <div className="flex flex-col sm:flex-row gap-3">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t('name')}
            className="flex-1 rounded-lg border border-white/[0.1] bg-white/[0.06] text-white placeholder-white/30 px-3 py-2 text-sm"
          />
          <select
            value={type}
            onChange={(e) => setType(e.target.value as any)}
            className="rounded-lg border border-white/[0.1] bg-white/[0.06] text-white px-3 py-2 text-sm"
          >
            <option value="personal" className="bg-[#1a1a1f]">
              {t('personal')}
            </option>
            <option value="group" className="bg-[#1a1a1f]">
              {t('group')}
            </option>
          </select>
          <button
            onClick={createAccount}
            disabled={creating || !name.trim()}
            className="rounded-lg bg-emerald-600 text-white px-4 py-2 text-sm font-medium hover:bg-emerald-500 disabled:opacity-40 transition-colors whitespace-nowrap"
          >
            {creating ? '...' : t('create')}
          </button>
        </div>
      </div>

      <div className="space-y-4">
        {accounts.map((acc) => (
          <div key={acc.id} className="rounded-xl border border-white/[0.06] p-5 bg-white/[0.03]">
            {editingId === acc.id ? (
              // Edit mode
              <div className="space-y-3">
                <input
                  className="w-full bg-white/[0.06] border border-white/[0.1] text-white rounded-lg px-3 py-2 text-sm"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                />
                <select
                  value={editType}
                  onChange={(e) => setEditType(e.target.value as 'personal' | 'group')}
                  className="w-full bg-white/[0.06] border border-white/[0.1] text-white rounded-lg px-3 py-2 text-sm"
                >
                  <option value="personal" className="bg-[#1a1a1f]">
                    Personal
                  </option>
                  <option value="group" className="bg-[#1a1a1f]">
                    Group
                  </option>
                </select>
                <div className="flex gap-2">
                  <button
                    onClick={() => saveEdit(acc.id)}
                    className="rounded-lg bg-emerald-600 text-white px-3 py-1.5 text-sm"
                  >
                    Save
                  </button>
                  <button
                    onClick={() => setEditingId(null)}
                    className="rounded-lg bg-white/[0.06] text-white/60 px-3 py-1.5 text-sm"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              // View mode
              <>
                <div className="flex flex-wrap items-center gap-3 mb-3">
                  <span className="font-medium text-white">{acc.name}</span>
                  <span className="text-xs bg-white/[0.08] text-white/50 rounded-full px-2 py-0.5">
                    {acc.type}
                  </span>
                  {acc.wa_chat_id && (
                    <span className="text-xs text-emerald-400">✓ WhatsApp linked</span>
                  )}
                  <div className="ml-auto flex gap-3">
                    <button
                      onClick={() => {
                        setEditingId(acc.id);
                        setEditName(acc.name);
                        setEditType(acc.type);
                      }}
                      className="text-xs text-white/30 hover:text-white/60"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => deleteAccount(acc.id)}
                      disabled={deleting === acc.id}
                      className="text-xs text-red-400/60 hover:text-red-400 disabled:opacity-40"
                    >
                      {deleting === acc.id ? '...' : 'Delete'}
                    </button>
                  </div>
                </div>
                <LinkCodeModal accountId={acc.id} accountName={acc.name} />
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
