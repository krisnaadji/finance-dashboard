'use client';
import { createClient } from '@/lib/supabase-browser';
import { useRouter } from 'next/navigation';

export function SignOutButton() {
  const supabase = createClient();
  const router = useRouter();

  async function signOut() {
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  }

  return (
    <button
      onClick={signOut}
      type="button"
      className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-white/40
        hover:text-white/70 hover:bg-white/[0.06] transition-all duration-150 w-full text-left"
    >
      <span className="text-xs">⎋</span>
      Sign out
    </button>
  );
}
