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
      {/* Film grain */}
      <div aria-hidden className="grain" />

      {/* Ambient glows */}
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(16,185,129,0.09) 0%, transparent 60%)' }}
        />
        <div
          className="absolute top-1/4 right-1/5 w-[500px] h-[500px] rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(14,165,233,0.06) 0%, transparent 60%)' }}
        />
        <div
          className="absolute bottom-1/4 left-1/5 w-[300px] h-[300px] rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(16,185,129,0.04) 0%, transparent 65%)' }}
        />
      </div>

      <div className="relative w-full max-w-sm z-[1]">
        {/* Logo mark — scales in first */}
        <div className="flex justify-center mb-6 animate-scale-in" style={{ animationDelay: '0ms' }}>
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl font-bold text-white animate-logo-glow"
            style={{
              background: 'linear-gradient(135deg, #10b981, #0ea5e9)',
              fontFamily: 'var(--font-display)',
            }}
          >
            F
          </div>
        </div>

        {/* Wordmark */}
        <div
          className="text-center mb-8 animate-fade-up"
          style={{ animationDelay: '80ms' }}
        >
          <h1
            className="text-3xl font-bold tracking-tight mb-1"
            style={{
              fontFamily: 'var(--font-display)',
              background: 'linear-gradient(135deg, #f1f5f9 30%, #34d399)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              letterSpacing: '-0.01em',
            }}
          >
            Finance Bot
          </h1>
          <p
            className="text-sm"
            style={{ color: 'rgba(241,245,249,0.35)', fontFamily: 'var(--font-display)' }}
          >
            Personal finance via WhatsApp
          </p>
        </div>

        {/* Login card */}
        <div className="animate-fade-up" style={{ animationDelay: '160ms' }}>
          <GlassCard className="p-6 mb-3">
            <button
              onClick={signIn}
              className="w-full flex items-center justify-center gap-3 rounded-xl px-5 py-3.5 text-sm font-medium transition-all duration-200"
              style={{
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.1)',
                color: 'rgba(241,245,249,0.85)',
                fontFamily: 'var(--font-display)',
                letterSpacing: '0.01em',
              }}
              onMouseEnter={(e) => {
                const el = e.currentTarget as HTMLElement;
                el.style.background = 'rgba(255,255,255,0.1)';
                el.style.borderColor = 'rgba(255,255,255,0.18)';
              }}
              onMouseLeave={(e) => {
                const el = e.currentTarget as HTMLElement;
                el.style.background = 'rgba(255,255,255,0.06)';
                el.style.borderColor = 'rgba(255,255,255,0.1)';
              }}
            >
              <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
              Continue with Google
            </button>
          </GlassCard>
        </div>

        {/* How it works */}
        <div className="animate-fade-up" style={{ animationDelay: '260ms' }}>
          <GlassCard className="p-5">
            <h2
              className="text-[10px] font-semibold uppercase tracking-[0.15em] mb-4"
              style={{ color: 'rgba(241,245,249,0.3)', fontFamily: 'var(--font-display)' }}
            >
              How it works
            </h2>
            <ol className="space-y-3.5">
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
                      fontFamily: 'var(--font-display)',
                    }}
                  >
                    {step}
                  </span>
                  <div>
                    <p
                      className="text-sm font-semibold"
                      style={{ color: 'rgba(241,245,249,0.8)', fontFamily: 'var(--font-display)' }}
                    >
                      {title}
                    </p>
                    <p className="text-xs mt-0.5" style={{ color: 'rgba(241,245,249,0.35)' }}>
                      {desc}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </GlassCard>
        </div>
      </div>
    </div>
  );
}
