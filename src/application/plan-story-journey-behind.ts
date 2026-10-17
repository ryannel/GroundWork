import type { Model } from '@/application/plan/derive';
import { behindHeadline } from '@/application/plan-story-journey-behind-words';
import { behindOperations } from '@/application/plan-story-journey-order';
import { type Purges, purgesOf } from '@/application/plan-story-journey-purges';
import { countOf, plainLine } from '@/application/plan-viz-text';
import { type WaterfallFacts, waterfallFacts } from '@/application/plan-viz-waterfall-facts';
import { keyText } from '@/application/plan-viz-waterfall-text';
import type { Operation } from '@/domain/plan/plan.generated';

// Behind the button: for each operation the front end sends today, what it costs and whom to call when it is slow.

export interface BehindOp {
  readonly id: string;
  readonly name: string;
  readonly headline: string;
  readonly lede: string;
  /** The screen that sends it and the regions to light on it. */
  readonly screen: { readonly id: string; readonly focus: readonly string[] } | null;
  /** When the front end sends it. */
  readonly when: string;
  readonly hasDocument: boolean;
  /** The teams that answer, in the order they are asked. */
  readonly teams: readonly string[];
  readonly cache: { readonly text: string; readonly note: string | null } | null;
  /** The team that runs the gateway, and whether it decides which subgraphs to ask. */
  readonly gateway: { readonly team: string; readonly decides: boolean } | null;
  /** How the plan changes what this operation costs, or null when it does not. */
  readonly change: string | null;
  readonly purges: Purges;
}

const WHEN: Readonly<Record<string, string>> = {
  load: 'when the page loads',
  click: 'when the button is pressed',
  scroll: 'when the page is scrolled',
  submit: 'when the form is sent',
  interval: 'on a timer',
};

const sentenceOf = (text: string | undefined): string => {
  const line = plainLine(text).replaceAll(/\s+/gu, ' ').trim();
  const end = line.search(/[!.?](?=\s|$)/u);
  return end === -1 ? line : line.slice(0, end + 1);
};

function privateCache(model: Model, facts: WaterfallFacts, top: string | null): string {
  const field = facts.policy?.private[0]?.field;
  const only = top === null ? '' : `; only the ${model.label(top)} does, one item at a time`;
  return field === undefined
    ? `The edge cannot keep this response${only}.`
    : `${model.label(field)} is private, so the edge cannot keep this response${only}.`;
}

function overrideNote(policy: NonNullable<WaterfallFacts['policy']>): string | null {
  const [override] = policy.overrides;
  if (override === undefined) return null;
  const reason = (override.reason ?? '').replaceAll('`', '');
  if (override.ttl === policy.maxAge && reason === '') return null;
  return `The plan keeps it for ${String(override.ttl)} s instead of the ${String(policy.maxAge)} s the rules give: ${reason}`;
}

function cacheOf(model: Model, op: Operation, facts: WaterfallFacts): BehindOp['cache'] {
  const { policy } = facts;
  if (policy === null) return null;
  if (op.kind === 'mutation') return { text: 'A mutation is never cached.', note: null };
  const cold = model.cachePath(op.id, 'asIs', 'cold');
  const top = cold.layers.find((l) => l.layer !== 'subgraph');
  if (policy.scope === 'private') {
    return { text: privateCache(model, facts, top?.store ?? null), note: null };
  }
  if (top === undefined) {
    return {
      text: `Not cached on the way; the response could live for ${String(policy.maxAge)} s.`,
      note: null,
    };
  }
  const key = keyText(top.key).split(' · ').join(', ');
  return {
    text: `Cached at the ${top.layer}: one copy for each ${key === '' ? 'key' : key}. Nothing in it is private.`,
    note: overrideNote(policy),
  };
}

/** What the plan does to the operation's cost, in the words of the graph diff. */
function changeOf(model: Model, id: string): string | null {
  const [graph] = model.asIs.graphs;
  const found =
    graph === undefined ? undefined : model.graphDiff(graph.id).operations.find((o) => o.id === id);
  if (found === undefined) return null;
  const { before, after } = found;
  const bits: string[] = [];
  if (before !== null && after !== null) {
    if (before.fetches !== after.fetches) {
      bits.push(`${String(before.fetches)} → ${String(after.fetches)} fetches`);
    }
    if (before.roundTrips !== after.roundTrips) {
      bits.push(`${String(before.roundTrips)} → ${String(after.roundTrips)} round trips`);
    }
    if (bits.length === 0 && found.changed.includes('subgraphs')) {
      bits.push('a subgraph is swapped');
    }
  }
  return bits.length === 0 ? null : bits.join(', ');
}

function behindOp(model: Model, op: Operation): BehindOp | null {
  const facts = waterfallFacts(model, op.id, 'asIs');
  const { plan } = facts;
  if (plan === null) return null;
  const refs = op.screens ?? [];
  const screen = refs[0]?.split('#')[0];
  const fields = plan.selected.filter((x) => x.addedByRouter === null).length;
  const subgraphs = new Set(plan.fetches.map((f) => f.subgraph)).size;
  const teams = [...new Set(plan.teams)];
  const own = sentenceOf(op.summary);
  const counts = `${countOf(fields, 'field')} · ${countOf(subgraphs, 'subgraph')} · ${countOf(teams.length, 'team')}`;
  return {
    id: op.id,
    name: op.name,
    headline: behindHeadline(model, op, facts),
    lede: own === '' ? counts : `${own} ${counts}`,
    screen:
      screen === undefined ? null : { id: screen, focus: refs.filter((r) => r.includes('#')) },
    when: (op.trigger === undefined ? undefined : WHEN[op.trigger]) ?? 'by the front end',
    hasDocument: op.document.trim() !== '',
    teams,
    cache: cacheOf(model, op, facts),
    gateway:
      plan.gatewayTeam === null
        ? null
        : { team: plan.gatewayTeam, decides: !teams.includes(plan.gatewayTeam) },
    change: changeOf(model, op.id),
    purges: purgesOf(model, op.id),
  };
}

/** One entry for each operation that runs today. */
export function behindStory(model: Model): BehindOp[] {
  return behindOperations(model).flatMap((op) => behindOp(model, op) ?? []);
}
