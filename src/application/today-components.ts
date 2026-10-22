import type { ModelScope } from '@/application/model-scope';
import type { Model } from '@/application/plan/derive';
import { offeredBy } from '@/application/today-catalogue';
import { type ChipRef, chipRefOf } from '@/application/today-scope';

// Each component of a system as a card that teaches it: what it is, what it is called on, what it calls, what it
// announces and listens to, and the data it keeps or uses.

export interface ComponentCard {
  readonly chip: ChipRef;
  /** "Service · Go" */
  readonly kind: string;
  readonly does: string;
  readonly summary: string;
  /** The calls it answers; each opens in the inspector with what answering it sets off. */
  readonly offers: readonly ChipRef[];
  readonly calls: readonly ChipRef[];
  readonly announces: readonly ChipRef[];
  readonly listens: readonly ChipRef[];
  readonly keeps: readonly ChipRef[];
  /** Other components' stores it reads or writes. */
  readonly uses: readonly ChipRef[];
}

const capital = (words: string): string => `${words.charAt(0).toUpperCase()}${words.slice(1)}`;

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
    offers: chips(offeredBy(model, id)),
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
