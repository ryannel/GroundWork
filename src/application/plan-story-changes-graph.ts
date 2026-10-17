import type { Model } from '@/application/plan/derive';
import type { GraphDiff } from '@/application/plan/federation-diff';
import { graphClaim, opImpact, opsPhrase } from '@/application/plan-story-changes-graph-ops';
import { changesOf } from '@/application/plan-story-changes-touched';
import { numWord } from '@/application/plan-viz-text';

// Chapter 4's graph screen: what the plan changes in the graph, and how the screen says it.

export interface GraphChange {
  readonly graphId: string;
  readonly diff: GraphDiff;
  /** What is true: what the reader feels first, else who owns what. */
  readonly headline: string;
  /** Who owns what now, when the headline is about the reader's side. */
  readonly lede: string;
  /** The changes behind any part of the graph that moves. */
  readonly changeIds: readonly string[];
}

const uniq = <T>(xs: readonly T[]): T[] => [...new Set(xs)];
const capital = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);

/** The graph the plan changes, when it changes one. */
export function graphChangeOf(
  model: Model,
): { readonly graphId: string; readonly diff: GraphDiff } | null {
  const graph = model.toBe.graphs[0] ?? model.asIs.graphs[0];
  if (graph === undefined) return null;
  const diff = model.graphDiff(graph.id);
  const empty = [diff.operations, diff.fields, diff.caches, diff.subgraphs].every(
    (x) => x.length === 0,
  );
  return empty ? null : { graphId: graph.id, diff };
}

function movedClause(model: Model, diff: GraphDiff): string[] {
  const moved = diff.fields.filter((f) => f.moved);
  const isEntity = (type: string): boolean => model.fieldOwners(type, 'toBe').keys.length > 0;
  const top = moved.filter((f) => isEntity(f.type));
  const withIt = [...new Set(moved.map((f) => f.type))].filter((t) => !isEntity(t));
  const count = top.length > 0 ? top.length : moved.length;
  const bits = [`${capital(numWord(count))} ${count === 1 ? 'field moves' : 'fields move'}`];
  if (withIt.length > 0) {
    const names = withIt.map((t) => model.label(t)).join(' and ');
    const [verb, which] = withIt.length === 1 ? ['goes', 'that type'] : ['go', 'those types'];
    bits.push(`${names} ${verb} with it, so the owner of ${which} changes too`);
  }
  return bits;
}

/** Who owns what changes, in the order the reader cares: a move, a removal, a route, a new operation, a subgraph. */
function ownerParts(model: Model, diff: GraphDiff): string[] {
  const gone = diff.fields.filter((f) => f.status === 'removed').length;
  const changed = diff.operations.filter((o) => o.before !== null);
  const routeChanged = changed.filter(
    (o) => o.before?.roundTrips !== o.after?.roundTrips || o.before?.fetches !== o.after?.fetches,
  ).length;
  const fresh = diff.operations.filter((o) => o.before === null);
  const joined = diff.subgraphs.filter((s) => s.status === 'added').length;
  if (diff.fields.some((f) => f.moved)) return movedClause(model, diff);
  if (gone > 0) {
    return [`${capital(numWord(gone))} ${gone === 1 ? 'field is removed' : 'fields are removed'}`];
  }
  if (changed.length > 0) return [opsPhrase(changed.length, routeChanged)];
  if (fresh.length > 0) {
    const names = fresh.map((o) => model.label(o.id)).join(' and ');
    return [`${names} ${fresh.length === 1 ? 'is' : 'are'} new`];
  }
  if (joined > 0) {
    const verb = joined === 1 ? 'subgraph joins' : 'subgraphs join';
    return [`${capital(numWord(joined))} ${verb} the graph`];
  }
  return [];
}

/** The graph screen's words, or null when the plan changes no graph. */
function headlineOf(felt: string, own: string): string {
  if (felt !== '') return `${felt}.`;
  return own === '' ? 'The graph changes shape.' : own;
}

export function graphChange(model: Model): GraphChange | null {
  const found = graphChangeOf(model);
  if (found === null) return null;
  const { graphId, diff } = found;
  const parts = ownerParts(model, diff);
  const felt = graphClaim(model, diff, opImpact(model, diff));
  const ids = uniq([
    graphId,
    ...diff.operations.map((o) => o.id),
    ...diff.fields.flatMap((f) => [f.id, f.type]),
    ...diff.caches.map((c) => c.id),
    ...diff.subgraphs.map((s) => s.id),
  ]);
  const ownersShift = diff.fields.some((f) => f.moved || f.status === 'removed');
  const own = parts.length > 0 ? `${parts.join('; ')}.` : '';
  return {
    graphId,
    diff,
    headline: headlineOf(felt, own),
    lede: felt !== '' && ownersShift ? own : '',
    changeIds: uniq(ids.flatMap((id) => changesOf(model, id))),
  };
}
