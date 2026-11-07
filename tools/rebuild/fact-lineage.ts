// Compare frozen claims through explicit source positions, without substituting inferred facts.
import { isDeepStrictEqual } from 'node:util';

import type { ModelEdge, ModelIndex } from '@/application/model-index';
import { normaliseRepository, parseGitHostUrl, repositoryOf } from '@/domain/code-links';
import { appendChild, buildId, hasPrefix, localId, rewriteIdReferences } from '@/domain/ids';
import { modelList, modelRecord, modelText } from '@/domain/workspace-model';

import { digest } from './snapshots';

type Node = Readonly<Record<string, unknown>>;
interface CodePin {
  readonly repo: string;
  readonly commit: string;
  readonly path: string;
  readonly lines: readonly unknown[];
}
export interface FactLineageRow {
  readonly baselinePath: string;
  readonly nativeId: string | null;
  readonly cause:
    | 'code-location'
    | 'handler-site'
    | 'recorded-unknown-destination'
    | 'authored-area'
    | 'authored-flow';
  readonly before: string;
  readonly after: string;
  readonly problems: readonly string[];
}

function pointer(key: string): string {
  return key.replaceAll('~', '~0').replaceAll('/', '~1');
}

function codePin(value: unknown): CodePin | null {
  const source = modelRecord(value);
  if (source === null) return null;
  if (typeof source.url === 'string') {
    const parsed = parseGitHostUrl(source.url);
    const repo = repositoryOf(source.url);
    if (parsed?.kind !== 'blob' || parsed.commit === undefined || repo === undefined) return null;
    return { repo, commit: parsed.commit, path: parsed.path, lines: parsed.lines ?? [] };
  }
  const { repo, commit, path, lines } = source;
  if (typeof repo !== 'string' || typeof commit !== 'string' || typeof path !== 'string') {
    return null;
  }
  return { repo: normaliseRepository(repo), commit, path, lines: modelList(lines) };
}

function retainedPin(before: unknown, after: readonly unknown[]): boolean {
  const expected = codePin(before);
  return expected !== null && after.some((value) => isDeepStrictEqual(codePin(value), expected));
}

/** A location is proved separately from editorial source labels or notes. */
export function citationLineage(frozen: unknown, index: ModelIndex): readonly FactLineageRow[] {
  const attribution = modelRecord(modelRecord(frozen)?.attribution);
  if (attribution === null) throw new Error('Frozen attribution is missing.');
  return Object.entries(attribution).flatMap(([id, item]) => {
    const node = index.get(id);
    const after = node === null ? [] : index.cites(node.id);
    return modelList(modelRecord(item)?.sources).map((source, position) => ({
      baselinePath: `/attribution/${pointer(id)}/sources/${String(position)}`,
      nativeId: node?.id ?? null,
      cause: 'code-location',
      before: digest(source),
      after: digest(after),
      problems: retainedPin(source, after) ? [] : ['Original code location has not been matched.'],
    }));
  });
}

interface SitePair {
  readonly before: Node;
  readonly after: Node;
  readonly id: string;
}

function emptyBlock(value: unknown): boolean {
  const node = modelRecord(value);
  if (node === null || (node.do === undefined && node.steps === undefined)) return false;
  return (
    Object.keys(node).every((key) => ['origin', 'sources', 'do', 'steps'].includes(key)) &&
    modelList(node.do ?? node.steps).length === 0
  );
}

function correspondingStep(
  before: unknown,
  after: unknown,
  position: unknown,
  parent: string,
): SitePair | null {
  if (typeof position !== 'number' || !Number.isInteger(position) || position < 0) return null;
  const beforeSteps = modelList(before);
  const original = modelRecord(beforeSteps[position]);
  const shifted = beforeSteps.slice(0, position).filter((value) => !emptyBlock(value)).length;
  const next = modelRecord(modelList(after)[shifted]);
  const id = modelText(next?.id);
  if (original === null || next === null || id === null) return null;
  return emptyBlock(original)
    ? null
    : { before: original, after: next, id: appendChild(parent, id) };
}

function selectSite(
  parent: SitePair,
  path: readonly unknown[],
): { readonly site: SitePair | null; readonly consumed: number } {
  const [key, position, child] = path;
  if (typeof key !== 'string') return { site: null, consumed: 0 };
  if (key === 'parallel' && typeof position === 'number') {
    const beforeLane = modelList(parent.before.parallel)[position];
    const afterLane = modelRecord(modelList(parent.after.parallel)[position]);
    return {
      site: correspondingStep(
        modelRecord(beforeLane)?.steps ?? beforeLane,
        afterLane?.steps,
        child,
        parent.id,
      ),
      consumed: 3,
    };
  }
  const canonicalKey = key === 'do' ? 'steps' : key;
  return {
    site: correspondingStep(parent.before[key], parent.after[canonicalKey], position, parent.id),
    consumed: 2,
  };
}

function siteChain(root: SitePair, path: readonly unknown[]): readonly SitePair[] {
  const chain = [root];
  let parent = root;
  let offset = 0;
  while (offset < path.length) {
    const { site, consumed } = selectSite(parent, path.slice(offset));
    if (site === null) return [];
    chain.push(site);
    parent = site;
    offset += consumed;
  }
  return chain;
}

const RETAINED_STEP_FIELDS = ['does', 'when', 'if', 'each', 'async'] as const;

function controlProblems(
  chain: readonly SitePair[],
  aliases: ReadonlyMap<string, string>,
): string[] {
  return chain.slice(1).flatMap(({ before, after, id }) => {
    const problems = RETAINED_STEP_FIELDS.flatMap((field) => {
      const old = before[field];
      const value = typeof old === 'string' ? rewriteIdReferences(old, aliases, false) : old;
      return value === after[field] ? [] : [`${id}: changed ${field}.`];
    });
    if (typeof before.retry === 'string') {
      const next = modelRecord(after.retry);
      if (next?.description !== before.retry || next.times !== before.times) {
        problems.push(`${id}: changed the recorded retry description or count.`);
      }
    }
    return problems;
  });
}

function idOf(value: unknown, index: ModelIndex): string | null {
  const id = modelText(value);
  return id === null ? null : (index.get(id)?.id ?? id);
}

function edgeMatches(original: Node, after: ModelEdge, index: ModelIndex): boolean {
  const known = idOf(original.to, index);
  if (known !== null && after.to !== known) return false;
  return (
    after.kind === original.kind &&
    after.from === idOf(original.from, index) &&
    after.via === idOf(original.target, index)
  );
}

interface SiteProof {
  readonly index: ModelIndex;
  readonly aliases: ReadonlyMap<string, string>;
  readonly handlers: ReadonlyMap<string, Node>;
  readonly edges: ReadonlyMap<string, readonly ModelEdge[]>;
  readonly unknown: ReadonlySet<string>;
}

function expectedPins(chain: readonly SitePair[]): readonly unknown[] {
  return (
    chain.map(({ before }) => modelList(before.sources)).findLast((list) => list.length > 0) ?? []
  );
}

function sourceChain(value: Node, { index, handlers }: SiteProof): readonly SitePair[] {
  const id = modelText(value.handler);
  if (id === null) return [];
  const handler = index.get(id);
  const before = handlers.get(id);
  return handler === null || before === undefined
    ? []
    : siteChain({ before, after: handler.data, id: handler.id }, modelList(value.path));
}
function targetChanged(value: Node, site: SitePair, index: ModelIndex): boolean {
  const target = modelText(value.target);
  const key = modelText(value.kind);
  if (target === null || key === null) return true;
  return idOf(site.after[key], index) !== idOf(target, index);
}
function retainedTrigger(value: Node, chain: readonly SitePair[], index: ModelIndex): boolean {
  const old = modelText(value.on);
  const current = modelText(chain[0]?.after.on);
  if (old === null || current === null) return false;
  if (idOf(old, index) === idOf(current, index)) return true;
  const trigger = index.get(current);
  if (hasPrefix(old, 'msg') && trigger?.kind === 'subscription') {
    return idOf(trigger.data.message, index) === idOf(old, index);
  }
  return hasPrefix(old, 'job') && trigger?.kind === 'job' && trigger.data.trigger === localId(old);
}

function proveEffect(
  value: Node,
  site: SitePair,
  chain: readonly SitePair[],
  { index, aliases, edges, unknown }: SiteProof,
): Pick<FactLineageRow, 'cause' | 'after' | 'problems'> {
  const actual = edges.get(site.id) ?? [];
  const backed = actual.find((edge) => edgeMatches(value, edge, index));
  const cites = index.cites(site.id);
  const problems = controlProblems(chain, aliases);
  if (!retainedTrigger(value, chain, index)) {
    problems.push('The original handler trigger has not been matched.');
  }
  if (expectedPins(chain).some((pin) => !retainedPin(pin, cites))) {
    problems.push('Original step or enclosing code location has not been matched.');
  }
  if (targetChanged(value, site, index)) {
    problems.push('The canonical step does not name the original effect target.');
  }
  const missing = value.to === null && unknown.has(site.id);
  if (backed === undefined && !missing) {
    problems.push('The original effect has no matching native edge.');
  }
  return {
    cause: backed === undefined && missing ? 'recorded-unknown-destination' : 'handler-site',
    after: digest({ step: site.after, edge: backed ?? null, cites }),
    problems,
  };
}

function effectOf(value: Node, position: number, proof: SiteProof): FactLineageRow {
  const chain = sourceChain(value, proof);
  const site = chain.length > 1 ? chain.at(-1) : undefined;
  const row = {
    baselinePath: `/derived/handlerEdges/${String(position)}`,
    nativeId: site?.id ?? null,
    before: digest(value),
  };
  if (site === undefined) {
    return {
      ...row,
      cause: 'handler-site',
      after: digest(null),
      problems: ['No matching source step.'],
    };
  }
  return { ...row, ...proveEffect(value, site, chain, proof) };
}

/** Match each original effect occurrence through its control-flow path, then use ordinary native edge queries. */
export function handlerEffectLineage(
  frozen: unknown,
  index: ModelIndex,
): readonly FactLineageRow[] {
  const source = modelRecord(frozen);
  const plan = modelRecord(source?.plan);
  const derived = modelRecord(source?.derived);
  if (!Array.isArray(plan?.handlers) || !Array.isArray(derived?.handlerEdges)) {
    throw new TypeError('Frozen handler facts are missing.');
  }
  const handlers = new Map(
    modelList(plan.handlers).flatMap((value) => {
      const handler = modelRecord(value);
      return handler !== null && typeof handler.id === 'string'
        ? [[handler.id, handler] as const]
        : [];
    }),
  );
  const edges = new Map<string, ModelEdge[]>();
  for (const edge of index.edges()) {
    if (edge.source !== 'handler') continue;
    const existing = edges.get(edge.site) ?? [];
    existing.push(edge);
    edges.set(edge.site, existing);
  }
  const aliases = new Map(
    Object.entries(index.model.aliases).flatMap(([before, alias]) =>
      typeof alias?.to === 'string' ? [[before, alias.to] as const] : [],
    ),
  );
  const unknown = new Set(
    index
      .gaps()
      .filter((gap) => gap.kind === 'unmapped_target')
      .map((gap) => gap.id),
  );
  const proof = { index, aliases, handlers, edges, unknown };
  return modelList(derived.handlerEdges).map((value, position) => {
    const original = modelRecord(value);
    if (original === null) throw new Error(`Invalid frozen handler effect at ${String(position)}.`);
    return effectOf(original, position, proof);
  });
}

function asCanonical(value: unknown, index: ModelIndex, prefix: string): unknown {
  const id = modelText(value);
  if (id === null) return value;
  const qualified = hasPrefix(id, prefix) ? id : buildId(prefix, id);
  return idOf(qualified, index);
}

function bandOf(value: unknown, index: ModelIndex): unknown {
  const band = modelRecord(value);
  if (band === null) return value;
  return {
    ...band,
    nodes: modelList(band.nodes).map((item) => {
      const node = modelRecord(item);
      return node === null ? item : { ...node, component: idOf(node.component, index) };
    }),
  };
}

function exchangeOf(value: unknown, index: ModelIndex): unknown {
  const exchange = modelRecord(value);
  if (exchange === null) return value;
  const { evidence, ...fields } = exchange;
  return {
    ...fields,
    from: idOf(exchange.from, index),
    to: idOf(exchange.to, index),
    backs: modelList(evidence).map((id) => idOf(id, index)),
  };
}

function nativeExchange(value: unknown): unknown {
  const exchange = modelRecord(value);
  if (exchange === null) return value;
  const fields = Object.fromEntries(Object.entries(exchange).filter(([key]) => key !== 'cites'));
  return { ...fields, backs: modelList(exchange.backs) };
}

function flowRow(
  value: unknown,
  current: unknown,
  key: string,
  index: ModelIndex,
): readonly unknown[] {
  if (key === 'bands') return [bandOf(value, index), current];
  if (key === 'columns') {
    const column = modelRecord(value);
    return [
      column === null ? value : { ...column, system: asCanonical(column.system, index, 'sys') },
      current,
    ];
  }
  return [exchangeOf(value, index), nativeExchange(current)];
}

function areaRow(
  before: unknown,
  after: unknown,
  baselinePath: string,
  nativeId: string,
  cause: 'authored-area' | 'authored-flow',
  equal: boolean,
): FactLineageRow {
  return {
    baselinePath,
    nativeId,
    cause,
    before: digest(before),
    after: digest(after),
    problems: equal ? [] : ['The authored area or flow value differs.'],
  };
}

function flowLineage(
  old: Node,
  next: Node | null,
  prefix: string,
  id: string,
  index: ModelIndex,
): readonly FactLineageRow[] {
  return Object.entries(old).flatMap(([key, value]) => {
    const current = next?.[key];
    const path = `${prefix}/${pointer(key)}`;
    if (key === 'limitations') {
      const aliases = new Map(
        Object.entries(index.model.aliases).flatMap(([before, alias]) =>
          typeof alias?.to === 'string' ? [[before, alias.to] as const] : [],
        ),
      );
      const expected = modelList(value).map((text) =>
        typeof text === 'string' ? rewriteIdReferences(text, aliases, false) : text,
      );
      return [
        areaRow(value, current, path, id, 'authored-flow', isDeepStrictEqual(expected, current)),
      ];
    }
    if (!Array.isArray(value)) {
      return [
        areaRow(value, current, path, id, 'authored-flow', isDeepStrictEqual(value, current)),
      ];
    }
    const beforeRows = modelList(value);
    const afterRows = modelList(current);
    const rows = beforeRows.map((row, i) => {
      const [before, after] = flowRow(row, afterRows[i], key, index);
      return areaRow(
        row,
        afterRows[i],
        `${path}/${String(i)}`,
        id,
        'authored-flow',
        isDeepStrictEqual(before, after),
      );
    });
    if (beforeRows.length !== afterRows.length) {
      rows.push(areaRow(beforeRows.length, afterRows.length, path, id, 'authored-flow', false));
    }
    return rows;
  });
}

/** Keep array order and verify every authored exchange's backing IDs independently of resolved cites. */
export function landscapeLineage(frozen: unknown, index: ModelIndex): readonly FactLineageRow[] {
  const landscape = modelRecord(modelRecord(frozen)?.landscape);
  if (landscape === null) return [];
  const native = index.model.landscape;
  if (native === null) throw new Error('The frozen landscape has no native replacement.');
  const metadata = modelList(landscape.areas).flatMap((value, position) => {
    const source = modelRecord(value);
    const id = asCanonical(source?.id, index, 'area');
    if (source === null || typeof id !== 'string') throw new TypeError('Invalid frozen area.');
    const area = modelRecord(native.areas.find((item) => item.id === id));
    return Object.entries(source).map(([key, original]) => {
      const field = key === 'evidenceCount' ? 'evidence_count' : key;
      const current = area?.[field];
      const expected = key === 'id' ? id : original;
      return areaRow(
        original,
        current,
        `/landscape/areas/${String(position)}/${pointer(key)}`,
        id,
        'authored-area',
        isDeepStrictEqual(expected, current),
      );
    });
  });
  const flows = modelList(landscape.details).flatMap((value, position) => {
    const detail = modelRecord(value);
    const old = modelRecord(detail?.valueFlow);
    if (old === null) return [];
    const id = asCanonical(detail?.area, index, 'area');
    if (typeof id !== 'string') throw new TypeError('Invalid frozen flow area.');
    const current = modelRecord(native.details?.find((item) => item.area === id)?.valueFlow);
    return flowLineage(old, current, `/landscape/details/${String(position)}/valueFlow`, id, index);
  });
  return [...metadata, ...flows];
}
