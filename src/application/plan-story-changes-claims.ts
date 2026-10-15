import type { Model } from '@/application/plan/derive';
import { changeService } from '@/application/plan-viz-ledger-row';
import { numWord } from '@/application/plan-viz-text';

import { recordClaim } from './plan-story-changes-records';

// The claims of the interface and ledger screens.

const uniq = <T>(xs: readonly T[]): T[] => [...new Set(xs)];
const RANK = { breaking: 2, migration: 1, safe: 0 } as const;

interface Item {
  readonly id: string;
  readonly kind: 'retired' | 'shape';
}

function retiredClaim(model: Model, id: string, replacedBy: string | null): string {
  if (model.status(id) === 'removed') return `${model.label(id)} goes away`;
  const next = replacedBy === null ? '' : `; ${model.label(replacedBy)} replaces it`;
  return `${model.label(id)} is deprecated${next}`;
}

/**
 * What the reader takes away from the contracts that are not versioned: the one that matters most, then "and two
 * more". "`order.placed` v1 is deprecated; v2 replaces it".
 */
export function contractClaim(
  model: Model,
  retired: readonly string[],
  shapes: readonly string[],
): string {
  const items: Item[] = [
    ...retired.map((id): Item => ({ id, kind: 'retired' })),
    ...shapes.map((id): Item => ({ id, kind: 'shape' })),
  ];
  const ranked = items
    .map((x, k) => ({ ...x, k, rank: RANK[model.compat(x.id)?.verdict ?? 'safe'] }))
    .toSorted((a, b) => (a.rank === b.rank ? a.k - b.k : b.rank - a.rank));
  const lead = ranked[0];
  if (lead === undefined) return 'Interfaces change shape or go';
  const replacedBy = model.versions(lead.id).replacedBy;
  const first =
    lead.kind === 'retired'
      ? retiredClaim(model, lead.id, replacedBy)
      : recordClaim(model, lead.id);
  const more = items.length - 1;
  if (more === 0) return first;
  return `${first}, and ${numWord(more)} more ${more === 1 ? 'interface changes' : 'interfaces change'} shape or go`;
}

export interface LedgerClaim {
  readonly headline: string;
  readonly lede: string;
}

const needs = (n: number): string =>
  `${numWord(n)} still ${n === 1 ? 'needs a test' : 'need a test'}`;

/** Every change proved and planned, or which are not. */
export function ledgerClaim(model: Model): LedgerClaim {
  const changes = model.plan.changes ?? [];
  const untested = model.health().untested;
  const items = model.plan.work_items ?? [];
  const noWork = changes.filter((c) => !items.some((w) => w.implements.includes(c.id))).length;
  const gaps = [
    ...(untested > 0 ? [needs(untested)] : []),
    ...(noWork > 0 ? [`${numWord(noWork)} ${noWork === 1 ? 'has' : 'have'} no work item`] : []),
  ];
  const services = uniq(changes.map((c) => changeService(model, c.id)));
  const noun = services.length === 1 ? 'component' : 'components';
  const headline =
    gaps.length > 0
      ? `Not every change is proved and planned: ${gaps.join('; ')}.`
      : `Every change has a test and a work item, across ${numWord(services.length)} ${noun}.`;
  return { headline, lede: 'Every change, grouped by the component it changes.' };
}
