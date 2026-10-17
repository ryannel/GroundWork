import type { Planned } from '@/application/plan/impact-planned';

/** A run-time dependency the revision adds: a service now calls another (call), or now listens to its events (event). */
export interface Edge {
  readonly from: string;
  readonly to: string;
  readonly kind: 'call' | 'event';
  readonly steps: readonly string[];
  readonly message: string | null;
  /** A call where there was only an event. */
  readonly before: 'event' | null;
  readonly teams: readonly string[];
  readonly crossTeam: boolean;
}

type Pairs = ReadonlyMap<string, Omit<Edge, 'before' | 'teams' | 'crossTeam'>>;

function pairsOf(P: Planned): Pairs {
  const m = new Map<string, Omit<Edge, 'before' | 'teams' | 'crossTeam'>>();
  const put = (
    link: Omit<Edge, 'steps' | 'before' | 'teams' | 'crossTeam'>,
    step: string | null,
  ) => {
    if (link.from === link.to) return;
    const k = `${link.kind}:${link.from}→${link.to}`;
    const edge = m.get(k) ?? { ...link, steps: [] };
    m.set(k, step === null ? edge : { ...edge, steps: [...edge.steps, step] });
  };
  for (const { step } of P.steps.values()) {
    if (P.deprecated.has(step.id) || P.messages.has(step.via)) continue;
    if (P.services.has(step.from) && P.services.has(step.to)) {
      put({ from: step.from, to: step.to, kind: 'call', message: null }, step.id);
    }
  }
  for (const msg of P.messages.values()) {
    for (const c of msg.consumers ?? []) {
      put({ from: msg.producer, to: c, kind: 'event', message: msg.id }, null);
    }
  }
  return m;
}

/**
 * Run-time dependencies the revision adds. A call where there was only an event is new: the caller now stops when
 * the other is down.
 */
export function newEdges(A: Planned, B: Planned): Edge[] {
  const a = pairsOf(A);
  const out: Edge[] = [];
  for (const [k, e] of pairsOf(B)) {
    if (a.has(k)) continue;
    const ft = B.services.get(e.from)?.team ?? null;
    const tt = B.services.get(e.to)?.team ?? null;
    out.push({
      ...e,
      before: a.has(`event:${e.from}→${e.to}`) ? 'event' : null,
      teams: [...new Set([ft, tt].filter((t) => t !== null))],
      crossTeam: ft !== null && tt !== null && ft !== tt,
    });
  }
  return out;
}
