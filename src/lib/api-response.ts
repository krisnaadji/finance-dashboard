import { NextResponse } from 'next/server';

const messages: Record<string, string> = {
  invalid_request: 'Invalid request', unauthorized: 'Unauthorized', forbidden: 'Forbidden',
  not_found: 'Not found', conflict: 'Operation conflicts with current state',
  internal_error: 'Operation failed', dependency_unavailable: 'Service temporarily unavailable',
  rate_limited: 'Too many translation requests', translation_timeout: 'Translation timed out',
  translation_unavailable: 'Translation temporarily unavailable',
};

export function apiError(status: number, code: string): NextResponse {
  return NextResponse.json({ error: messages[code] ?? messages.internal_error, code }, { status });
}

export function checkMutationRequest(req: Request, requiresJson: boolean): NextResponse | null {
  const origin = req.headers.get('origin');
  if (origin !== null) {
    const requestUrl = new URL(req.url);
    const host = req.headers.get('host');
    if (host !== null) requestUrl.host = host;
    if (origin !== requestUrl.origin) return apiError(403, 'forbidden');
  }
  const contentType = req.headers.get('content-type')?.trim() ?? '';
  if (requiresJson && !/^application\/json(?:\s*;|$)/i.test(contentType)) {
    return apiError(400, 'invalid_request');
  }
  return null;
}
