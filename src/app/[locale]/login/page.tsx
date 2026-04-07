'use client';
import { createClient } from '@/lib/supabase-browser';

export default function LoginPage() {
  const supabase = createClient();

  async function signIn() {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin + '/api/auth/callback',
        queryParams: { prompt: 'select_account' }, // always show account picker
      },
    });
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0f0f11] px-4">
      {/* Background glow */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full bg-emerald-500/[0.04] blur-3xl" />
      </div>

      <div className="relative w-full max-w-sm">
        {/* Login card */}
        <div className="bg-white/[0.04] rounded-2xl border border-white/[0.08] p-8 text-center mb-6">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-400 to-teal-600 flex items-center justify-center text-xl font-bold mx-auto mb-5">
            F
          </div>
          <h1 className="text-2xl font-semibold text-white mb-1">Finance Bot</h1>
          <p className="text-white/40 text-sm mb-6">Personal finance via WhatsApp</p>
          <button
            onClick={signIn}
            className="w-full flex items-center justify-center gap-3 rounded-xl border border-white/[0.1] bg-white/[0.06] px-5 py-3 text-sm font-medium text-white hover:bg-white/[0.1] transition-all"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
            Sign in with Google
          </button>
        </div>

        {/* How it works */}
        <div className="bg-white/[0.03] rounded-2xl border border-white/[0.06] p-6">
          <h2 className="text-xs font-semibold text-white/50 uppercase tracking-widest mb-4">
            How it works
          </h2>
          <ol className="space-y-4">
            {[
              {
                step: '1',
                title: 'Sign in & create account',
                desc: 'Login with Google, then create a finance account on the Accounts page.',
              },
              {
                step: '2',
                title: 'Link WhatsApp',
                desc: 'Generate a setup code on the Accounts page, then send /setup CODE to the bot on WhatsApp.',
              },
              {
                step: '3',
                title: 'Record transactions',
                desc: 'Just chat naturally — makan siang 35k, gaji masuk 5jt, bayar listrik 150rb.',
              },
              {
                step: '4',
                title: 'Track on dashboard',
                desc: 'View your income, expenses, and charts here. Switch between accounts anytime.',
              },
            ].map(({ step, title, desc }) => (
              <li key={step} className="flex gap-3">
                <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                  {step}
                </span>
                <div>
                  <p className="text-sm font-medium text-white/80">{title}</p>
                  <p className="text-xs text-white/35 mt-0.5">{desc}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </div>
  );
}
