'use client';
import { createClient } from '@/lib/supabase-browser';
import { GlassCard } from '@/components/ui/GlassCard';

export default function LoginPage() {
  const supabase = createClient();

  async function signIn() {
    const params = new URLSearchParams(window.location.search);
    const redirect = params.get('redirect') ?? '/dashboard';
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo:
          window.location.origin + '/api/auth/callback?next=' + encodeURIComponent(redirect),
        queryParams: { prompt: 'select_account' },
      },
    });
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4"
      style={{ background: 'var(--bg-base)' }}
    >
      {/* Ambient glow behind card */}
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(16,185,129,0.07) 0%, transparent 65%)' }}
        />
        <div
          className="absolute top-1/3 right-1/4 w-[400px] h-[400px] rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(14,165,233,0.05) 0%, transparent 65%)' }}
        />
      </div>

      <div className="relative w-full max-w-sm z-[1]">
        {/* Login card */}
        <GlassCard className="p-8 text-center mb-4">
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl font-bold text-white mx-auto mb-5"
            style={{
              background: 'linear-gradient(135deg, #10b981, #0ea5e9)',
              boxShadow: '0 0 28px rgba(16,185,129,0.4), 0 0 60px rgba(14,165,233,0.15)',
            }}
          >
            F
          </div>
          <h1 className="text-2xl font-semibold mb-1" style={{ color: '#f1f5f9' }}>Finance Bot</h1>
          <p className="text-sm mb-7" style={{ color: 'rgba(241,245,249,0.4)' }}>Personal finance via WhatsApp</p>
          <button
            onClick={signIn}
            className="w-full flex items-center justify-center gap-3 rounded-xl px-5 py-3 text-sm font-medium transition-all"
            style={{
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.1)',
              color: 'rgba(241,245,249,0.85)',
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.1)';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.06)';
            }}
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
            Sign in with Google
          </button>
        </GlassCard>

        {/* How it works */}
        <GlassCard className="p-6">
          <h2
            className="text-xs font-semibold uppercase tracking-widest mb-4"
            style={{ color: 'rgba(241,245,249,0.35)' }}
          >
            How it works
          </h2>
          <ol className="space-y-4">
            {[
              { step: '1', title: 'Sign in & create account', desc: 'Login with Google, then create a finance account on the Accounts page.' },
              { step: '2', title: 'Link WhatsApp', desc: 'Generate a setup code on the Accounts page, then send /setup CODE to the bot on WhatsApp.' },
              { step: '3', title: 'Record transactions', desc: 'Just chat naturally — makan siang 35k, gaji masuk 5jt, bayar listrik 150rb.' },
              { step: '4', title: 'Track on dashboard', desc: 'View your income, expenses, and charts here. Switch between accounts anytime.' },
            ].map(({ step, title, desc }) => (
              <li key={step} className="flex gap-3">
                <span
                  className="w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5"
                  style={{
                    background: 'rgba(16,185,129,0.15)',
                    border: '1px solid rgba(16,185,129,0.3)',
                    color: '#34d399',
                  }}
                >
                  {step}
                </span>
                <div>
                  <p className="text-sm font-medium" style={{ color: 'rgba(241,245,249,0.8)' }}>{title}</p>
                  <p className="text-xs mt-0.5" style={{ color: 'rgba(241,245,249,0.35)' }}>{desc}</p>
                </div>
              </li>
            ))}
          </ol>
        </GlassCard>
      </div>
    </div>
  );
}
