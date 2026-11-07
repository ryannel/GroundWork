// Representative native surfaces complement (never replace) the frozen baseline's route selection.
import { entryFlowHref } from '@/application/entry-flow-paths';
import type { ModelIndex } from '@/application/model-index';
import { keyOf } from '@/application/plan-pages-key';
import { journeyHref } from '@/application/today-reader';
import { idToToken, stripPrefix } from '@/domain/ids';
import type { ModelPlanEntry } from '@/infrastructure/model-plans';

const CATALOGUES: Readonly<Record<string, readonly string[]>> = {
  components: ['service', 'app', 'external', 'library'],
  stores: ['store', 'topic'],
  apis: ['endpoint'],
  schemas: ['schema'],
  events: ['message'],
  flows: ['flow'],
  screens: ['screen'],
  operations: ['operation'],
};
function structuralRoutes(index: ModelIndex): readonly string[] {
  const model = index.model;
  const base = `/${model.id}/`;
  const routes: string[] = [];
  const domain = model.domains[0];
  if (domain !== undefined) {
    const at = `${base}${stripPrefix(domain.id, 'dom')}/`;
    for (const tail of ['', 'plans/', 'flows/', 'map/', 'language/', 'interfaces/', 'target/']) {
      routes.push(at + tail);
    }
    const system = domain.systems[0];
    if (system !== undefined) routes.push(`${at}${stripPrefix(system.id, 'sys')}/`);
  }
  const area = model.landscape?.areas[0];
  if (area !== undefined) {
    const at = `${base}areas/${stripPrefix(area.id, 'area')}/`;
    routes.push(at, `${at}map.json`);
  }
  return routes;
}
function catalogueRoutes(index: ModelIndex): readonly string[] {
  const model = index.model;
  const base = `/${model.id}/`;
  const routes: string[] = [];
  for (const [kind, members] of Object.entries(CATALOGUES)) {
    const first = index.entities.find((node) => members.includes(node.kind));
    if (first === undefined) continue;
    routes.push(`${base}reference/${kind}/`, `${base}things/?id=${idToToken(first.id)}`);
  }
  for (const kind of ['journey', 'flow']) {
    const first = index.entities.find((node) => node.kind === kind);
    if (first !== undefined) routes.push(journeyHref(model.id, keyOf(first.id)));
  }
  return routes;
}
function entryRoutes(index: ModelIndex): readonly string[] {
  const entries = index.entries();
  return ['endpoint', 'subscription', 'job', 'interaction'].flatMap((kind) => {
    const first = entries.find((node) => node.kind === kind);
    return first === undefined ? [] : [entryFlowHref(index.model.id, { entry: first.id })];
  });
}
function planRoutes(
  index: ModelIndex,
  plans: readonly ModelPlanEntry[],
  revisions: ReadonlyMap<string, readonly string[]>,
): readonly string[] {
  const routes: string[] = [];
  const entry = index.entries()[0];
  for (const { slug, plan } of plans) {
    const at = `/${index.model.id}/plans/${slug}/`;
    routes.push(at, `${at}plan.json`);
    for (const version of revisions.get(slug) ?? []) {
      routes.push(`${at}revisions/${version}/plan.json`);
    }
    if (entry === undefined) continue;
    for (const version of ['before', 'after'] as const) {
      routes.push(entryFlowHref(index.model.id, { entry: entry.id, plan: plan.meta.id, version }));
    }
  }
  return routes;
}
export function selectedModelRoutes(
  index: ModelIndex,
  plans: readonly ModelPlanEntry[],
  revisions: ReadonlyMap<string, readonly string[]>,
): readonly string[] {
  const { model } = index;
  const base = `/${model.id}/`;
  return [
    ...new Set([
      '/',
      base,
      ...[
        'language/',
        'people/',
        'value-flows/',
        'plans/',
        'programmes/',
        'partners/',
        'journeys/',
        'reference/',
        'explorer/',
        'model.json',
        'entries/',
      ].map((route) => base + route),
      ...structuralRoutes(index),
      ...catalogueRoutes(index),
      ...entryRoutes(index),
      ...planRoutes(index, plans, revisions),
      ...model.programmes.map(
        (programme) => `${base}programmes/${stripPrefix(programme.id, 'prog')}/`,
      ),
      ...(model.teams ?? [])
        .filter((team) => team.partner === true)
        .map((team) => `${base}partners/${stripPrefix(team.id, 'team')}/`),
    ]),
  ].toSorted((a, b) => a.localeCompare(b));
}
