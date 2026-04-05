import { createClient as createSupabaseClient } from '@supabase/supabase-js';

// Uses service key — bypasses RLS. Only call from API routes or Server Components.
// Never import this in client components or expose to the browser.
export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!,
  );
}
