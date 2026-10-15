import type { Model } from '@/application/plan/derive';
import type { Edge } from '@/application/plan/derive-edges';
import { parentOf } from '@/application/plan/ids';
import { storeStop } from '@/application/plan-story-today-stores';
import type { StopBelow, StopView } from '@/application/plan-story-today-types';
import { countWord, numWord } from '@/application/plan-viz-text';

// What chapter 2 says about the map of systems, one stop at a time: who owns what, the calls, the events, and where
// the data lives. Every claim is worked out from today's plan, so nothing here is coloured by change.

const isTopic = (kind: string): boolean => kind === 'topic' || kind === 'queue';

const lower = (n: number): string => numWord(n);

function readLine(model: Model): string {
  const { stages } = model.domain();
  if (stages.length === 0) return 'Read left to right: who calls or feeds whom.';
  const named = stages.map((s, i) => `${String(i + 1)} ${s.name}`).join(' → ');
  return `Read left to right through the stages, ${named}.`;
}

interface Tally {
  readonly team: string;
  readonly name: string;
  readonly count: number;
}

/** Each team that runs a system, with how many, most first. */
function tallies(model: Model): Tally[] {
  const named = new Map(model.plan.teams.map((t) => [t.id, t.name]));
  const counts = new Map<string, number>();
  for (const s of model.asIs.services) counts.set(s.team, (counts.get(s.team) ?? 0) + 1);
  return [...counts]
    .map(([team, count]) => ({ team, name: named.get(team) ?? team, count }))
    .toSorted((a, b) => b.count - a.count);
}

function ownersHeadline(total: number, per: readonly Tally[]): string {
  const [top, next] = per;
  if (top === undefined) return 'No team runs a component in this plan today.';
  if (per.length === 1) return `${top.name} runs all of it: ${countWord(total, 'component')}.`;
  if (top.count > (next?.count ?? 0)) {
    const rest = countWord(per.length - 1, 'other team');
    return `${top.name} runs the most of it: ${lower(top.count)} of the ${lower(total)} components; ${rest} run the rest.`;
  }
  return `No one team runs most of it: ${lower(total)} components spread across ${lower(per.length)} teams.`;
}

function teamsBelow(model: Model, per: readonly Tally[]): StopBelow {
  const owning = new Set(per.map((t) => t.team));
  return {
    kind: 'teams',
    rows: per.map((t) => ({
      team: t.team,
      count: countWord(t.count, 'component'),
      services: model.asIs.services.filter((s) => s.team === t.team).map((s) => s.id),
      channel: model.plan.teams.find((x) => x.id === t.team)?.channel ?? '',
    })),
    idle: model.plan.teams.map((t) => t.id).filter((id) => !owning.has(id)),
  };
}

function ownersStop(model: Model): StopView {
  const per = tallies(model);
  return {
    key: 'owners',
    title: 'Who owns what',
    focus: 'all',
    headline: ownersHeadline(model.asIs.services.length, per),
    lede: `${readLine(model)} Each card is a component in its team’s colour; its topics and stores sit underneath.`,
    below: teamsBelow(model, per),
  };
}

function distinct(edges: readonly Edge[], pick: (e: Edge) => string, by: (e: Edge) => string) {
  const out = new Map<string, Set<string>>();
  for (const e of edges) out.set(pick(e), (out.get(pick(e)) ?? new Set()).add(by(e)));
  return [...out].toSorted((a, b) => b[1].size - a[1].size)[0] ?? ['', new Set<string>()];
}

function callsHeadline(model: Model, edges: readonly Edge[]): string {
  if (edges.length === 0) return 'No component calls another in this plan today.';
  const [callee, callers] = distinct(
    edges,
    (e) => e.to,
    (e) => e.from,
  );
  const [caller, callees] = distinct(
    edges,
    (e) => e.from,
    (e) => e.to,
  );
  if (callees.size > callers.size)
    return `${model.label(caller)} makes most of the calls: it waits on ${countWord(callees.size, 'component')}.`;
  if (callers.size > 1)
    return `${model.label(callee)} is the one most components wait on: ${countWord(callers.size, 'component')} call it.`;
  return 'Every call is one component asking one other: none waits on more than one, and none is asked by more than one.';
}

/** The interfaces the calls use, most used first. */
function busiestEndpoints(edges: readonly Edge[]): string[] {
  const use = new Map<string, number>();
  for (const e of edges) {
    if (e.via !== null) use.set(e.via, (use.get(e.via) ?? 0) + Math.max(1, e.steps.length));
  }
  return [...use]
    .toSorted((a, b) => b[1] - a[1])
    .map(([id]) => id)
    .slice(0, 3);
}

function callsStop(model: Model): StopView {
  const edges = model.edges('asIs', 'api');
  const owned = (id: string): string => {
    const owner = parentOf(id) ?? '';
    return owner === '' ? '' : `${model.label(owner)} · `;
  };
  return {
    key: 'calls',
    title: 'The calls',
    focus: 'api',
    headline: callsHeadline(model, edges),
    lede: 'Solid lines are calls: the caller waits for the answer. Each lands on the interface it uses.',
    below: {
      kind: 'chips',
      chips: busiestEndpoints(edges).map((id) => ({ id, label: `${owned(id)}${model.label(id)}` })),
    },
  };
}

interface Hub {
  readonly id: string;
  readonly consumers: readonly string[];
  readonly producers: readonly string[];
  readonly messages: readonly string[];
}

const unique = (xs: readonly (string | null)[]): string[] => [
  ...new Set(xs.filter((x): x is string => x !== null)),
];

function topicHubs(model: Model): Hub[] {
  const edges = model.edges('asIs', 'msg');
  return model.asIs.stores
    .filter((s) => isTopic(s.kind))
    .map((t) => {
      const out = edges.filter((e) => e.from === t.id);
      const into = edges.filter((e) => e.to === t.id);
      return {
        id: t.id,
        consumers: unique(out.map((e) => e.to)),
        producers: unique(into.map((e) => e.from)),
        messages: unique([...out, ...into].map((e) => e.via)),
      };
    })
    .toSorted((a, b) => b.consumers.length - a.consumers.length);
}

function eventsHeadline(model: Model, hubs: readonly Hub[]): string {
  const [hub] = hubs;
  if (hub === undefined || hub.consumers.length === 0)
    return 'Nothing in this plan talks through events today.';
  const who = hub.producers.map((p) => model.label(p));
  const verb = who.length === 1 ? 'publishes' : 'publish';
  const listen = hub.consumers.length === 1 ? 'listens' : 'listen';
  const publishers = who.length > 0 ? `${who.join(' and ')} ${verb}, ` : '';
  const says = `${publishers}${countWord(hub.consumers.length, 'component')} ${listen}.`;
  const name = model.label(hub.id);
  if (hub.consumers.length > 1) return `${name} is the hub: ${says}`;
  return hubs.length === 1
    ? `Only ${name} carries events: ${says}`
    : `${name} carries the most events: ${says}`;
}

function eventsStop(model: Model): StopView {
  const hubs = topicHubs(model);
  const [hub] = hubs;
  const ids =
    hub === undefined || hub.consumers.length === 0
      ? []
      : [hub.id, ...hub.messages.slice(0, 1), ...hub.producers.slice(0, 1)];
  return {
    key: 'events',
    title: 'The events',
    focus: 'msg',
    headline: eventsHeadline(model, hubs),
    lede: 'Dashed lines are events: the publisher does not wait, and each listener reacts on its own.',
    below: { kind: 'chips', chips: ids.map((id) => ({ id, label: model.label(id) })) },
  };
}

/** The four stops of the system map, in reading order. */
export function systemStops(model: Model): StopView[] {
  return [ownersStop(model), callsStop(model), eventsStop(model), storeStop(model)];
}
