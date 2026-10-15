import type { DeliveryState } from '@/application/plan/delivery';
import type { Model } from '@/application/plan/derive';
import { labelOf, prop } from '@/application/plan/ids';
import { type RevisionImpact, revisionImpact } from '@/application/plan/impact';
import type { PlanDiff } from '@/application/plan/plan-diff-core';
import type { RevisionEntry } from '@/application/plan/revision-ledger';
import type { Revision, RevisionStep } from '@/application/plan/revision-types';
import { findEntity } from '@/application/plan/revision-view';
import { type Tense, unmark } from '@/application/plan-story-versions-words';
import type { Plan } from '@/domain/plan/plan.generated';

/** A revision and the approved one it was proposed on, with what changes between them. */
export interface Pair {
  readonly from: Plan;
  readonly to: Plan;
  readonly fromVersion: string;
  readonly toVersion: string;
  readonly entry: RevisionEntry;
  readonly diff: PlanDiff;
  readonly im: RevisionImpact;
}

/** The pair a version's page compares, or null when either copy or the diff is missing. */
export function pairOf(rv: Revision, st: RevisionStep, delivery: DeliveryState): Pair | null {
  if (st.base === null) return null;
  const diff = rv.diffOf(st.version);
  const from = rv.plans.get(st.base);
  const to = rv.plans.get(st.version);
  if (diff === null || from === undefined || to === undefined) return null;
  // delivery only means something for the live proposal: history's rework is done or never happened
  const live = st.entry.status === 'proposed';
  const im = revisionImpact({ from, to, diff, delivery: live ? delivery : null, entry: st.entry });
  return { from, to, fromVersion: st.base, toVersion: st.version, entry: st.entry, diff, im };
}

/** A pair, the tense its page is told in, and the plan on show (which knows which ids to link). */
export interface View {
  readonly model: Model;
  readonly pair: Pair;
  readonly tense: Tense;
}

type Sides = Pick<Pair, 'from' | 'to'>;

/** A thing's name in whichever revision has it; the impact knows what the ops add. */
export function nameIn(pair: Sides & { im?: RevisionImpact }, id: string): string {
  const found = findEntity(pair.to, id) ?? findEntity(pair.from, id);
  if (found !== null) return unmark(labelOf(found, id));
  return unmark(pair.im?.nameOf(id) ?? id.replace(/^[a-z]+:/, ''));
}

/** The team that owns a service, else the service's own name. */
export function teamOfService(pair: Pair, id: string): string {
  const service = findEntity(pair.to, id) ?? findEntity(pair.from, id);
  const team = prop(service, 'team');
  return typeof team === 'string' ? nameIn(pair, team) : nameIn(pair, id);
}

/** A step or region property as text: ids by name, prose without markup. */
export function valueText(pair: Pair, value: unknown): string {
  if (value === null || value === undefined || value === '') return '';
  if (Array.isArray(value)) return value.map((x: unknown) => valueText(pair, x)).join(', ');
  if (typeof value !== 'string' && typeof value !== 'number' && typeof value !== 'boolean')
    return JSON.stringify(value);
  const text = String(value);
  if (!/^[a-z]+:[\w-]/.test(text) || /\s/.test(text)) return unmark(text);
  const [id = text, part] = text.split('#');
  return part === undefined ? nameIn(pair, id) : `${nameIn(pair, id)} · ${part}`;
}

/** A thing in text: a citation when the plan on show has it, else its name in bold. */
export function refText(view: View, id: string): string {
  return view.model.get(id) === undefined ? `**${nameIn(view.pair, id)}**` : `[[${id}]]`;
}
