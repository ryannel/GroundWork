// The system model as an index an agent can ask: find a fact, see where it lives in the code, follow what
// calls what, and say which repos the answer may be stale for. Pure; tools/map.ts prints it as JSON.
import { prop } from '@/application/plan/ids';
import type { SystemModel } from '@/application/workspace-model';
import { systemsOf, type Workspace } from '@/domain/workspace';
import { type CodeSource, type Origin, permalinkOf, type Scan } from '@/domain/workspace-model';

export interface Cited {
  readonly repo: string;
  readonly path: string;
  readonly commit: string;
  readonly lines?: readonly [number, number];
  readonly url: string;
}

export interface MapFact {
  readonly id: string;
  readonly type: string;
  readonly name: string;
  readonly summary: string | null;
  readonly domain: string | null;
  readonly system: string | null;
  readonly component: string | null;
  readonly origin: Origin | null;
  readonly sources: readonly Cited[];
  /** Set when the fact has no sources of its own and these are its interface's, schema's or component's. */
  readonly sourcesOf: string | null;
}

/** How current the map is for one repo: the commit it was last read at, or null when never scanned. */
export interface RepoState {
  readonly repo: string;
  readonly system: string;
  readonly head: string | null;
  readonly branch: string | null;
  readonly scannedAt: string | null;
}

export interface SystemMap {
  readonly workspace: Workspace;
  readonly system: SystemModel;
  readonly facts: ReadonlyMap<string, MapFact>;
  readonly repos: readonly RepoState[];
}

const TEXT_KEYS = ['summary', 'does', 'description', 'purpose'];

export function systemMapOf(workspace: Workspace, system: SystemModel): SystemMap {
  const where = placesOf(workspace);
  const facts = new Map<string, MapFact>();
  for (const [id, node] of system.model.asIs.byId) {
    const place = placeOf(id, system, where);
    facts.set(id, {
      id,
      type: system.model.typeOf(id) ?? 'thing',
      name: system.model.label(id),
      summary: textOf(node),
      ...place,
      origin: system.attribution[id]?.origin ?? null,
      ...sourcesFor(id, { node, place }, system),
    });
  }
  return { workspace, system, facts, repos: reposOf(workspace, system.scans) };
}

interface Place {
  readonly domain: string | null;
  readonly system: string | null;
  readonly component: string | null;
}

/** Each component's system and domain, and each system's domain, keyed by id (systems as `sys:<id>`). */
function placesOf(workspace: Workspace): Map<string, Place> {
  const out = new Map<string, Place>();
  for (const domain of workspace.domains) {
    for (const system of domain.systems) {
      out.set(`sys:${system.id}`, { domain: domain.id, system: system.id, component: null });
      for (const component of system.components) {
        out.set(component.id, { domain: domain.id, system: system.id, component: component.id });
      }
    }
  }
  return out;
}

function placeOf(id: string, system: SystemModel, where: Map<string, Place>): Place {
  const direct = where.get(id);
  if (direct !== undefined) return direct;
  const owner = system.model.ownerService(id);
  const found = owner === null ? undefined : where.get(owner);
  return found ?? { domain: null, system: null, component: null };
}

// A nested fact (an endpoint, a field) is found in the file that holds its parent, so cite that.
function sourcesFor(
  id: string,
  around: { node: unknown; place: Place },
  system: SystemModel,
): { sources: Cited[]; sourcesOf: string | null } {
  const parent = prop(around.node, '$parent');
  const service = prop(around.node, '$service');
  const tries = [id, parent, service, around.place.component].filter(
    (each): each is string => typeof each === 'string',
  );
  for (const each of tries) {
    const sources = system.attribution[each]?.sources ?? [];
    if (sources.length > 0)
      return { sources: citedOf(sources), sourcesOf: each === id ? null : each };
  }
  return { sources: [], sourcesOf: null };
}

function textOf(node: unknown): string | null {
  for (const key of TEXT_KEYS) {
    const value = prop(node, key);
    if (typeof value === 'string') return value;
  }
  return null;
}

function citedOf(sources: readonly CodeSource[]): Cited[] {
  return sources.map(({ repo, path, commit, lines }) => ({
    repo,
    path,
    commit,
    ...(lines === undefined ? {} : { lines }),
    url: permalinkOf({ repo, path, commit, ...(lines === undefined ? {} : { lines }) }),
  }));
}

function reposOf(workspace: Workspace, scans: readonly Scan[]): RepoState[] {
  const byRepo = new Map(scans.map((scan) => [scan.repo, scan]));
  return systemsOf(workspace).flatMap((system) =>
    system.repos.map((repo) => {
      const scan = byRepo.get(repo);
      return {
        repo,
        system: system.id,
        head: scan?.head ?? null,
        branch: scan?.branch ?? null,
        scannedAt: scan?.scannedAt ?? null,
      };
    }),
  );
}

/** Facts whose id, name or summary hold every word of the question, best first. */
export function findIn(map: SystemMap, text: string, limit = 20): MapFact[] {
  const words = text.toLowerCase().split(/\s+/).filter(Boolean);
  const scored: { fact: MapFact; score: number }[] = [];
  for (const fact of map.facts.values()) {
    const score = scoreOf(fact, words);
    if (score > 0) scored.push({ fact, score });
  }
  return scored
    .toSorted((a, b) =>
      b.score === a.score ? a.fact.id.localeCompare(b.fact.id) : b.score - a.score,
    )
    .slice(0, limit)
    .map(({ fact }) => fact);
}

function scoreOf(fact: MapFact, words: readonly string[]): number {
  const id = fact.id.toLowerCase();
  const name = fact.name.toLowerCase();
  const summary = (fact.summary ?? '').toLowerCase();
  let total = 0;
  for (const word of words) {
    const score =
      (id === word ? 50 : 0) +
      (name.includes(word) ? 10 : 0) +
      (id.includes(word) ? 6 : 0) +
      (summary.includes(word) ? 2 : 0);
    if (score === 0) return 0;
    total += score;
  }
  return total;
}

/** The facts read from a file, matched on the path inside the repo (a trailing part of it will do). */
export function ownedBy(map: SystemMap, file: string, repo?: string): MapFact[] {
  const wanted = file.replace(/^\.?\//, '');
  return [...map.facts.values()].filter((fact) =>
    fact.sources.some(
      (source) =>
        (repo === undefined || source.repo === repo) &&
        (source.path === wanted ||
          source.path.endsWith(`/${wanted}`) ||
          wanted.endsWith(source.path)),
    ),
  );
}

/** Repos the map has never read, so answers about them come from what people wrote. */
export function unscanned(map: SystemMap): RepoState[] {
  return map.repos.filter((repo) => repo.head === null);
}
