'use client';
import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { LinkCodeModal } from '@/components/LinkCodeModal';
import { useAccountRole, refreshAccountSwitcher } from '@/components/AccountSwitcher';
import { GlassCard } from '@/components/ui/GlassCard';
import { GlowBadge } from '@/components/ui/GlowBadge';
import { GlassButton } from '@/components/ui/GlassButton';

interface Member {
  id: string;
  display_name: string | null;
  wa_phone: string | null;
  role: string;
}

interface Account {
  id: string;
  name: string;
  type: 'personal' | 'group';
  wa_chat_id: string | null;
  role?: string;
}

export default function AccountsPage() {
  const t = useTranslations('accounts');
  const accountRole = useAccountRole();
  const isOwner = accountRole === 'owner';

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [name, setName] = useState('');
  const [type, setType] = useState<'personal' | 'group'>('personal');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');
  const createOperation = useRef<{ payload: string; id: string } | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editType, setEditType] = useState<'personal' | 'group'>('personal');
  const [deleting, setDeleting] = useState<string | null>(null);
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [inviteExpiry, setInviteExpiry] = useState('');
  const [inviting, setInviting] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [savingName, setSavingName] = useState(false);
  const [nameSaved, setNameSaved] = useState(false);
  const [members, setMembers] = useState<Record<string, Member[]>>({});

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
        if (Array.isArray(data)) {
          setAccounts(data);
          data
            .filter((a: Account) => a.type === 'group')
            .forEach((a: Account) => loadMembers(a.id));
        }
      });

    // Prefill display name from Google profile
    fetch('/api/me', { credentials: 'include' })
      .then((r) => r.json())
      .then((data) => {
        if (data.name) setDisplayName(data.name);
      });
  }, []);

  async function loadMembers(accountId: string) {
    const res = await fetch('/api/accounts/' + accountId + '/members', { credentials: 'include' });
    const data = await res.json();
    if (Array.isArray(data)) setMembers((prev) => ({ ...prev, [accountId]: data }));
  }

  async function createAccount() {
    const accountName = name.trim();
    if (!accountName) return;
    const payload = JSON.stringify({ name: accountName, type });
    if (!createOperation.current || createOperation.current.payload !== payload) {
      createOperation.current = { payload, id: crypto.randomUUID() };
    }
    setCreating(true);
    setCreateError('');
    try {
      const res = await fetch('/api/accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: accountName, type, operation_id: createOperation.current.id }),
      });
      const data = await res.json();
      if (!res.ok || typeof data.id !== 'string') {
        setCreateError(t('createFailed'));
        return;
      }
      const newAcc = { ...data, role: 'owner' };
      setAccounts((prev) => [...prev, newAcc]);
      setName('');
      createOperation.current = null;
      refreshAccountSwitcher();
      if (newAcc.type === 'group') loadMembers(newAcc.id);
    } catch {
      setCreateError(t('createFailed'));
    } finally {
      setCreating(false);
    }
  }

  async function saveEdit(id: string) {
    const res = await fetch('/api/accounts', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ id, name: editName.trim(), type: editType }),
    });
    const data = await res.json();
    if (data.id) setAccounts((prev) => prev.map((a) => (a.id === id ? { ...a, ...data } : a)));
    setEditingId(null);
    refreshAccountSwitcher();
  }

  async function deleteAccount(id: string) {
    if (!confirm('Delete this account? Transactions will be preserved.')) return;
    setDeleting(id);
    await fetch('/api/accounts?id=' + id, { method: 'DELETE', credentials: 'include' });
    setAccounts((prev) => prev.filter((a) => a.id !== id));
    setDeleting(null);
    refreshAccountSwitcher();
  }

  async function generateInvite(accountId: string) {
    setInviting(accountId);
    const res = await fetch('/api/accounts/' + accountId + '/invite', {
      method: 'POST',
      credentials: 'include',
    });
    const data = await res.json();
    setInviteUrl(data.url);
    setInviteExpiry(new Date(data.expiresAt).toLocaleString());
    setInviting(null);
  }

  async function saveDisplayName() {
    if (!displayName.trim() || !accounts.length) return;
    setSavingName(true);
    await Promise.all(
      accounts.map((acc) =>
        fetch('/api/members/display-name', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ accountId: acc.id, displayName: displayName.trim() }),
        }),
      ),
    );
    setSavingName(false);
    setNameSaved(true);
    setTimeout(() => setNameSaved(false), 2000);
  }

  return (
    <div className="max-w-2xl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-1">
        <h1 className="text-xl font-semibold text-white">{t('title')}</h1>
        <p className="text-xs text-white/40">{now}</p>
      </div>

      {/* Display Name Section */}
      <div className="rounded-xl border border-white/[0.06] p-5 bg-white/[0.03] mb-6">
        <h2 className="font-medium text-white mb-1">Your Display Name</h2>
        <p className="text-xs text-white/30 mb-3">Shown on transactions you record via WhatsApp.</p>
        <div className="flex gap-2">
          <input
            className="flex-1 bg-white/[0.06] border border-white/[0.1] text-white rounded-lg px-3 py-2 text-sm placeholder:text-white/20"
            placeholder="Your name..."
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
          />
          <button
            onClick={saveDisplayName}
            disabled={savingName || !displayName.trim()}
            className="rounded-lg bg-emerald-600 text-white px-4 py-2 text-sm font-medium hover:bg-emerald-500 disabled:opacity-40 transition-colors whitespace-nowrap"
          >
            {nameSaved ? '✓ Saved' : savingName ? '...' : 'Save'}
          </button>
        </div>
      </div>

      {/* Create Account */}
      <div className="rounded-xl border border-white/[0.06] p-5 bg-white/[0.03] mb-6">
        <h2 className="font-medium text-white mb-3">{t('create')}</h2>
        <div className="flex flex-col sm:flex-row gap-3">
          <input
            value={name}
            onChange={(e) => { setName(e.target.value); createOperation.current = null; setCreateError(''); }}
            placeholder={t('name')}
            className="flex-1 rounded-lg border border-white/[0.1] bg-white/[0.06] text-white placeholder-white/30 px-3 py-2 text-sm"
          />
          <select
            value={type}
            onChange={(e) => { setType(e.target.value as 'personal' | 'group'); createOperation.current = null; setCreateError(''); }}
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
        {createError && <p role="alert" className="mt-3 text-sm text-red-300">{createError}</p>}
      </div>

      {/* Accounts List */}
      <div className="space-y-4">
        {accounts.map((acc) => (
          <GlassCard key={acc.id} tint={acc.type === 'group' ? 'sky' : 'emerald'} className="p-4">
            {editingId === acc.id ? (
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
                  <GlassButton variant="ghost" onClick={() => saveEdit(acc.id)}>
                    Save
                  </GlassButton>
                  <GlassButton variant="ghost" onClick={() => setEditingId(null)}>
                    Cancel
                  </GlassButton>
                </div>
              </div>
            ) : (
              <>
                <div className="flex flex-wrap items-center gap-3 mb-3">
                  <span className="font-medium text-white">{acc.name}</span>
                  <span className="text-xs bg-white/[0.08] text-white/50 rounded-full px-2 py-0.5">
                    {acc.type}
                  </span>
                  {acc.wa_chat_id
                    ? <GlowBadge color="emerald" dot>Linked</GlowBadge>
                    : <GlowBadge color="red">Not linked</GlowBadge>
                  }
                  {acc.role === 'owner' && (
                    <div className="ml-auto flex gap-2">
                      <GlassButton
                        variant="ghost"
                        onClick={() => {
                          setEditingId(acc.id);
                          setEditName(acc.name);
                          setEditType(acc.type);
                        }}
                      >
                        Edit
                      </GlassButton>
                      <GlassButton
                        variant="danger"
                        onClick={() => deleteAccount(acc.id)}
                        disabled={deleting === acc.id}
                      >
                        {deleting === acc.id ? '...' : 'Delete'}
                      </GlassButton>
                    </div>
                  )}
                </div>

                {acc.role === 'owner' && (
                  <LinkCodeModal accountId={acc.id} accountName={acc.name} />
                )}

                {acc.type === 'group' && (
                  <div className="mt-3 pt-3 border-t border-white/[0.06]">
                    {/* Invite button — owner only */}
                    {acc.role === 'owner' && (
                      <>
                        <GlassButton
                          variant="ghost"
                          onClick={() => generateInvite(acc.id)}
                          disabled={inviting === acc.id}
                        >
                          {inviting === acc.id ? 'Generating...' : '+ Invite Member'}
                        </GlassButton>
                        {inviteUrl && (
                          <div className="mt-2 p-3 bg-white/[0.04] rounded-lg">
                            <p className="text-xs text-white/40 mb-1">
                              Share this link (expires {inviteExpiry}):
                            </p>
                            <p className="text-xs text-emerald-400 break-all">{inviteUrl}</p>
                            <GlassButton
                              variant="ghost"
                              onClick={() => navigator.clipboard.writeText(inviteUrl)}
                            >
                              Copy link
                            </GlassButton>
                          </div>
                        )}
                      </>
                    )}

                    {/* Member list */}
                    {members[acc.id]?.length > 0 && (
                      <div
                        className={
                          acc.role === 'owner' ? 'mt-3 pt-3 border-t border-white/[0.06]' : ''
                        }
                      >
                        <p className="text-[10px] font-medium text-white/30 uppercase tracking-widest mb-2">
                          Members
                        </p>
                        <div className="space-y-1.5">
                          {members[acc.id].map((m) => (
                            <div key={m.id} className="flex items-center gap-2">
                              <span className="text-sm text-white/70">
                                {m.display_name ?? m.wa_phone ?? 'Unknown'}
                              </span>
                              <span className="text-[10px] text-white/25">{m.role}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </GlassCard>
        ))}
      </div>
    </div>
  );
}
