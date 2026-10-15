import type { Model } from '@/application/plan/derive';
import type { WorkRow } from '@/application/plan-story-versions-work';
import { STATE_WORD } from '@/application/plan-viz-work';
import { EntityChip } from '@/features/plan/common/entity-chip';
import { ModelInline } from '@/features/plan/common/model-text';
import { TeamTag } from '@/features/plan/common/team-dot';

import styles from './work-rows.module.css';

function Title({ model, w }: { readonly model: Model; readonly w: WorkRow }) {
  return model.get(w.id) === undefined ? (
    <span className={styles.title}>{w.title}</span>
  ) : (
    <EntityChip id={w.id} model={model} />
  );
}

function Why({ model, w }: { readonly model: Model; readonly w: WorkRow }) {
  if (w.why === null) return null;
  return (
    <span className={styles.why}>
      {w.why.inferred ? <span className={styles.inferred}>inferred</span> : <b>{w.why.lead}</b>}{' '}
      <ModelInline model={model} text={w.why.text} />
    </span>
  );
}

/** The work items a revision touches, each tagged with what it does to them. */
export function WorkRows({
  model,
  rows,
}: {
  readonly model: Model;
  readonly rows: readonly WorkRow[];
}) {
  return (
    <ul className={styles.rows}>
      {rows.map((w) => (
        <li className={styles.row} key={w.id}>
          <div className={styles.line}>
            <Title model={model} w={w} />
            {w.size === null ? null : <span className={styles.fact}>size {w.size}</span>}
            {w.state === null ? null : <span className={styles.fact}>{STATE_WORD[w.state]}</span>}
            <span
              className={styles.tag}
              data-pending={w.tag.pending ? '' : undefined}
              title={w.tag.why}
            >
              {w.tag.text}
            </span>
          </div>
          <Why model={model} w={w} />
        </li>
      ))}
    </ul>
  );
}

/** A team's name: its tag when the plan on show has the team, else the name as written. */
export function TeamName({
  model,
  id,
  name,
}: {
  readonly model: Model;
  readonly id: string;
  readonly name: string;
}) {
  return model.get(id) === undefined ? <b>{name}</b> : <TeamTag model={model} teamId={id} />;
}
