// Prove frozen plan addresses against the actual canonical registry, without composing plan projections.
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

import type { ModelIndex } from '@/application/model-index';
import { modelPlanOutlineFromCurrent } from '@/application/model-plan-pages';
import { findPage } from '@/application/plan-navigation';
import { tokenToId } from '@/domain/ids';
import { modelList, modelRecord, modelText } from '@/domain/workspace-model';
import { readCanonicalModelIndex } from '@/infrastructure/model-index';
import { readModelPlanEntries } from '@/infrastructure/model-plans';

interface PlanRoute {
  readonly address: string;
  readonly slug: string;
  readonly chapter: string | null;
  readonly screen: string | null;
  readonly token: string | null;
}
function planRoute(value: unknown, workspace: string): PlanRoute | null {
  const address = modelText(value);
  if (address === null) throw new Error('A frozen route must be a string.');
  const parsed = new URL(address, 'https://groundwork.invalid');
  const [id, collection, slug, chapter, screen] = parsed.pathname.split('/').filter(Boolean);
  if (id !== workspace || collection !== 'plans' || slug === undefined) return null;
  return {
    address,
    slug,
    chapter: chapter ?? null,
    screen: screen ?? null,
    token: parsed.searchParams.get('id'),
  };
}
function thingResult(route: PlanRoute, current: ModelIndex, plan: string) {
  const id = route.token === null ? null : tokenToId(route.token);
  const fact = id === null ? null : current.get(id);
  return {
    ...route,
    ok: fact !== null,
    plan,
    kind: 'thing',
    id: fact?.id ?? id,
    label: fact === null ? null : current.label(fact.id),
  };
}
const file = process.argv[2];
if (file === undefined) throw new Error('Usage: check-plan-routes.ts <frozen manifest.json>');
const source = await readFile(file, 'utf8');
const manifest = modelRecord(JSON.parse(source));
const workspace = modelText(manifest?.workspace);
if (workspace === null) throw new Error('Frozen manifest has no workspace identity.');
const routes = modelList(manifest?.routes).flatMap((value) => {
  const route = planRoute(value, workspace);
  return route === null ? [] : [route];
});
const [current, entries] = await Promise.all([
  readCanonicalModelIndex(workspace),
  readModelPlanEntries(workspace),
]);
if (current === null) throw new Error(`No canonical current model for ${workspace}.`);
const plans = new Map(
  entries.map(({ slug, plan }) => [
    slug,
    { plan, outline: modelPlanOutlineFromCurrent(plan, { workspace, slug }, current) },
  ]),
);
const rows = routes.map((route) => {
  const known = plans.get(route.slug);
  if (known === undefined) {
    return { ...route, ok: false, reason: 'No actual canonical plan folder.' };
  }
  if (route.chapter === 'things') return thingResult(route, current, known.plan.meta.id);
  if (route.chapter === 'plan.json') {
    return {
      ...route,
      ok: true,
      plan: known.plan.meta.id,
      kind: 'transport',
      scope: 'Plan identity only',
    };
  }
  const page = findPage(known.outline, route.chapter ?? 'cover', route.screen ?? 'cover');
  return {
    ...route,
    ok: page !== null,
    plan: known.plan.meta.id,
    kind: route.chapter === null ? 'cover' : 'chapter',
    title: page?.title ?? null,
  };
});
const missing = rows.filter((row) => !row.ok);
console.log(
  JSON.stringify(
    {
      format: 1,
      workspace,
      source: { manifest: file, sha256: createHash('sha256').update(source).digest('hex') },
      method:
        'Actual current identities, actual plan folders and authored metadata through the shared native outline. No plan projection or HTTP response is claimed.',
      planCount: plans.size,
      routes: rows.length,
      pages: rows.filter((row) => row.chapter !== 'plan.json').length,
      transports: rows.filter((row) => row.chapter === 'plan.json').length,
      missing: missing.length,
      rows,
    },
    null,
    2,
  ),
);
if (missing.length > 0) process.exitCode = 1;
