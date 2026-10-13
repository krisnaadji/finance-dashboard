import { describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';
import { checkMutationRequest } from '../src/lib/api-response';

describe('cookie mutation boundary', () => {
  it('rejects another origin before mutation', async () => {
    const response = checkMutationRequest(new Request('https://app.example/api/categories', {
      method: 'POST',
      headers: { origin: 'https://outsider.example', 'content-type': 'application/json' },
      body: '{}',
    }), true);
    expect(response?.status).toBe(403);
    expect(await response?.json()).toMatchObject({ code: 'forbidden' });
  });
  it('accepts matching origin and rejects JSON-looking text/plain', () => {
    expect(checkMutationRequest(new Request('https://app.example/api/categories', {
      method: 'POST', headers: { origin: 'https://app.example', 'content-type': 'application/json; charset=utf-8' }, body: '{}',
    }), true)).toBeNull();
    expect(checkMutationRequest(new Request('https://app.example/api/categories', {
      method: 'POST', headers: { 'content-type': 'text/plain' }, body: '{}',
    }), true)?.status).toBe(400);
  });
  it('permits a bodyless same-origin DELETE', () => {
    expect(checkMutationRequest(new Request('https://app.example/api/budgets?id=example', {
      method: 'DELETE', headers: { origin: 'https://app.example' },
    }), false)).toBeNull();
  });
  it('accepts the browser origin when Next normalizes a loopback request URL', () => {
    const request = new NextRequest('http://127.0.0.1:3093/api/transactions', {
      method: 'POST',
      headers: { host: '127.0.0.1:3093', origin: 'http://127.0.0.1:3093', 'content-type': 'application/json' },
      body: '{}',
    });
    expect(checkMutationRequest(request, true)).toBeNull();
  });
  it('rejects a different loopback origin even when it matches the normalized URL', () => {
    const request = new NextRequest('http://127.0.0.1:3093/api/transactions', {
      method: 'POST',
      headers: { host: '127.0.0.1:3093', origin: 'http://localhost:3093', 'content-type': 'application/json' },
      body: '{}',
    });
    expect(checkMutationRequest(request, true)?.status).toBe(403);
  });
});
