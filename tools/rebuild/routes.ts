// Explicit representative routes cover each model-reading surface; full JSON payloads travel beside them.

import { type Model, derive } from '@/application/plan/derive';
import { outlineOf } from '@/application/plan-pages';
import { idToToken } from '@/application/plan-pages-hash';
import { journeyIndexOf } from '@/application/today-journey-index';
import { referenceOf } from '@/application/today-reference';
import type { AuthoredLandscape } from '@/domain/landscape';
import type { Workspace } from '@/domain/workspace';
import { listRevisions } from '@/infrastructure/plan-store';
import { readToday } from '@/infrastructure/today-model';
import { readAuthoredLandscape } from '@/infrastructure/workspace-landscape';
import { readLoadedPlans } from '@/infrastructure/workspace-plans';
import { readProgrammes } from '@/infrastructure/workspace-programmes';

function structuralRoutes(
  id: string,
  workspace: Workspace,
  landscape: AuthoredLandscape | null,
): readonly string[] {
  const base = `/${id}/`;
  const routes = new Set<string>();
  const domain = workspace.domains[0];
  if (domain !== undefined) {
    const at = `${base}${domain.id}/`;
    for (const tail of ['', 'plans/', 'flows/', 'map/', 'language/', 'interfaces/', 'target/']) {
      routes.add(at + tail);
    }
    const system = domain.systems[0];
    if (system !== undefined) routes.add(`${at}${system.id}/`);
  }
  const area = landscape?.areas[0];
  if (area !== undefined) {
    routes.add(`${base}areas/${area.id}/`);
    routes.add(`${base}areas/${area.id}/map.json`);
  }
  return [...routes];
}

async function catalogueRoutes(
  id: string,
  workspace: Workspace,
  model: Model,
): Promise<readonly string[]> {
  const base = `/${id}/`;
  const routes = new Set<string>();
  for (const group of journeyIndexOf(workspace, model).groups) {
    const row = group.rows[0];
    if (row !== undefined) routes.add(row.href);
  }
  for (const programme of await readProgrammes(workspace)) {
    routes.add(`${base}programmes/${programme.id}/`);
  }
  for (const team of workspace.teams.filter((item) => item.partner === true)) {
    routes.add(`${base}partners/${team.id.replace(/^team:/u, '')}/`);
  }
  for (const entry of referenceOf(model)) routes.add(`${base}reference/${entry.kind}/`);
  return [...routes];
}

async function planRoutes(id: string): Promise<readonly string[]> {
  const base = `/${id}/`;
  const routes = new Set<string>();
  for (const loaded of await readLoadedPlans(id)) {
    const at = `${base}plans/${loaded.slug}/`;
    routes.add(at);
    routes.add(`${at}plan.json`);
    for (const version of await listRevisions(id, loaded.slug)) {
      routes.add(`${at}revisions/${version}/plan.json`);
    }
    const node = loaded.plan.services[0];
    if (node !== undefined) routes.add(`${at}things/?id=${idToToken(node.id)}`);
    const model = derive(loaded.plan);
    for (const chapter of outlineOf(model, { workspace: id, slug: loaded.slug }).chapters) {
      const page = chapter.pages[0];
      if (page !== undefined) routes.add(page.href);
    }
  }
  return [...routes];
}

export async function selectedRoutes(id: string): Promise<readonly string[]> {
  const current = await readToday(id);
  if (current === null) throw new Error(`Cannot read ${id}.`);
  const base = `/${id}/`;
  const routes = new Set([
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
    ].map((route) => base + route),
  ]);
  for (const route of structuralRoutes(id, current.workspace, await readAuthoredLandscape(id))) {
    routes.add(route);
  }
  const graph = current.today.model.asIs;
  for (const list of [
    graph.services,
    graph.stores,
    graph.endpoints,
    graph.messages,
    graph.schemas,
    graph.handlers,
  ]) {
    const node = list[0];
    if (node !== undefined) routes.add(`${base}things/?id=${idToToken(node.id)}`);
  }
  for (const route of await catalogueRoutes(id, current.workspace, current.today.model)) {
    routes.add(route);
  }
  for (const route of await planRoutes(id)) routes.add(route);
  return [...routes].toSorted((a, b) => a.localeCompare(b));
}
