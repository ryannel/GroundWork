import { objects, sameJson, str, uniq } from '@/application/plan/derive-values';
import { isRecord, type Rec, strings } from '@/application/plan/ids';
import type { StepNode, SystemGraph } from '@/domain/plan/plan-graph';

export type EvidenceKind =
  | 'step'
  | 'order'
  | 'screen'
  | 'screen-context'
  | 'screen-layout'
  | 'interface'
  | 'field'
  | 'record'
  | 'deprecation';

/** One thing that differs between today and the plan; indirect evidence never asserts behaviour. */
export interface Evidence {
  kind: EvidenceKind;
  target: string;
  property: string | null;
  before: unknown;
  after: unknown;
  indirect: boolean;
}

/** The two graphs a journey compares. */
export interface Graphs {
  asIs: SystemGraph;
  toBe: SystemGraph;
}

export const ids = (values: readonly (string | null | undefined)[]): string[] =>
  uniq(values).filter((v) => v !== '');

const entity = (graph: SystemGraph, id: string): Rec | null => {
  const node = graph.get(id);
  return isRecord(node) ? node : null;
};

/** What the author wrote: no graph metadata, no sources, keys in one order. */
function authored(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(authored);
  if (!isRecord(value)) return value;
  const keys = Object.keys(value)
    .filter((key) => !key.startsWith('$') && key !== 'sources')
    .toSorted((a, b) => a.localeCompare(b));
  return Object.fromEntries(keys.map((key) => [key, authored(value[key])]));
}

const sameAuthored = (a: unknown, b: unknown): boolean => sameJson(authored(a), authored(b));

interface Compare {
  kind: EvidenceKind;
  target: string;
  before: Rec | null;
  after: Rec | null;
  indirect?: boolean;
  omit?: string[];
}

function propertyEvidence(c: Compare): Evidence[] {
  const { kind, target, before, after } = c;
  const indirect = c.indirect ?? false;
  if (before === null || after === null) {
    return before === null && after === null
      ? []
      : [{ kind, target, property: null, before, after, indirect }];
  }
  return ids([...Object.keys(before), ...Object.keys(after)])
    .filter(
      (property) =>
        property !== 'id' &&
        property !== 'sources' &&
        !property.startsWith('$') &&
        !(c.omit ?? []).includes(property) &&
        !sameAuthored(before[property], after[property]),
    )
    .map((property) => ({
      kind,
      target,
      property,
      before: before[property],
      after: after[property],
      indirect,
    }));
}

/** The regions of a screen, or just the exact one a step points at, compared between the graphs. */
function regionEvidence(
  g: Graphs,
  ref: string,
  screens: { a: Rec | null; b: Rec | null },
): Evidence[] {
  const regions = ref.includes('#')
    ? [ref]
    : ids([...objects(screens.a?.regions), ...objects(screens.b?.regions)].map((r) => str(r.id)));
  return regions
    .flatMap((region) =>
      propertyEvidence({
        kind: 'screen',
        target: region,
        before: entity(g.asIs, region),
        after: entity(g.toBe, region),
      }),
    )
    .map((item) => (item.property === 'at' ? { ...item, kind: 'screen-layout' } : item));
}

/** What changed on the screen a step happens on: the picture, and the exact region it points at. */
function screenEvidence(g: Graphs, before: StepNode | null, after: StepNode | null): Evidence[] {
  return ids([before?.screen, after?.screen]).flatMap((ref) => {
    const exact = ref.includes('#');
    const id = ref.split('#')[0] ?? ref;
    const screens = { a: entity(g.asIs, id), b: entity(g.toBe, id) };
    // A parent picture changes the context of an exact region; it does not change every action.
    const picture = propertyEvidence({
      kind: exact ? 'screen-context' : 'screen',
      target: id,
      before: screens.a,
      after: screens.b,
      indirect: exact,
      omit: ['regions', 'figma', 'mockup'],
    });
    return [...picture, ...regionEvidence(g, ref, screens)];
  });
}

/** The records an interface carries. */
const carried = (value: Rec | null): string[] =>
  ['request', 'response', 'payload'].flatMap((property) => strings([value?.[property]]));

/** What changed on the interface a step calls and on the records it reads and writes. */
function referenceEvidence(g: Graphs, before: StepNode | null, after: StepNode | null): Evidence[] {
  const records = [
    ...(before?.reads ?? []),
    ...(before?.writes ?? []),
    ...(after?.reads ?? []),
    ...(after?.writes ?? []),
  ];
  const evidence: Evidence[] = [];
  for (const via of ids([before?.via, after?.via]).filter((id) => id !== 'internal')) {
    const a = entity(g.asIs, via);
    const b = entity(g.toBe, via);
    evidence.push(...propertyEvidence({ kind: 'interface', target: via, before: a, after: b }));
    records.push(...carried(a), ...carried(b));
  }
  // Exact field references support field-level evidence. A record alone is explicitly indirect.
  const refEvidence = (ref: string): Evidence[] =>
    propertyEvidence({
      kind: ref.includes('#') ? 'field' : 'record',
      target: ref,
      before: entity(g.asIs, ref),
      after: entity(g.toBe, ref),
      indirect: !ref.includes('#'),
    });
  return [...evidence, ...ids(records).flatMap(refEvidence)];
}

export const rec = (value: unknown): Rec | null => (isRecord(value) ? value : null);

/** Everything that differs between a step today and with the plan: the step, its order, its screen, its references. */
export function stepEvidence(
  g: Graphs,
  pair: { before: StepNode | null; after: StepNode | null },
  order: Evidence[],
): Evidence[] {
  const { before, after } = pair;
  return [
    ...propertyEvidence({
      kind: 'step',
      target: (before ?? after)?.id ?? '',
      before: rec(before),
      after: rec(after),
    }),
    ...order,
    ...screenEvidence(g, before, after),
    ...referenceEvidence(g, before, after),
  ];
}
