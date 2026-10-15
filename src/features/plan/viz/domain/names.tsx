import type { Model } from '@/application/plan/derive';
import {
  type NameCell,
  type NameLine,
  type NamesPlan,
  domainView,
  namesPlan,
} from '@/application/plan-viz-domain';
import { teamOf } from '@/application/plan-viz-teams';
import { EntityChip } from '@/features/plan/common/entity-chip';
import { TeamDot } from '@/features/plan/common/team-dot';
import { ScrollCue } from '@/features/plan/viz/zoompane/scroll-cue.client';

import styles from './names.module.css';

export interface NamesProps {
  readonly model: Model;
  /** Only what runs today. */
  readonly today?: boolean;
}

function Cell({ cell, name }: { readonly cell: NameCell; readonly name: string }) {
  if (cell.names.length === 0) {
    return (
      <td className={styles.cell} data-born={cell.born ? '' : undefined}>
        {cell.born ? (
          <span className={styles.name}>{name}</span>
        ) : (
          <span aria-label="not stored here">·</span>
        )}
      </td>
    );
  }
  return (
    <td className={styles.cell} data-born={cell.born ? '' : undefined}>
      {cell.names.map((n) =>
        n.at === null ? (
          <span className={styles.name} key={n.as} title={n.note === '' ? undefined : n.note}>
            {n.as}
          </span>
        ) : (
          <button
            className={styles.name}
            data-inspect={n.at}
            key={n.as}
            title={n.note === '' ? undefined : n.note}
            type="button"
          >
            {n.as}
          </button>
        ),
      )}
    </td>
  );
}

function Table({ model, names }: { readonly model: Model; readonly names: NamesPlan }) {
  return (
    <>
      <ScrollCue note>
        <table className={styles.table}>
          <caption className={styles.hidden}>What each system calls the same thing</caption>
          <thead>
            <tr>
              <th scope="col">Concept</th>
              {names.columns.map((id) => {
                const team = teamOf(model, id);
                return (
                  <th key={id} scope="col">
                    {team === null ? null : <TeamDot model={model} teamId={team} />}
                    <EntityChip id={id} model={model} />
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {names.rows.map((row) => (
              <tr key={row.id}>
                <th scope="row">
                  <EntityChip id={row.id} label={row.name} model={model} />
                </th>
                {row.cells.map((cell, i) => (
                  <Cell cell={cell} key={names.columns[i]} name={row.name} />
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </ScrollCue>
      <p className={styles.key}>Shaded: where the id is created · · not stored here</p>
    </>
  );
}

function sep(i: number, n: number): string {
  if (i === 0) return '';
  return i === n - 1 ? ' and ' : ', ';
}

function Line({ model, line }: { readonly model: Model; readonly line: NameLine }) {
  return (
    <li>
      <EntityChip id={line.id} label={line.name} model={model} /> is{' '}
      {line.names.map((n, i) => (
        <span key={n.as}>
          {sep(i, line.names.length)}
          <span className={styles.name}>{n.as}</span>
          {n.systems.length === 0 ? '' : ' in '}
          {n.systems.map((id, k) => (
            <span key={id}>
              {sep(k, n.systems.length)}
              <EntityChip id={id} model={model} />
            </span>
          ))}
        </span>
      ))}
      .
    </li>
  );
}

/**
 * What each system calls the same thing: a table where concepts share names across systems, otherwise one
 * sentence per concept with a second name. Nothing when no concept has one.
 */
export function Names({ model, today = false }: NamesProps) {
  const names = namesPlan(model, domainView(model, today));
  if (names.kind === 'none') return null;
  if (names.kind === 'table') return <Table model={model} names={names} />;
  return (
    <ul className={styles.lines}>
      {names.lines.map((line) => (
        <Line key={line.id} line={line} model={model} />
      ))}
    </ul>
  );
}
