import type { ModelScope } from '@/application/model-scope';
import type { Model } from '@/application/plan/derive';
import { type ChipRef, chipRefOf } from '@/application/today-scope';

// What a scope offers, announces and keeps, as short rows of chips: each row a thing in the scope, each chip
// something the inspector opens. Rows keep only what a component in the scope owns.

export interface CatalogueRow {
  readonly head: ChipRef;
  /** One plain line on the head: what it does, or who it goes to. */
  readonly note: string;
  readonly items: readonly ChipRef[];
}

export interface Catalogue {
  /** Each component that answers calls, with the endpoints and operations it is called on. */
  readonly apis: readonly CatalogueRow[];
  /** Each message a component in the scope announces, with who listens. */
  readonly events: readonly CatalogueRow[];
  /** Each store the scope keeps, with the records in it. */
  readonly data: readonly CatalogueRow[];
}

const unique = (ids: readonly string[]): string[] => [...new Set(ids)];

/** The endpoints and operations a component is called on: its own interfaces', and what callers name. */
export function offeredBy(model: Model, service: string): string[] {
  const own = model.asIs.interfaces
    .filter((i) => i.service === service)
    .flatMap((i) => i.endpoints.map((e) => e.id));
  const called = model
    .edges('asIs', 'api')
    .filter((e) => e.to === service && e.via !== null)
    .map((e) => e.via ?? '');
  return unique([...own, ...called]);
}

const refs = (model: Model, ids: readonly string[]): ChipRef[] =>
  ids.map((id) => chipRefOf(model, id));

function apisOf(model: Model, scope: ModelScope): CatalogueRow[] {
  return model.asIs.services
    .filter((s) => scope.focus.has(s.id))
    .flatMap((s) => {
      const offered = offeredBy(model, s.id);
      if (offered.length === 0) return [];
      return [{ head: chipRefOf(model, s.id), note: s.does ?? '', items: refs(model, offered) }];
    });
}

function eventsOf(model: Model, scope: ModelScope): CatalogueRow[] {
  return model.asIs.messages
    .filter((m) => scope.focus.has(m.producer))
    .map((m) => {
      const to = m.consumers ?? [];
      return {
        head: chipRefOf(model, m.id),
        note:
          to.length === 0
            ? `From ${model.label(m.producer)}; no one listens yet`
            : `From ${model.label(m.producer)} to`,
        items: refs(model, to),
      };
    });
}

function dataOf(model: Model, scope: ModelScope): CatalogueRow[] {
  return model.asIs.stores
    .filter((s) => scope.focus.has(s.id) && s.kind !== 'topic' && s.kind !== 'queue')
    .map((s) => ({
      head: chipRefOf(model, s.id),
      note: s.does ?? `Kept by ${model.label(s.owner)}`,
      items: refs(
        model,
        model.asIs.schemas.filter((x) => x.store === s.id).map((x) => x.id),
      ),
    }));
}

/** What the components in the scope offer, announce and keep. */
export function catalogueOf(model: Model, scope: ModelScope): Catalogue {
  return { apis: apisOf(model, scope), events: eventsOf(model, scope), data: dataOf(model, scope) };
}
