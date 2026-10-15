import type { Model } from '@/application/plan/derive';
import { numberOf, titleOf, deciding, isDecision } from '@/application/plan-viz-decision';
import { isoDay, shortDate } from '@/application/plan-viz-state';
import { teamName } from '@/application/plan-viz-teams';
import { short } from '@/application/plan-viz-text';

// What holds work up: an open question, or a proposed decision. Drawn as one chip.

export interface Gate {
  readonly id: string;
  readonly decision: boolean;
  readonly number: string;
  readonly label: string;
  readonly decider: string | null;
  readonly date: string | null;
  readonly dateText: string;
  /** An open question past its date. */
  readonly late: boolean;
  readonly aria: string;
}

const LABEL_LENGTH = 72;

function ariaOf(g: Omit<Gate, 'aria'>, model: Model): string {
  const kind = g.decision ? 'proposed decision' : 'question';
  const by = g.decider === null ? '' : `, decided by ${teamName(model, g.decider)}`;
  const when = g.date === null ? '' : `, by ${g.dateText}`;
  return `${kind}: ${g.label}${by}${when}${g.late ? ', overdue' : ''}`;
}

/** A gate to draw, or null when the id is neither a question nor a decision in the plan. */
export function gateOf(model: Model, id: string, today: Date = new Date()): Gate | null {
  const e = deciding(model, id);
  if (e === undefined) return null;
  const decision = isDecision(e);
  const date = e.decide_by ?? null;
  const decider = e.decider?.startsWith('team:') === true ? e.decider : null;
  const open = e.status === 'open';
  const part = {
    id,
    decision,
    number: numberOf(model, id),
    label: short(titleOf(e), LABEL_LENGTH),
    decider,
    date,
    dateText: date === null ? '' : shortDate(date, today),
    late: !decision && open && date !== null && isoDay(date) < isoDay(today.toISOString()),
  };
  return { ...part, aria: ariaOf(part, model) };
}
