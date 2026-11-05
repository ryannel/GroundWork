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

function decode(text: string): string {
  return text
    .replaceAll('&amp;', '&')
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&quot;', '"')
    .replaceAll('&#x27;', "'")
    .replaceAll('&#39;', "'")
    .replaceAll('&nbsp;', ' ');
}

const textOf = (html: string): string =>
  decode(html.replaceAll(/<[^<>]*>/gu, ' '))
    .replaceAll(/\s+/gu, ' ')
    .trim();

export interface RouteCapture {
  readonly route: string;
  readonly status: number;
  readonly type: string;
  readonly htmlBytes: number | null;
  readonly headings: readonly string[];
  readonly links: readonly string[];
  readonly payload: unknown;
}

export async function captureRoute(origin: string, route: string): Promise<RouteCapture> {
  const url = new URL(route, origin);
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
  const content = body
    .replaceAll(/<script\b[^>]*>[\s\S]*?<\/script>/gu, '')
    .replaceAll(/<style\b[^>]*>[\s\S]*?<\/style>/gu, '');
  const links = new Set<string>();
  for (const match of content.matchAll(/\bhref="([^"]+)"/gu)) {
    const href = decode(match[1] ?? '');
    if (!URL.canParse(href, url)) continue;
    const target = new URL(href, url);
    if (target.origin === url.origin && !target.pathname.startsWith('/_next/')) {
      links.add(target.pathname + target.search + target.hash);
    }
  }
  return {
    route,
    status: response.status,
    type,
    htmlBytes: Buffer.byteLength(body),
    headings: [...content.matchAll(/<h[1-6]\b[^>]*>([\s\S]*?)<\/h[1-6]>/gu)].map((match) =>
      textOf(match[1] ?? ''),
    ),
    links: [...links].toSorted((a, b) => a.localeCompare(b)),
    payload: {
      text: textOf(content),
      inspectedIds: [
        ...new Set(
          [...content.matchAll(/\bdata-inspect="([^"]+)"/gu)].map((match) =>
            decode(match[1] ?? ''),
          ),
        ),
      ].toSorted((a, b) => a.localeCompare(b)),
    },
  };
}
