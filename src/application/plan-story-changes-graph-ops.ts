import type { Model } from '@/application/plan/derive';
import type { GraphDiff, OperationChange } from '@/application/plan/federation-diff';
import type { PlanSummary } from '@/application/plan/federation-model';
import { prop, strings } from '@/application/plan/ids';
import { registryEvidence } from '@/application/plan/registry-evidence';
import { topOf } from '@/application/plan-story-changes-touched';
import { andList } from '@/application/plan-viz-ladder-order';
import { numWord } from '@/application/plan-viz-text';

// What the reader of the graph screen feels first: round trips and the edge, before and after, one row per operation.

type OpKind = 'lost' | 'up' | 'new' | 'down' | 'same';

export interface OpImpact {
  readonly id: string;
  readonly name: string;
  readonly kind: OpKind;
  /** Round trips gained (negative: saved); zero for a new operation. */
  readonly delta: number;
  readonly before: PlanSummary | null;
  readonly after: PlanSummary | null;
  readonly added: readonly string[];
  readonly removed: readonly string[];
}

const RANK: Readonly<Record<OpKind, number>> = { lost: 0, up: 1, new: 2, down: 3, same: 4 };

const firstNonZero = (...ns: number[]): number => ns.find((n) => n !== 0) ?? 0;

const trips = (n: number): string => `${String(n)} ${n === 1 ? 'round trip' : 'round trips'}`;
const fetches = (n: number): string => `${String(n)} ${n === 1 ? 'fetch' : 'fetches'}`;
const capital = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);

/** "30 s", or "2 min" when it is whole minutes of two or more. */
export const secsText = (n: number): string =>
  n >= 120 && n % 60 === 0 ? `${String(n / 60)} min` : `${String(n)} s`;

function kindOf(change: OperationChange): { kind: OpKind; delta: number } {
  const { before, after } = change;
  if (before === null) return { kind: 'new', delta: 0 };
  const delta = (after?.roundTrips ?? 0) - before.roundTrips;
  if (before.cacheable && after?.cacheable !== true) return { kind: 'lost', delta };
  if (delta > 0) return { kind: 'up', delta };
  return { kind: delta < 0 ? 'down' : 'same', delta };
}

/**
 * One row per operation the plan changes or adds, worst first: it stops being cached, it adds round trips (most
 * first), it is new, it saves trips, its route is the same.
 */
export function opImpact(model: Model, diff: GraphDiff): OpImpact[] {
  return diff.operations
    .map((change, order) => {
      const was = change.before?.subgraphs ?? [];
      const now = change.after?.subgraphs ?? [];
      const row: OpImpact = {
        id: change.id,
        name: model.label(change.id),
        ...kindOf(change),
        before: change.before,
        after: change.after,
        added: now.filter((x) => !was.includes(x)),
        removed: was.filter((x) => !now.includes(x)),
      };
      return { row, order };
    })
    .toSorted((a, b) =>
      firstNonZero(
        RANK[a.row.kind] - RANK[b.row.kind],
        b.row.delta - a.row.delta,
        a.order - b.order,
      ),
    )
    .map(({ row }) => row);
}

/** "2 → 3 round trips · 3 → 4 fetches", or "Same route: 2 round trips, 3 fetches" when neither number moves. */
export function routeSummary(before: PlanSummary, after: PlanSummary): string {
  if (before.roundTrips === after.roundTrips && before.fetches === after.fetches)
    return `Same route: ${trips(after.roundTrips)}, ${fetches(after.fetches)}`;
  const rt =
    before.roundTrips === after.roundTrips
      ? trips(after.roundTrips)
      : `${String(before.roundTrips)} → ${trips(after.roundTrips)}`;
  const ft =
    before.fetches === after.fetches
      ? fetches(after.fetches)
      : `${String(before.fetches)} → ${fetches(after.fetches)}`;
  return `${rt} · ${ft}`;
}

/** "Three operations take a different route", "One operation changes, on the same route". */
export function opsPhrase(changed: number, routeChanged: number): string {
  if (changed === 0) return '';
  const count = `${capital(numWord(changed))} ${changed === 1 ? 'operation' : 'operations'}`;
  if (routeChanged === changed)
    return `${count} ${changed === 1 ? 'takes' : 'take'} a different route`;
  if (routeChanged === 0)
    return `${count} ${changed === 1 ? 'changes' : 'change'}, on the same route`;
  return `${count} change, ${numWord(routeChanged)} on a different route`;
}

const moreTrips = (n: number) => (n === 1 ? 'a round trip' : `${String(n)} round trips`);

/** How long the edge keeps an answer: the plan's own lifetime at the edge cache when it sets one, else its max-age. */
function edgeTtl(
  model: Model,
  id: string,
  scope: { readonly mode: 'asIs' | 'toBe'; readonly summary: PlanSummary | null },
): number | null {
  if (scope.summary?.cacheable !== true) return null;
  const row = model.cachePath(id, scope.mode, 'cold').layers.find((l) => l.layer === 'edge');
  return row?.why === null && row.ttl !== null && row.ttl > 0 ? row.ttl : scope.summary.maxAge;
}

/** "30 s" at the edge, or "not cached". */
export function edgeWord(
  model: Model,
  id: string,
  scope: { readonly mode: 'asIs' | 'toBe'; readonly summary: PlanSummary | null },
): string {
  const ttl = edgeTtl(model, id, scope);
  return ttl === null || ttl === 0 ? 'not cached' : secsText(ttl);
}

/** The variables an operation's edge key varies by that another operation's does not. */
function extraVariables(model: Model, id: string, pair: string | null): string[] {
  const names = (opId: string, mode: 'asIs' | 'toBe'): string[] =>
    model.queryPlan(opId, mode).variables.map((v) => v.name);
  const own = new Set(pair === null ? [] : names(pair, 'asIs'));
  return names(id, 'toBe').filter((n) => !own.has(n));
}

/** An added operation that shares a screen with one that changes: "ProductPromise" splits off from "Product". */
export function splitOf(model: Model, diff: GraphDiff, added: OpImpact): OpImpact | null {
  const screensOf = (id: string): string[] =>
    strings(prop(model.toBe.get(id), 'screens')).map(topOf);
  const mine = screensOf(added.id);
  const name = (id: string): unknown => prop(model.toBe.get(id), 'name');
  const pair = opImpact(model, diff).find(
    (o) =>
      o.id !== added.id &&
      o.before !== null &&
      screensOf(o.id).some((s) => mine.includes(s)) &&
      name(added.id) !== name(o.id),
  );
  return pair ?? null;
}

const lower = (s: string): string => s.charAt(0).toLowerCase() + s.slice(1);

/** Why an operation was split off: a variable in its edge key, a round trip, else the reason on its cache override. */
export function splitWhy(model: Model, row: OpImpact, pair: OpImpact): string {
  const policy = model.responsePolicy(row.id, 'toBe');
  if (policy.scope === 'private') return 'its answer is private';
  const extra = extraVariables(model, row.id, pair.id);
  const bits: string[] = [];
  if (extra.length > 0) bits.push(`its edge key varies by ${andList(extra)}`);
  const more = model.queryPlan(row.id, 'toBe').roundTrips - (pair.before?.roundTrips ?? 0);
  if (more > 0)
    bits.push(`it ${bits.length > 0 ? 'adds' : 'would add'} ${moreTrips(more)} to the page`);
  if (bits.length > 0) return bits.join(' and ');
  const reason = (policy.overrides[0]?.reason ?? '').replaceAll('`', '').replace(/\.$/, '');
  return reason === '' ? '' : lower(reason);
}

const estimated = (model: Model, rows: readonly OpImpact[]): boolean =>
  rows.some(
    (r) =>
      !registryEvidence(model, r.id, { plan_check: prop(model.toBe.get(r.id), 'plan_check') })
        .evidence,
  );

function upClause(model: Model, up: readonly OpImpact[]): string {
  const shown = up.slice(0, 2);
  const [a, b] = shown;
  const was = (r: OpImpact): string => String(r.before?.roundTrips ?? 0);
  const now = (r: OpImpact): number => r.after?.roundTrips ?? 0;
  const text =
    a !== undefined && b !== undefined && was(a) === was(b) && now(a) === now(b)
      ? `${andList([a.name, b.name])} go from ${was(a)} to ${trips(now(a))}`
      : shown
          .map((r, i) =>
            i === 0
              ? `${r.name} goes from ${was(r)} to ${trips(now(r))}`
              : `${r.name} from ${was(r)} to ${String(now(r))}`,
          )
          .join(' and ');
  const more = up.length > 2 ? ` (${numWord(up.length - 2)} more add trips too)` : '';
  return `${estimated(model, shown) ? 'Estimated round trips: ' : ''}${text}${more}`;
}

function freshClause(model: Model, diff: GraphDiff, fresh: readonly OpImpact[]): string {
  const [r] = fresh;
  if (r === undefined) return '';
  if (fresh.length > 1) {
    const more = fresh.length > 2 ? ` and ${numWord(fresh.length - 2)} more` : '';
    return `${andList(fresh.slice(0, 2).map((x) => x.name))}${more} are new`;
  }
  const by = extraVariables(model, r.id, splitOf(model, diff, r)?.id ?? null);
  const ttl = edgeTtl(model, r.id, { mode: 'toBe', summary: r.after });
  if (ttl === null || ttl === 0) return `${r.name} is new`;
  const per = by.length > 0 ? `, per ${andList(by)}` : '';
  return `${r.name} is new and cached at the edge for ${secsText(ttl)}${per}`;
}

/**
 * What the reader feels, in a sentence or two: "AddToCart goes from 1 to 3 round trips and CartSummary from 3 to 4;
 * ProductPromise is new and cached at the edge for 60 s, per region". Empty when nothing is felt.
 */
export function graphClaim(
  model: Model,
  diff: GraphDiff,
  rows: readonly OpImpact[] = opImpact(model, diff),
): string {
  const of = (kind: OpKind): OpImpact[] => rows.filter((r) => r.kind === kind);
  const [lost, up, down, fresh] = [of('lost'), of('up'), of('down'), of('new')];
  const clauses: string[] = [];
  if (lost.length > 0)
    clauses.push(
      `${andList(lost.map((r) => r.name))} ${lost.length === 1 ? 'is' : 'are'} no longer cached at the edge`,
    );
  if (up.length > 0) clauses.push(upClause(model, up));
  if (fresh.length > 0) clauses.push(freshClause(model, diff, fresh));
  if (clauses.length === 0 && down.length > 0) {
    const names = andList(down.slice(0, 2).map((r) => r.name));
    clauses.push(
      `${estimated(model, down.slice(0, 2)) ? 'Estimated round trips: ' : ''}${names} ${down.length === 1 ? 'saves' : 'save'} round trips`,
    );
  }
  return clauses.slice(0, 2).join('; ');
}
