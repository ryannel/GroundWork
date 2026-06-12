// The core-access seam is proven without a network: fetch is injected, so
// every reachability outcome (ok, non-200, thrown) is a deterministic case.
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_CORE_BASE_URL,
  coreAuthHeaders,
  coreBaseUrl,
  fetchCoreHealth,
} from './core-client';

function fetchReturning(status: number, body: unknown): typeof fetch {
  return (async () =>
    new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    })) as typeof fetch;
}

describe('coreBaseUrl', () => {
  it('defaults to the workspace gateway', () => {
    expect(coreBaseUrl({})).toBe(DEFAULT_CORE_BASE_URL);
  });

  it('honours API_BASE_URL from the environment', () => {
    expect(coreBaseUrl({ API_BASE_URL: 'http://10.0.0.5:4000' })).toBe(
      'http://10.0.0.5:4000',
    );
  });

  it('treats a blank API_BASE_URL as unset', () => {
    expect(coreBaseUrl({ API_BASE_URL: '  ' })).toBe(DEFAULT_CORE_BASE_URL);
  });
});

describe('coreAuthHeaders', () => {
  it('is unauthenticated by default', () => {
    expect(coreAuthHeaders()).toEqual({});
  });

  it('carries a supplied token as a Bearer header', () => {
    expect(coreAuthHeaders('jwt-123')).toEqual({
      Authorization: 'Bearer jwt-123',
    });
  });
});

describe('fetchCoreHealth', () => {
  it('maps a healthy core to reachable + its reported status', async () => {
    const health = await fetchCoreHealth(
      'http://core.test',
      fetchReturning(200, { status: 'ok', checks: { db: 'ok' } }),
    );
    expect(health).toEqual({ reachable: true, status: 'ok' });
  });

  it('requests the /health route of the configured base URL', async () => {
    let requested: string | undefined;
    const probe = (async (input: Parameters<typeof fetch>[0]) => {
      requested = String(input);
      return new Response('{"status":"ok"}', { status: 200 });
    }) as typeof fetch;
    await fetchCoreHealth('http://core.test:4000', probe);
    expect(requested).toBe('http://core.test:4000/health');
  });

  it('maps a non-200 to unreachable with the code as the status', async () => {
    const health = await fetchCoreHealth(
      'http://core.test',
      fetchReturning(503, { error: 'overloaded' }),
    );
    expect(health).toEqual({ reachable: false, status: 'http 503' });
  });

  it('maps a network failure to a value, never a throw', async () => {
    const down = (async () => {
      throw new Error('ECONNREFUSED');
    }) as typeof fetch;
    const health = await fetchCoreHealth('http://core.test', down);
    expect(health).toEqual({ reachable: false, status: 'unreachable' });
  });
});
