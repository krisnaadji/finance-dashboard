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
      className="rounded-lg px-3 py-2 text-sm text-gray-600 hover:bg-gray-100 border border-gray-200"
    >
      Sign out
    </button>
  );
}
