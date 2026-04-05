'use client';
import { useState } from 'react';
import { useTranslations } from 'next-intl';

interface Props {
  accountId: string;
  accountName: string;
}

export function LinkCodeModal({ accountId, accountName }: Props) {
  const t = useTranslations('accounts');
  const [code, setCode] = useState('');
  const [expiry, setExpiry] = useState('');
  const [loading, setLoading] = useState(false);

  async function generate() {
    setLoading(true);
    const res = await fetch('/api/accounts/' + accountId + '/link-code', { method: 'POST' });
    const data = await res.json();
    setCode(data.code);
    setExpiry(new Date(data.expiresAt).toLocaleTimeString());
    setLoading(false);
  }

  return (
    <div className="rounded-xl border border-gray-100 p-5 bg-white">
      <h3 className="font-medium mb-3">
        {t('linkBot')} — {accountName}
      </h3>
      <button
        onClick={generate}
        disabled={loading}
        className="rounded-lg bg-blue-600 text-white px-4 py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
      >
        {loading ? '...' : t('generateCode')}
      </button>
      {code && (
        <div className="mt-4 rounded-lg bg-gray-50 p-4">
          <p className="text-xs text-gray-500 mb-1">{t('codeInstruction')}</p>
          <code className="text-lg font-mono font-bold text-blue-600 block mb-2">
            /setup {code}
          </code>
          <p className="text-xs text-gray-400">
            {t('codeExpiry')} ({expiry})
          </p>
        </div>
      )}
    </div>
  );
}
