import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { AccountSwitcher } from '@/components/AccountSwitcher';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { SignOutButton } from '@/components/SignOutButton';
import { NavLink } from '@/components/NavLink';

// Must come after imports. Tells Next.js to always render at request time
// so auth cookies are read fresh on every visit.
export const dynamic = 'force-dynamic';

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } },
  );
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  return (
    <div className="min-h-screen bg-[#0f0f11] text-white flex">
      {/* Sidebar — hidden on mobile, visible on md+ */}
      <aside className="hidden md:flex w-56 shrink-0 border-r border-white/[0.06] flex-col">
        {/* Logo */}
        <div className="px-5 py-5 border-b border-white/[0.06]">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-emerald-400 to-teal-600 flex items-center justify-center text-xs font-bold">
              F
            </div>
            <span className="font-semibold text-sm tracking-tight">FinanceBot</span>
          </div>
        </div>
        {/* Account Switcher */}
        <div className="px-3 py-3 border-b border-white/[0.06]">
          <AccountSwitcher />
        </div>
        {/* Nav Links */}
        <nav className="flex-1 px-3 py-3 space-y-0.5">
          <NavLink href="/dashboard" icon="▦" label="Dashboard" />
          <NavLink href="/transactions" icon="↕" label="Transactions" />
          <NavLink href="/accounts" icon="◎" label="Accounts" />
          <NavLink href="/categories" icon="⊞" label="Categories" />
        </nav>
        {/* Footer */}
        <div className="px-3 py-3 border-t border-white/[0.06] space-y-0.5">
          <LanguageSwitcher />
          <SignOutButton />
        </div>
      </aside>
      {/* Mobile top bar — visible on mobile only */}
      <div className="flex flex-col flex-1 min-w-0">
        <header className="md:hidden flex items-center justify-between px-4 py-3 border-b border-white/[0.06] relative z-10">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-gradient-to-br from-emerald-400 to-teal-600 flex items-center justify-center text-xs font-bold">
              F
            </div>
            <span className="font-semibold text-sm">FinanceBot</span>
          </div>
          {/* Language + sign out: horizontal row, z-index ensures clickability */}
          <div className="flex items-center gap-2">
            <LanguageSwitcher />
            <SignOutButton />
          </div>
        </header>
        {/* Mobile bottom nav */}
        <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-[#0f0f11] border-t border-white/[0.06] flex">
          <NavLink href="/dashboard" icon="▦" label="Dashboard" />
          <NavLink href="/transactions" icon="↕" label="Txn" />
          <NavLink href="/accounts" icon="◎" label="Accounts" />
          <NavLink href="/categories" icon="⊞" label="Categories" />
        </nav>
        {/* Main content */}
        <main className="flex-1 min-w-0 p-4 md:p-8 pb-20 md:pb-8 overflow-auto">{children}</main>
      </div>
    </div>
  );
}
