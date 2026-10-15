import type { ReactNode } from 'react';

import type { Model } from '@/application/plan/derive';
import type { ElementStatus, Mode } from '@/application/plan/derive-core';
import {
  keyBadges,
  noteCell,
  requiredCell,
  rollouts,
  type KeyBadge,
  type KeyContext,
} from '@/application/plan-viz-field-cells';
import type { FieldRow } from '@/application/plan-viz-fields';
import { short } from '@/application/plan-viz-text';
import { EntityChip } from '@/features/plan/common/entity-chip';
import { ModelInline } from '@/features/plan/common/model-text';
import { CompatLines } from '@/features/plan/viz/compat/compat';
import { Glyph } from '@/ui/icon';

import styles from './field-cells.module.css';

const GUT: Partial<Record<ElementStatus, string>> = {
  added: '+',
  modified: '~',
  deprecated: '·',
  removed: '×',
};
const GUT_WORD: Partial<Record<ElementStatus, string>> = {
  added: 'new',
  modified: 'changed',
  deprecated: 'deprecated · still works',
  removed: 'removed',
};

export type Column = 'gut' | 'field' | 'type' | 'required' | 'key' | 'note' | 'changed by';

const headWord = (column: Column, graphType: boolean): string =>
  column === 'key' && graphType ? 'key · owned by' : column;

export function HeadCells({
  columns,
  graphType,
}: {
  readonly columns: readonly Column[];
  readonly graphType: boolean;
}) {
  return columns.map((c) => (
    <th data-column={c} key={c}>
      {c === 'gut' ? <span className={styles.srOnly}>change</span> : headWord(c, graphType)}
    </th>
  ));
}

export function Gut({
  status,
  marked,
}: {
  readonly status: ElementStatus;
  readonly marked: boolean;
}) {
  return (
    <td
      aria-label={status === 'existing' ? 'unchanged' : (GUT_WORD[status] ?? status)}
      className={styles.gut}
      data-status={status}
    >
      {marked ? (GUT[status] ?? '') : ''}
    </td>
  );
}

interface NoteProps {
  readonly model: Model;
  readonly row: FieldRow;
  readonly status: ElementStatus;
  readonly mode: Mode;
  readonly who: boolean;
}

/** Everything said about a field beyond its type: lifecycle, the author's note, what else changed, rollout, who moves. */
export function NoteBody({ model, row, status, mode, who }: NoteProps) {
  const note = noteCell(model, row);
  const words = rollouts(model, { ...row, status }, mode);
  return (
    <>
      {status === 'deprecated' ? (
        <div className={styles.lifecycle}>Deprecated · still works</div>
      ) : null}
      {note.note === null ? null : <ModelInline model={model} text={note.note} />}
      {note.others.map((o) => (
        <div className={styles.was} key={o.prop}>
          <span className={styles.faint}>{o.prop} was</span> {o.was}
        </div>
      ))}
      {words.map((w) => (
        <div className={styles.rollout} key={w}>
          <strong>Rollout:</strong> <ModelInline model={model} text={w} />
        </div>
      ))}
      {who && mode === 'diff' ? <CompatLines brief model={model} id={row.fid} /> : null}
    </>
  );
}

/** The field's name, and in the compact form its note under it. */
export function NameTd({
  row,
  compact,
  status,
  children,
}: {
  readonly row: FieldRow;
  readonly compact: boolean;
  readonly status: ElementStatus;
  readonly children: ReactNode;
}) {
  return (
    <td className={styles.field}>
      <button className={styles.name} data-inspect={row.fid} data-status={status} type="button">
        {row.field.name}
      </button>
      {compact ? <div className={styles.note}>{children}</div> : null}
    </td>
  );
}

export function NoteTd({ children }: { readonly children: ReactNode }) {
  return <td className={styles.note}>{children}</td>;
}

export function RequiredTd({ row }: { readonly row: FieldRow }) {
  const cell = requiredCell(row);
  return (
    <td className={styles.req}>
      {cell.required ? <span className={styles.required}>required</span> : null}
      {cell.was === null ? null : <div className={styles.was}>{cell.was}</div>}
    </td>
  );
}

function Badge({ model, badge }: { readonly model: Model; readonly badge: KeyBadge }) {
  const inner = (
    <>
      {badge.glyph === undefined ? null : (
        <span aria-hidden="true" className={styles.badgeGlyph}>
          <Glyph glyph={badge.glyph} />
        </span>
      )}
      {badge.text}
    </>
  );
  if (badge.id === undefined) {
    return (
      <span className={styles.badge} title={badge.title}>
        {inner}
      </span>
    );
  }
  if (badge.key === 'fk') {
    return (
      <button className={styles.badge} data-inspect={badge.id} title={badge.title} type="button">
        {inner}
      </button>
    );
  }
  return <EntityChip id={badge.id} label={badge.text} model={model} />;
}

export function KeyTd({
  model,
  row,
  ctx,
}: {
  readonly model: Model;
  readonly row: FieldRow;
  readonly ctx: KeyContext;
}) {
  return (
    <td className={styles.key}>
      <span className={styles.badges}>
        {keyBadges(model, row.field, ctx).map((b) => (
          <Badge badge={b} key={b.key + (b.id ?? '')} model={model} />
        ))}
      </span>
    </td>
  );
}

export function ChangedByTd({
  model,
  row,
  order,
}: {
  readonly model: Model;
  readonly row: FieldRow;
  /** The numbering of the changes when the table gives each a number; else each is named. */
  readonly order: readonly string[] | null;
}) {
  return (
    <td className={styles.changedBy}>
      {row.changes.map((c) =>
        order === null ? (
          <EntityChip
            id={c}
            key={c}
            label={short(model.label(c), 64)}
            model={model}
            status="existing"
          />
        ) : (
          <span className={styles.number} key={c} title={model.label(c)}>
            {order.indexOf(c) + 1}
          </span>
        ),
      )}
    </td>
  );
}

export function ChangeKey({
  model,
  order,
}: {
  readonly model: Model;
  readonly order: readonly string[];
}) {
  if (order.length === 0) return null;
  return (
    <ol className={styles.changeKey}>
      {order.map((c, i) => (
        <li key={c}>
          <span className={styles.number}>{i + 1}</span>
          <EntityChip id={c} label={short(model.label(c), 72)} model={model} status="existing" />
        </li>
      ))}
    </ol>
  );
}
