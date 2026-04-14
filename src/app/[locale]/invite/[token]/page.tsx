'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';

export default function InvitePage() {
  const { token } = useParams<{ token: string }>();
  const router = useRouter();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    const run = async () => {
      // Check if logged in first
      const authCheck = await fetch('/api/accounts', { credentials: 'include' });
      if (authCheck.status === 401) {
        router.push('/login?redirect=/invite/' + token);
        return;
      }

      // Logged in — redeem invite
      const res = await fetch('/api/invite/' + token, { method: 'POST', credentials: 'include' });
      const data = await res.json();

      if (data.accountId) {
        setStatus('success');
        setMessage('You have joined ' + data.accountName + '!');
        setTimeout(() => router.push('/dashboard'), 2000);
      } else {
        setStatus('error');
        setMessage(data.error ?? 'Invalid or expired invite link.');
      }
    };

    run().catch(() => {
      setStatus('error');
      setMessage('Something went wrong.');
    });
  }, [token]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0f0f11]">
      <div className="bg-white/[0.04] border border-white/[0.08] rounded-2xl p-10 text-center max-w-sm w-full">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-400 to-teal-600 flex items-center justify-center text-xl font-bold mx-auto mb-6">
          F
        </div>
        {status === 'loading' && <p className="text-white/40 animate-pulse">Joining account...</p>}
        {status === 'success' && (
          <>
            <p className="text-emerald-400 text-lg font-semibold mb-2">✓ Joined!</p>
            <p className="text-white/60 text-sm">{message}</p>
            <p className="text-white/20 text-xs mt-4">Redirecting to dashboard...</p>
          </>
        )}
        {status === 'error' && (
          <>
            <p className="text-red-400 text-lg font-semibold mb-2">✗ Error</p>
            <p className="text-white/40 text-sm">{message}</p>
            <a href="/dashboard" className="text-emerald-400 text-sm mt-4 block">
              Go to dashboard →
            </a>
          </>
        )}
      </div>
    </div>
  );
}
