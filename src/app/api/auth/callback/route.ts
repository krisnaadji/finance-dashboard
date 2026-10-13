import { createRequestClient } from '@/lib/server-auth';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { apiError } from '@/lib/api-response';

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const store = await cookies();
    const locale = store.getAll().find(c => c.name === 'NEXT_LOCALE')?.value === 'en' ? 'en' : 'id';
    const defaultPath = locale === 'en' ? '/en/dashboard' : '/dashboard';
    const loginPath = locale === 'en' ? '/en/login' : '/login';
    const next = url.searchParams.get('next') ?? defaultPath;
    if (!next.startsWith('/') || next.startsWith('//') || next.includes('\\')) return apiError(400, 'invalid_request');
    const target = new URL(next, url.origin);
    if (target.origin !== url.origin) return apiError(400, 'invalid_request');
    const code = url.searchParams.get('code');
    if (!code) return NextResponse.redirect(new URL(`${loginPath}?error=auth`, url.origin));
    try {
      const client = await createRequestClient();
      const result = await client.auth.exchangeCodeForSession(code);
      if (result.error) return NextResponse.redirect(new URL(`${loginPath}?error=auth`, url.origin));
    } catch {
      return NextResponse.redirect(new URL(`${loginPath}?error=auth`, url.origin));
    }
    return NextResponse.redirect(target);
  } catch {
    return apiError(500, 'internal_error');
  }
}
