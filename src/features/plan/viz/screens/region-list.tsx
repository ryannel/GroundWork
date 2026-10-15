import type { Model } from '@/application/plan/derive';
import type { ProposedMarks } from '@/application/plan/proposed';
import {
  type RegionChange,
  type RegionRow,
  type ScreenMode,
  regionChange,
  regionNumbers,
  regionsOf,
} from '@/application/plan-viz-screens';
import { EntityChip } from '@/features/plan/common/entity-chip';
import { ModelText } from '@/features/plan/common/model-text';
import { StatusBadge } from '@/features/plan/common/status-badge';

import { ProposedTag } from './proposed-tag';
import styles from './region-list.module.css';
import { RegionNumber } from './region-number';

export interface RegionListProps {
  readonly model: Model;
  /** The screen. */
  readonly id: string;
  readonly mode?: ScreenMode;
  /** Say what the plan does to each region, and list the ones it removes. */
  readonly status?: boolean;
  /** Ids of the regions to light. */
  readonly focus?: readonly string[];
  /** Number the rows to match the picture. */
  readonly numbered?: boolean;
  readonly proposed?: ProposedMarks | null;
}

interface RowProps extends Pick<RegionListProps, 'model' | 'proposed' | 'status' | 'mode'> {
  readonly row: RegionRow;
  readonly n: number;
  readonly lit: boolean;
  readonly numbered: boolean;
}

const NO_CHANGE: RegionChange = { shows: null, lines: [] };

function Shows({
  model,
  text,
  change,
}: {
  readonly model: Model;
  readonly text: string;
  readonly change: RegionChange['shows'];
}) {
  if (change !== null) {
    return (
      <div className={styles.change}>
        <del className={styles.old}>
          <ModelText model={model} text={change.before} />
        </del>
        <div className={styles.new}>
          <ModelText model={model} text={change.after} />
        </div>
      </div>
    );
  }
  if (text === '') return null;
  return (
    <div className={styles.shows}>
      <ModelText model={model} text={text} />
    </div>
  );
}

function Words({
  model,
  row,
  diffs,
}: {
  readonly model: Model;
  readonly row: RegionRow;
  readonly diffs: boolean;
}) {
  const { shows, lines } = diffs && !row.gone ? regionChange(model, row.id) : NO_CHANGE;
  return (
    <>
      <Shows change={shows} model={model} text={row.shows} />
      {row.reads.length === 0 ? null : (
        <div className={styles.reads}>
          shows
          {row.reads.map((read) => (
            <EntityChip id={read} key={read} model={model} status="existing" />
          ))}
        </div>
      )}
      {lines.length === 0 ? null : (
        <ul className={styles.edits}>
          {lines.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      )}
    </>
  );
}

function Row({ model, row, n, lit, numbered, proposed, status, mode }: RowProps) {
  return (
    <li
      className={styles.row}
      data-lit={lit ? '' : undefined}
      data-region={row.id}
      data-status={row.status}
    >
      <div className={styles.head}>
        {numbered ? (
          <RegionNumber gone={row.gone} n={n} status={status === true ? row.status : undefined} />
        ) : null}
        {row.gone ? (
          <span className={styles.gone} title={row.id}>
            <del>{row.name}</del>
          </span>
        ) : (
          <EntityChip id={row.id} model={model} status="existing" />
        )}
        <StatusBadge status={row.status} />
        {mode === 'asIs' ? null : <ProposedTag id={row.id} marks={proposed} />}
      </div>
      <Words diffs={status === true} model={model} row={row} />
    </li>
  );
}

// The regions of a screen: name, what it shows, what it reads. With `status` on the list also holds the regions
// the plan removes, struck and last, and says what the plan does to each region's words.
export function RegionList({
  model,
  id,
  mode = 'toBe',
  status = mode !== 'asIs',
  focus = [],
  numbered = status,
  proposed = null,
}: RegionListProps) {
  const rows = regionsOf(model, id, { mode, status });
  if (rows.length === 0) return null;
  const numbers = regionNumbers(rows);
  return (
    <ul className={styles.list}>
      {rows.map((row) => (
        <Row
          lit={focus.includes(row.id)}
          mode={mode}
          model={model}
          n={numbers.get(row.id) ?? 0}
          numbered={numbered}
          proposed={proposed}
          row={row}
          status={status}
          key={row.id}
        />
      ))}
    </ul>
  );
}
