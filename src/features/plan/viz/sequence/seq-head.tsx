import type { Model } from '@/application/plan/derive';
import type { SeqPart, SeqView } from '@/application/plan-viz-sequence';
import { columnPlace } from '@/application/plan-viz-sequence-text';
import { TeamDot } from '@/features/plan/common/team-dot';

import styles from './seq-head.module.css';
import { LaneItem, Lanes } from './seq-lanes';

function Part({ model, part }: { readonly model: Model; readonly part: SeqPart }) {
  return (
    <LaneItem align="start" place={columnPlace(part.col)}>
      <button
        aria-label={part.tip}
        className={styles.part}
        data-inspect={part.id}
        data-status={part.status}
        data-store={part.store ? '' : undefined}
        title={part.tip}
        type="button"
      >
        <span className={styles.name}>{part.name}</span>
        <span className={styles.type}>
          <span aria-hidden="true">{part.glyph}</span> {part.word}
        </span>
        {part.team === null ? null : (
          <span className={styles.team}>
            <TeamDot model={model} named teamId={part.team.id} />
          </span>
        )}
      </button>
    </LaneItem>
  );
}

function Person({ name }: { readonly name: string }) {
  return (
    <LaneItem align="start" place={columnPlace(0)}>
      <span className={styles.who} title={`the person: ${name}`}>
        <span className={styles.name}>{name}</span>
        <span className={styles.type}>person</span>
      </span>
    </LaneItem>
  );
}

/** The participants as the heads of their columns: the person who starts the flow, then each system in the order it acts. */
export function Head({ model, view }: { readonly model: Model; readonly view: SeqView }) {
  return (
    <div className={styles.head} data-dense={view.dense ? '' : undefined}>
      <div className={styles.cell} />
      <div className={styles.cell} data-label="idx">
        #
      </div>
      <div className={styles.cell} data-label="act">
        Step
      </div>
      <div className={styles.cell}>
        <Lanes>
          {view.person === null ? null : <Person name={view.person} />}
          {view.parts.map((p) => (
            <Part key={p.id} model={model} part={p} />
          ))}
        </Lanes>
      </div>
    </div>
  );
}
