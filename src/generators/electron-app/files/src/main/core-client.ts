// The core-access seam: the ONLY place this app talks to the workspace
// gateway. The sandboxed renderer cannot reach the core directly (CSP locks
// it to the bundle origin), so it asks over the typed bridge and main makes
// the request — the desktop twin of the mobile scaffold's thin dio client
// (docs/principles/stack/electron/ipc-contracts.md).
//
// Contract-client stance (O8): hand-rolled and deliberately thin — one
// function per promoted-contract operation, typed results in src/shared/.
// When the promoted openapi.yaml grows past a handful of operations, switch
// to a generated TypeScript client and keep this module as the seam the IPC
// handlers consume — nothing across the bridge changes.
import type { CoreHealth } from '../shared/ipc';

export const DEFAULT_CORE_BASE_URL = 'http://localhost:4000';

/** Where the workspace core lives. The system-test harness (and any packaged
 *  environment) overrides via the API_BASE_URL environment variable. */
export function coreBaseUrl(env: NodeJS.ProcessEnv = process.env): string {
  const configured = env['API_BASE_URL']?.trim();
  return configured ? configured : DEFAULT_CORE_BASE_URL;
}

/** The auth seam: headers attached to every core request. Unauthenticated by
 *  default — wire your identity provider here (e.g. a session JWT becomes
 *  `Authorization: Bearer <token>`); the core's /health route stays public. */
export function coreAuthHeaders(token?: string): Record<string, string> {
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/** Probe the gateway's health endpoint — the wiring proof the renderer's
 *  home view displays. `/health` is what GroundWork's Go and Python cores
 *  serve; a Next.js BFF would be `/api/healthz` — adjust to your gateway.
 *  Failures map to a value, never a throw: an unreachable core is a state
 *  the UI renders, not an exception that kills the handler. */
export async function fetchCoreHealth(
  baseUrl: string = coreBaseUrl(),
  fetchImpl: typeof fetch = fetch,
): Promise<CoreHealth> {
  try {
    const response = await fetchImpl(new URL('/health', baseUrl), {
      headers: { Accept: 'application/json', ...coreAuthHeaders() },
      signal: AbortSignal.timeout(5_000),
    });
    if (!response.ok) {
      return { reachable: false, status: `http ${response.status}` };
    }
    const body = (await response.json()) as { status?: unknown };
    return {
      reachable: true,
      status: typeof body.status === 'string' ? body.status : 'ok',
    };
  } catch {
    return { reachable: false, status: 'unreachable' };
  }
}
