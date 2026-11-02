import { derive, type Model } from '@/application/plan/derive';
import type { Page } from '@/application/plan-pages';
import { THINGS_SCREEN } from '@/application/plan-pages-things';
import type { IssueStatus } from '@/domain/plan/plan-status';
import type { Plan } from '@/domain/plan/plan.generated';

// The browser shares a fresh plan.json read, however many things ask for it (the inspector, the palette), and works the
// rest out with the same derive() the build used. It resolves to null when the plan cannot be had. A workspace's
// model.json is the same document of today, with no work items and so no status.

interface Payload {
  readonly plan: Plan;
  readonly status?: IssueStatus | null;
}

const isPayload = (value: unknown): value is Payload =>
  typeof value === 'object' && value !== null && 'plan' in value;

interface CachedModel {
  readonly promise: Promise<Model | null>;
  readonly expires: number;
}

// Pending reads always share a promise. Settled data is fresh for a minute; failures retry after five seconds.
const models = new Map<string, CachedModel>();
const FRESH_MS = 60_000;
const RETRY_MS = 5000;
const MAX_MODELS = 20;

async function fetchModel(src: string): Promise<Model | null> {
  try {
    const response = await fetch(src, { cache: 'no-store' });
    if (!response.ok) return null;
    const body: unknown = await response.json();
    if (!isPayload(body)) return null;
    return derive(body.plan, { status: body.status ?? {}, today: new Date() });
  } catch {
    return null;
  }
}

// plan.json sits beside the cover, one level up from the things page and two from a screen; a relative address
// works under any base path.
export function planJsonOf(page: Page): string {
  if (page.chapter === 'cover' && page.screen === 'cover') return 'plan.json';
  return page.chapter === 'ref' && page.screen === THINGS_SCREEN
    ? '../plan.json'
    : '../../plan.json';
}

interface Pending {
  readonly model: Promise<Model | null>;
}

const addressOf = (relative: string): string => new URL(relative, globalThis.location.href).href;

// use() needs the very same promise on every render, which an async function cannot give, so it takes this
// holder instead: one promise per address, however often asked.
export function pendingModel(relative: string): Pending {
  const src = addressOf(relative);
  const known = models.get(src);
  if (known !== undefined && known.expires > Date.now()) return { model: known.promise };
  const promise = fetchModel(src);
  const entry = { promise, expires: Number.POSITIVE_INFINITY };
  models.delete(src);
  models.set(src, entry);
  void promise.then((model) => {
    if (models.get(src) !== entry) return;
    models.set(src, { promise, expires: Date.now() + (model === null ? RETRY_MS : FRESH_MS) });
    for (const [address, cached] of models) {
      if (models.size <= MAX_MODELS) break;
      if (cached.expires !== Number.POSITIVE_INFINITY) models.delete(address);
    }
  });
  return { model: promise };
}
