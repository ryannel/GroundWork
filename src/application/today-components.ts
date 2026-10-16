import type { ModelScope } from '@/application/model-scope';
import type { Model } from '@/application/plan/derive';
import type { CallTree } from '@/application/plan/derive-handlers';
import { offeredBy } from '@/application/today-catalogue';
import { type ChipRef, chipRefOf } from '@/application/today-scope';

// Each component of a system as a card that teaches it: what it is, what it is called on and what each call sets
// off, what it calls, what it announces and listens to, and the data it keeps or uses.

/** One step a handler takes, indented by how far below the entry it is. */
export interface CallLine {
  readonly key: string;
  readonly depth: number;
  readonly chip: ChipRef;
  readonly says: string;
}

export interface Offer {
  readonly chip: ChipRef;
  /** What answering it sets off, when the code's handlers are known; empty when they are not. */
  readonly calls: readonly CallLine[];
}

export interface ComponentCard {
  readonly chip: ChipRef;
  /** "Service · Go" */
  readonly kind: string;
  readonly does: string;
  readonly summary: string;
  readonly offers: readonly Offer[];
  readonly calls: readonly ChipRef[];
  readonly announces: readonly ChipRef[];
  readonly listens: readonly ChipRef[];
  readonly keeps: readonly ChipRef[];
  /** Other components' stores it reads or writes. */
  readonly uses: readonly ChipRef[];
}

const DEEPEST = 3;
const VERBS = { call: 'calls', publish: 'announces', read: 'reads', write: 'writes' } as const;
const capital = (words: string): string => `${words.charAt(0).toUpperCase()}${words.slice(1)}`;

function linesOf(model: Model, trees: readonly CallTree[], depth: number): CallLine[] {
  return trees.flatMap((tree) =>
    tree.links.flatMap((link, index) => [
      {
        key: `${tree.handler}:${String(index)}:${String(depth)}`,
        depth,
        chip: chipRefOf(model, link.target),
        says: link.does ?? capital(VERBS[link.kind]),
      },
      ...(depth < DEEPEST ? linesOf(model, link.next, depth + 1) : []),
    ]),
  );
}

const unique = (ids: readonly string[]): string[] => [...new Set(ids)];

function talk(model: Model, id: string) {
  const edges = model.edges('asIs', 'all');
  const vias = (kind: string, from: (e: (typeof edges)[number]) => boolean) =>
    unique(
      edges
        .filter((e) => e.kind === kind && from(e))
        .flatMap((e) => (e.via === null ? [] : [e.via])),
    );
  return {
    calls: vias('api', (e) => e.from === id),
    announces: model.asIs.messages.filter((m) => m.producer === id).map((m) => m.id),
    listens: model.asIs.messages.filter((m) => (m.consumers ?? []).includes(id)).map((m) => m.id),
    keeps: model.asIs.stores.filter((s) => s.owner === id).map((s) => s.id),
    uses: unique(
      edges
        .filter((e) => e.kind === 'data' && e.from === id && model.ownerService(e.to) !== id)
        .map((e) => e.to),
    ),
  };
}

function cardOf(model: Model, id: string): ComponentCard {
  const node = model.asIs.services.find((s) => s.id === id);
  const parts = talk(model, id);
  const chips = (ids: readonly string[]) => ids.map((x) => chipRefOf(model, x));
  return {
    chip: chipRefOf(model, id),
    kind: [capital(node?.kind ?? 'service'), node?.tech ?? ''].filter((x) => x !== '').join(' · '),
    does: node?.does ?? '',
    summary: node?.summary ?? '',
    offers: offeredBy(model, id).map((via) => ({
      chip: chipRefOf(model, via),
      calls: linesOf(model, model.callTree(via, { mode: 'asIs', depth: DEEPEST }), 0),
    })),
    calls: chips(parts.calls),
    announces: chips(parts.announces),
    listens: chips(parts.listens),
    keeps: chips(parts.keeps),
    uses: chips(parts.uses),
  };
}

/** A card for each component in the scope, in the order the model lists them. */
export function componentCardsOf(model: Model, scope: ModelScope): ComponentCard[] {
  return model.asIs.services.filter((s) => scope.focus.has(s.id)).map((s) => cardOf(model, s.id));
}
