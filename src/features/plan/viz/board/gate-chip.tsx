import type { Model } from '@/application/plan/derive';
import { gateOf } from '@/application/plan-viz-gate';
import { TeamDot } from '@/features/plan/common/team-dot';
import { Badge } from '@/ui/badge';
import { Glyph } from '@/ui/icon';

import styles from './gate-chip.module.css';

/** An open question, or a proposed decision, as a chip: its number, title, who decides, by when, and whether it is late. */
export function GateChip({ model, id }: { readonly model: Model; readonly id: string }) {
  const gate = gateOf(model, id, new Date());
  if (gate === null) return null;
  return (
    <button
      aria-label={gate.aria}
      className={styles.chip}
      data-inspect={id}
      data-late={gate.late ? '' : undefined}
      type="button"
    >
      <span aria-hidden="true">
        <Glyph glyph={gate.decision ? '⚖' : '?'} />
      </span>
      {gate.number === '' ? null : <span className={styles.ref}>{gate.number}</span>}
      <span className={styles.label}>{gate.label}</span>
      {gate.decider === null ? null : <TeamDot model={model} teamId={gate.decider} />}
      {gate.date === null ? null : <span className={styles.date}>{gate.dateText}</span>}
      {gate.late ? <Badge tone="removed">overdue</Badge> : null}
    </button>
  );
}
