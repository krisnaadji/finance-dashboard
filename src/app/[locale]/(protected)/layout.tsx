// src/app/[locale]/(protected)/layout.tsx
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { AccountSwitcher } from '@/components/AccountSwitcher';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { SignOutButton } from '@/components/SignOutButton';
import { NavLink } from '@/components/NavLink';

export const dynamic = 'force-dynamic';

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } },
  );
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  return (
    <div className="relative z-[1] min-h-screen text-[#f1f5f9] flex" style={{ background: 'var(--bg-base)' }}>
      {/* Film grain overlay */}
      <div aria-hidden className="grain" />
      {/* Desktop Sidebar */}
      <aside
        className="hidden md:flex w-56 shrink-0 flex-col"
        style={{
          borderRight: '1px solid rgba(255,255,255,0.07)',
          background: 'rgba(8,12,16,0.85)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          position: 'sticky',
          top: 0,
          height: '100vh',
        }}
      >
        {/* Logo */}
        <div className="px-5 py-5" style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
          <div className="flex items-center gap-2.5">
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold text-white animate-logo-glow"
              style={{
                background: 'linear-gradient(135deg, #10b981, #0ea5e9)',
              }}
            >
              F
            </div>
            <span
              className="font-semibold text-sm tracking-tight"
              style={{
                background: 'linear-gradient(135deg, #f1f5f9, #34d399)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              FinanceBot
            </span>
          </div>
        </div>

        {/* Account Switcher */}
        <div className="px-3 py-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
          <AccountSwitcher />
        </div>

        {/* Nav Links */}
        <nav className="flex-1 px-3 py-3 space-y-0.5">
          <NavLink href="/dashboard" icon="▦" label="Dashboard" />
          <NavLink href="/transactions" icon="⇅" label="Transactions" />
          <NavLink href="/accounts" icon="◎" label="Accounts" />
          <NavLink href="/categories" icon="⊞" label="Categories" />
        </nav>

        {/* Footer */}
        <div className="px-3 py-3 space-y-0.5" style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}>
          <LanguageSwitcher />
          <SignOutButton />
        </div>
      </aside>

      {/* Mobile top bar */}
      <div className="flex flex-col flex-1 min-w-0">
        <header
          className="md:hidden flex items-center justify-between px-4 py-3 relative z-10"
          style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}
        >
          <div className="flex items-center gap-2">
            <div
              className="w-6 h-6 rounded-md flex items-center justify-center text-xs font-bold text-white"
              style={{
                background: 'linear-gradient(135deg, #10b981, #0ea5e9)',
                boxShadow: '0 0 10px rgba(16,185,129,0.3)',
              }}
            >
              F
            </div>
            <span className="font-semibold text-sm">FinanceBot</span>
          </div>
          <div className="flex items-center gap-2">
            <LanguageSwitcher />
            <SignOutButton />
          </div>
        </header>

        {/* Mobile bottom nav */}
        <nav
          className="md:hidden fixed bottom-0 left-0 right-0 z-50 flex"
          style={{
            background: 'rgba(8,12,16,0.92)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            borderTop: '1px solid rgba(255,255,255,0.07)',
          }}
        >
          <NavLink href="/dashboard" icon="▦" label="Dashboard" />
          <NavLink href="/transactions" icon="⇅" label="Txn" />
          <NavLink href="/accounts" icon="◎" label="Accounts" />
          <NavLink href="/categories" icon="⊞" label="Categories" />
        </nav>

        {/* Main content */}
        <main className="flex-1 min-w-0 p-4 md:p-8 pb-20 md:pb-8 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
