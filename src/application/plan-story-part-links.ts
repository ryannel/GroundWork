import type { Model } from '@/application/plan/derive';
import type { Edge } from '@/application/plan/derive-edges';
import { prop } from '@/application/plan/ids';

// Who a team's services talk to, resolved through the topic hub so the counterpart is always a service.

export interface Connection {
  readonly other: string;
  readonly via: string;
  readonly kind: 'api' | 'msg';
  readonly status: string;
  readonly verb: 'listens to' | 'publishes' | 'serves' | 'calls';
}

export interface Connections {
  /** Services that call this team's, or listen to an event it publishes. */
  readonly dependsOnYou: readonly Connection[];
  /** Services this team's call, or whose events it consumes. */
  readonly youDependOn: readonly Connection[];
}

const ORDER: Readonly<Record<string, number>> = { added: 0, deprecated: 1, removed: 2 };
const AFTER_CHANGES = 3;
const rank = (c: Connection): number => ORDER[c.status] ?? AFTER_CHANGES;

const isTopic = (model: Model, id: string): boolean => {
  const kind = prop(model.get(id), 'kind');
  return kind === 'topic' || kind === 'queue';
};

interface Hub {
  readonly producers: readonly Edge[];
  readonly consumers: readonly Edge[];
}

/** Message edges run producer, topic, consumer; a direct edge with no topic is both. */
function hubs(model: Model, edges: readonly Edge[]): Map<string, Hub> {
  const byVia = new Map<string, Hub>();
  for (const e of edges) {
    const hub = byVia.get(e.via ?? '') ?? { producers: [], consumers: [] };
    const produces = isTopic(model, e.to) || !isTopic(model, e.from);
    const consumes = !isTopic(model, e.to);
    byVia.set(e.via ?? '', {
      producers: produces ? [...hub.producers, e] : hub.producers,
      consumers: consumes ? [...hub.consumers, e] : hub.consumers,
    });
  }
  return byVia;
}

interface Rows {
  readonly dependsOnYou: readonly Connection[];
  readonly youDependOn: readonly Connection[];
}

/** One hub: each effective consumer paired with each producer of the same event. */
function messageRows(mine: ReadonlySet<string>, via: string, hub: Hub): Rows {
  const dependsOnYou: Connection[] = [];
  const youDependOn: Connection[] = [];
  const producers = [...new Set(hub.producers.map((e) => e.from))];
  const pairs = hub.consumers.flatMap((consumer) =>
    producers.filter((p) => p !== consumer.to).map((producer) => ({ consumer, producer })),
  );
  for (const { consumer, producer } of pairs) {
    const own = hub.producers.find((e) => e.from === producer)?.status ?? 'existing';
    const status =
      consumer.status === 'existing' || consumer.status === undefined ? own : consumer.status;
    const row = { via, kind: 'msg', status } as const;
    if (mine.has(producer) && !mine.has(consumer.to)) {
      dependsOnYou.push({ ...row, other: consumer.to, verb: 'listens to' });
    }
    if (mine.has(consumer.to) && !mine.has(producer)) {
      youDependOn.push({ ...row, other: producer, verb: 'publishes' });
    }
  }
  return { dependsOnYou, youDependOn };
}

function callRows(mine: ReadonlySet<string>, e: Edge): Rows {
  const row = { via: e.via ?? '', kind: 'api', status: e.status ?? 'existing' } as const;
  return {
    youDependOn:
      mine.has(e.from) && !mine.has(e.to) ? [{ ...row, other: e.to, verb: 'serves' }] : [],
    dependsOnYou:
      mine.has(e.to) && !mine.has(e.from) ? [{ ...row, other: e.from, verb: 'calls' }] : [],
  };
}

function unique(rows: readonly Connection[]): Connection[] {
  const seen = new Set<string>();
  return rows.filter((r) => {
    const key = `${r.other}|${r.via}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function connections(model: Model, services: readonly string[]): Connections {
  const mine = new Set(services);
  const edges = model.edges('diff', 'all');
  const messages = [
    ...hubs(
      model,
      edges.filter((e) => e.kind === 'msg'),
    ),
  ].map(([via, hub]) => messageRows(mine, via, hub));
  const all = [...messages, ...edges.filter((e) => e.kind === 'api').map((e) => callRows(mine, e))];
  const sorted = (pick: (r: Rows) => readonly Connection[]): Connection[] =>
    unique(all.flatMap(pick)).toSorted((a, b) => rank(a) - rank(b));
  return { dependsOnYou: sorted((r) => r.dependsOnYou), youDependOn: sorted((r) => r.youDependOn) };
}
