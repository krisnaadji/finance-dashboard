import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { AccountSwitcher } from '@/components/AccountSwitcher';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { SignOutButton } from '@/components/SignOutButton';
import Link from 'next/link';

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
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-100 px-6 py-3 flex items-center gap-4">
        <span className="font-semibold text-gray-900 mr-4">Finance Bot</span>
        <Link href="/dashboard" className="text-sm text-gray-600 hover:text-gray-900">
          Dashboard
        </Link>
        <Link href="/transactions" className="text-sm text-gray-600 hover:text-gray-900">
          Transactions
        </Link>
        <Link href="/accounts" className="text-sm text-gray-600 hover:text-gray-900">
          Accounts
        </Link>
        <Link href="/categories" className="text-sm text-gray-600 hover:text-gray-900">
          Categories
        </Link>
        <div className="ml-auto flex items-center gap-3">
          <AccountSwitcher />
          <LanguageSwitcher />
          <SignOutButton />
        </div>
      </nav>
      <main className="max-w-6xl mx-auto px-6 py-8">{children}</main>
    </div>
  );
}
