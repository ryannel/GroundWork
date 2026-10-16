import { derive, type Model } from '@/application/plan/derive';
import type { Page } from '@/application/plan-pages';
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

const loaded = new Map<string, Promise<Model | null>>();

async function fetchModel(src: string): Promise<Model | null> {
  try {
    const response = await fetch(src);
    if (!response.ok) return null;
    const body: unknown = await response.json();
    if (!isPayload(body)) return null;
    return derive(body.plan, { status: body.status ?? {} });
  } catch {
    return null;
  }
}

// plan.json sits beside the cover, and two levels up from a screen; a relative address works under any base path.
export const planJsonOf = (page: Page): string =>
  page.chapter === 'cover' && page.screen === 'cover' ? 'plan.json' : '../../plan.json';

interface Pending {
  readonly model: Promise<Model | null>;
}

// use() needs the very same promise on every render, which an async function cannot give, so it takes this
// holder instead.
export function pendingModel(relative: string): Pending {
  const src = new URL(relative, globalThis.location.href).href;
  const known = loaded.get(src);
  if (known !== undefined) return { model: known };
  const model = fetchModel(src);
  // Marked as React marks a settled promise, so a later page that asks again draws at once.
  void model.then(async (value) => Object.assign(model, { status: 'fulfilled', value }));
  loaded.set(src, model);
  return { model };
}
