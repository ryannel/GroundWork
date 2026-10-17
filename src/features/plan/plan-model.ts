import { derive, type Model } from '@/application/plan/derive';
import type { Page } from '@/application/plan-pages';
import { THINGS_SCREEN } from '@/application/plan-pages-things';
import type { IssueStatus } from '@/domain/plan/plan-status';
import type { Plan } from '@/domain/plan/plan.generated';

// The browser reads plan.json once, however many things ask for it (the inspector, the palette), and works the
// rest out with the same derive() the build used. It resolves to null when the plan cannot be had. A workspace's
// model.json is the same document of today, with no work items and so no status.

interface Payload {
  readonly plan: Plan;
  readonly status?: IssueStatus | null;
}

const isPayload = (value: unknown): value is Payload =>
  typeof value === 'object' && value !== null && 'plan' in value;

const models = new Map<string, Promise<Model | null>>();
const documents = new Map<string, Promise<unknown>>();

async function fetchModel(src: string): Promise<Model | null> {
  try {
    const response = await fetch(src);
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

// Marked as React marks a settled promise, so a later page that asks again draws at once.
function markSettled(value: Promise<unknown>): void {
  void value.then(async (settled) => Object.assign(value, { status: 'fulfilled', value: settled }));
}

// use() needs the very same promise on every render, which an async function cannot give, so it takes this
// holder instead: one promise per address, however often asked.
export function pendingModel(relative: string): Pending {
  const src = addressOf(relative);
  const known = models.get(src);
  if (known !== undefined) return { model: known };
  const model = fetchModel(src);
  markSettled(model);
  models.set(src, model);
  return { model };
}

interface PendingJson {
  readonly json: Promise<unknown>;
}

async function fetchJson(src: string): Promise<unknown> {
  try {
    const response = await fetch(src);
    if (!response.ok) return null;
    const body: unknown = await response.json();
    return body;
  } catch {
    return null;
  }
}

/** Any other JSON the build wrote, fetched once; null when it cannot be had. */
export function pendingJson(relative: string): PendingJson {
  const src = addressOf(relative);
  const known = documents.get(src);
  if (known !== undefined) return { json: known };
  const json = fetchJson(src);
  markSettled(json);
  documents.set(src, json);
  return { json };
}
