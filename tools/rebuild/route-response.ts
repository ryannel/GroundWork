// Reads one local route response within a deadline as inert comparison data.
import { htmlFields } from './html';

export interface RouteCapture {
  readonly route: string;
  readonly status: number;
  readonly type: string;
  readonly htmlBytes: number | null;
  readonly headings: readonly string[];
  readonly links: readonly string[];
  readonly payload: unknown;
}

function localRoute(origin: string, route: string): URL {
  const base = new URL(origin);
  const loopback = ['127.0.0.1', 'localhost', '[::1]'].includes(base.hostname);
  if (!loopback || !['http:', 'https:'].includes(base.protocol)) {
    throw new Error('Capture requires a loopback HTTP origin.');
  }
  if (base.username !== '' || base.password !== '') {
    throw new Error('Capture does not accept URL credentials.');
  }
  const url = new URL(route, base);
  if (!route.startsWith('/') || route.startsWith('//') || url.origin !== base.origin) {
    throw new Error('Capture requires a same-origin route path.');
  }
  return url;
}

export async function captureRoute(origin: string, route: string): Promise<RouteCapture> {
  const url = localRoute(origin, route);
  const response = await fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(120_000) });
  if (response.status >= 500) throw new Error(`${route}: HTTP ${String(response.status)}`);
  const body = await response.text();
  const type = response.headers.get('content-type')?.split(';')[0] ?? '';
  if (type === 'application/json') {
    return {
      route,
      status: response.status,
      type,
      htmlBytes: null,
      headings: [],
      links: [],
      payload: JSON.parse(body),
    };
  }
  if (type !== 'text/html') throw new Error(`${route}: unsupported content type ${type}`);
  return {
    route,
    status: response.status,
    type,
    htmlBytes: Buffer.byteLength(body),
    ...htmlFields(body, url),
  };
}
