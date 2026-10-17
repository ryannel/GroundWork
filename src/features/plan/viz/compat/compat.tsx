import type { Model } from '@/application/plan/derive';
import {
  compatBadgeView,
  WHO_SHOWN,
  whoKey,
  whoView,
  type WhoEntry,
} from '@/application/plan-viz-compat';
import { EntityChip } from '@/features/plan/common/entity-chip';

import styles from './compat.module.css';

interface CompatProps {
  readonly model: Model;
  readonly id: string;
}

/** Breaking, needs migration or safe, with who it touches; its title lists why. `quiet` leaves a safe verdict out. */
export function CompatBadge({
  model,
  id,
  quiet = false,
}: CompatProps & { readonly quiet?: boolean }) {
  const view = compatBadgeView(model, id, { quiet });
  if (view === null) return null;
  return (
    <span
      className={styles.badge}
      data-compat={view.verdict}
      title={view.why === '' ? undefined : view.why}
    >
      <span>{view.word}</span>
      {view.tail === '' ? null : <span className={styles.tail}>{view.tail}</span>}
    </span>
  );
}

function Line({
  model,
  label,
  entries,
  note,
  brief,
}: {
  readonly model: Model;
  readonly label: string;
  readonly entries: readonly WhoEntry[];
  readonly note?: string;
  readonly brief: boolean;
}) {
  if (entries.length === 0) return null;
  return (
    <div className={styles.line}>
      <span className={styles.key}>{label}</span>
      <span className={styles.list}>
        {entries.slice(0, WHO_SHOWN).map((e) => (
          <span className={styles.item} key={whoKey(e)}>
            <EntityChip id={e.svc} model={model} status="existing" />
            {brief || e.where === null ? null : (
              <>
                <span className={styles.faint}>{e.where.word}</span>
                <EntityChip id={e.where.id} model={model} status="existing" />
              </>
            )}
          </span>
        ))}
        {entries.length > WHO_SHOWN ? (
          <span className={styles.faint}>+{entries.length - WHO_SHOWN} more</span>
        ) : null}
      </span>
      {note === undefined ? null : <span className={styles.faint}>{note}</span>}
    </div>
  );
}

/**
 * Who a change touches, one line each: Breaks (not moved by this plan) and Moves. `brief` is the form for a table
 * cell: services only, and a prompt to check when nobody is recorded reading a breaking change.
 */
export function CompatLines({
  model,
  id,
  brief = false,
}: CompatProps & { readonly brief?: boolean }) {
  const view = whoView(model, id);
  if (view === null) return null;
  if (view.breaks.length === 0 && view.moves.length === 0) {
    return view.noReader && brief ? (
      <div className={styles.line}>
        <span className={styles.key}>Check service readers</span>
        <span className={styles.faint}>
          no service reader is recorded; check before changing it
        </span>
      </div>
    ) : null;
  }
  return (
    <div className={styles.who}>
      <Line
        brief={brief}
        entries={view.breaks}
        label="Breaks"
        model={model}
        note="not moved by this plan"
      />
      <Line brief={brief} entries={view.moves} label="Moves" model={model} />
    </div>
  );
}
