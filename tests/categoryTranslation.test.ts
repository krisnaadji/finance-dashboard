import { afterEach, expect, it, vi } from 'vitest';
import { resetSecurityState } from './helpers/securityState';
import { ids } from './helpers/dashboardDb';
import { POST } from '../src/app/api/categories/translate/route';
import { translateCategoryName } from '../src/lib/category-translation';
vi.mock('server-only', () => ({}));
afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
function request(body: unknown, headers: Record<string, string> = {}) {
  return new Request('https://app.example/api/categories/translate', {
    method: 'POST', headers: { origin: 'https://app.example', 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
}
const input = { account_id: ids.a, name: 'Perawatan kucing', source: 'id', target: 'en' };
const translationInput = { name: 'Perawatan kucing', source: 'id', target: 'en' } as const;
function provider(name = 'groq') {
  vi.stubEnv('AI_PROVIDER', name); vi.stubEnv('AI_API_KEY', 'test-only'); vi.stubEnv('AI_MODEL', '');
}
it('denies unauthenticated users before reserving quota or contacting a provider', async () => {
  const db = resetSecurityState(null); const fetcher = vi.fn(); vi.stubGlobal('fetch', fetcher);
  const rpc = vi.fn(); db.rpcOverride = rpc;
  expect((await POST(request(input))).status).toBe(401);
  expect(fetcher).not.toHaveBeenCalled(); expect(rpc).not.toHaveBeenCalled();
});
it('denies a member before quota or provider access', async () => {
  const db = resetSecurityState(ids.member); const fetcher = vi.fn(); vi.stubGlobal('fetch', fetcher);
  const rpc = vi.fn(); db.rpcOverride = rpc;
  expect((await POST(request(input))).status).toBe(403);
  expect(fetcher).not.toHaveBeenCalled(); expect(rpc).not.toHaveBeenCalled();
});
it('denies an exhausted owner quota without sending label text', async () => {
  const db = resetSecurityState(ids.owner); db.rpcOverride = async () => ({ data: false, error: null });
  const fetcher = vi.fn(); vi.stubGlobal('fetch', fetcher);
  expect((await POST(request(input))).status).toBe(429); expect(fetcher).not.toHaveBeenCalled();
});
it('returns only a validated provider label and never writes categories', async () => {
  const db = resetSecurityState(ids.owner);
  db.rpcOverride = async (name, args) => {
    expect(name).toBe('reserve_category_translation');
    expect(args).toEqual({ p_user_id: ids.owner, p_account_id: ids.a });
    return { data: true, error: null };
  };
  provider(); const before = structuredClone(db.tables.categories);
  const fetcher = vi.fn(async () => Response.json({ choices: [{ message: { content: 'Cat Care' } }] }));
  vi.stubGlobal('fetch', fetcher);
  const response = await POST(request(input));
  expect(response.status).toBe(200); expect(await response.json()).toEqual({ translation: 'Cat Care' });
  expect(db.tables.categories).toEqual(before); expect(fetcher).toHaveBeenCalledTimes(1);
});
it('uses the fixed Groq host, server model, bounded output, and untrusted label data', async () => {
  provider(); vi.stubEnv('AI_MODEL', 'configured-model');
  const fetcher = vi.fn<typeof fetch>(async (url, init) => {
    expect(url).toBe('https://api.groq.com/openai/v1/chat/completions');
    expect(init).toMatchObject({ method: 'POST', cache: 'no-store', redirect: 'error' });
    expect(new Headers(init?.headers).get('authorization')).toBe('Bearer test-only');
    expect(JSON.parse(String(init?.body))).toMatchObject({ model: 'configured-model', max_tokens: 128, temperature: 0 });
    expect(String(init?.body)).not.toContain('account_id');
    return Response.json({ choices: [{ message: { content: ' Cat Care ' } }] });
  });
  expect(await translateCategoryName(translationInput, { fetch: fetcher })).toBe('Cat Care');
  expect(fetcher).toHaveBeenCalledTimes(1);
});
it('translates a real Gemini-shaped response through its fixed host', async () => {
  provider('gemini');
  const fetcher = vi.fn<typeof fetch>(async (url, init) => {
    expect(url).toBe('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent');
    expect(new Headers(init?.headers).get('x-goog-api-key')).toBe('test-only');
    expect(JSON.parse(String(init?.body))).toMatchObject({ generationConfig: { maxOutputTokens: 128, temperature: 0 } });
    return Response.json({ candidates: [{ content: { parts: [{ text: 'Cat Care' }] } }] });
  });
  expect(await translateCategoryName(translationInput, { fetch: fetcher })).toBe('Cat Care');
  expect(fetcher).toHaveBeenCalledTimes(1);
});
it.each(['', 'a\nb', 'x'.repeat(121), 'hello\u0000', '\u2028Cat'])('rejects invalid provider labels', async content => {
  provider(); const fetcher = vi.fn<typeof fetch>(async () => Response.json({ choices: [{ message: { content } }] }));
  await expect(translateCategoryName(translationInput, { fetch: fetcher })).rejects.toMatchObject({ status: 502 });
  expect(fetcher).toHaveBeenCalledTimes(1);
});
it('rejects unsupported provider without making a request', async () => {
  provider('other'); const fetcher = vi.fn();
  await expect(translateCategoryName(translationInput, { fetch: fetcher })).rejects.toMatchObject({ status: 503 });
  expect(fetcher).not.toHaveBeenCalled();
});
it('aborts the single provider request after eight seconds without retry', async () => {
  vi.useFakeTimers(); provider();
  const signals: AbortSignal[] = [];
  const fetcher = vi.fn<typeof fetch>((_url, init) => {
    const {promise, reject} = Promise.withResolvers<Response>();
    if (init?.signal) {
      signals.push(init.signal);
      init.signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true });
    }
    return promise;
  });
  const result = expect(translateCategoryName(translationInput, { fetch: fetcher })).rejects.toMatchObject({ status: 504 });
  await vi.advanceTimersByTimeAsync(8000); await result;
  expect(signals[0]?.aborted).toBe(true); expect(fetcher).toHaveBeenCalledTimes(1);
});
it.each([401, 429, 500])('redacts provider errors and never retries HTTP %s', async status => {
  provider(); const fetcher = vi.fn<typeof fetch>(async () => new Response('PRIVATE PROVIDER BODY test-only', { status }));
  await expect(translateCategoryName(translationInput, { fetch: fetcher })).rejects.toMatchObject({ status: 502, message: 'category_translation_unavailable' });
  expect(fetcher).toHaveBeenCalledTimes(1);
});
it.each([{ ...input, source: 'fr' }, { ...input, target: 'id' }, { ...input, name: 'a\nb' },
  { ...input, name: '😀'.repeat(121) }, { ...input, model: 'client-selected' }])('rejects invalid translation input %j', async body => {
  resetSecurityState(ids.owner); expect((await POST(request(body))).status).toBe(400);
});
it('checks same-origin and both declared and streamed body caps before quota', async () => {
  const db = resetSecurityState(ids.owner); const rpc = vi.fn(); db.rpcOverride = rpc;
  expect((await POST(request(input, { origin: 'https://attacker.example' }))).status).toBe(403);
  expect((await POST(request(input, { 'content-length': '4097' }))).status).toBe(400);
  expect((await POST(request({ ...input, extra: 'x'.repeat(4096) }))).status).toBe(400);
  expect(rpc).not.toHaveBeenCalled();
});
it('returns controlled unavailable when quota storage fails without calling AI', async () => {
  const db = resetSecurityState(ids.owner); db.rpcOverride = async () => ({ data: null, error: { code: '08006' } });
  const fetcher = vi.fn(); vi.stubGlobal('fetch', fetcher);
  const response = await POST(request(input)); expect(response.status).toBe(503);
  expect(await response.json()).toMatchObject({ code: 'dependency_unavailable' }); expect(fetcher).not.toHaveBeenCalled();
});
