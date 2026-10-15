import type { Model } from '@/application/plan/derive';
import {
  type GridCell,
  type GridStore,
  type GridSystem,
  type StoreGridMode,
  storeGridView,
} from '@/application/plan-viz-store-grid';
import { EntityChip } from '@/features/plan/common/entity-chip';
import { TeamDot } from '@/features/plan/common/team-dot';
import { ScrollCue } from '@/features/plan/viz/zoompane/scroll-cue.client';
import { Legend } from '@/ui/legend';

import styles from './store-grid.module.css';

export interface StoreGridProps {
  readonly model: Model;
  /** Today's by default; `diff` shows the plan's, marking what it adds. */
  readonly mode?: StoreGridMode;
  /** A team id: the rows of other teams dim. */
  readonly lens?: string | null;
  /** Systems that touch no store are named in a footnote, not given an empty row. */
  readonly compact?: boolean;
  /** Ids to mark. */
  readonly highlight?: readonly string[];
}

const KEY = [
  { glyph: 'R', label: 'reads' },
  { glyph: 'W', label: 'writes' },
  { glyph: 'RW', label: 'reads and writes' },
  { glyph: '⛁', label: 'database' },
  { glyph: '◍', label: 'cache' },
] as const;

function Head({ store, marked }: { readonly store: GridStore; readonly marked: boolean }) {
  const owner = store.owner === null ? '' : ` · owned by ${store.owner}`;
  return (
    <th
      className={styles.store}
      data-mark={marked ? '' : undefined}
      data-status={store.status === 'existing' ? undefined : store.status}
      scope="col"
    >
      <button
        className={styles.head}
        data-inspect={store.id}
        title={`${store.word} · ${store.tech}${owner}`}
        type="button"
      >
        <span className={styles.type}>
          <span aria-hidden="true">{store.glyph}</span> {store.word}
        </span>
        <span className={styles.name}>{store.label}</span>
        {store.short === '' ? null : <span className={styles.tech}>{store.short}</span>}
      </button>
    </th>
  );
}

function Cell({ cell }: { readonly cell: GridCell | null }) {
  if (cell === null) {
    return (
      <td className={styles.empty}>
        <span className={styles.srOnly}>no access</span>
      </td>
    );
  }
  return (
    <td>
      <button
        aria-label={cell.what}
        className={styles.cell}
        data-access={cell.access}
        data-inspect={cell.store}
        data-owner={cell.owner ? '' : undefined}
        data-status={cell.added ? 'added' : undefined}
        title={cell.what}
        type="button"
      >
        {cell.access}
        {cell.owner ? (
          <span aria-hidden="true" className={styles.own}>
            owner
          </span>
        ) : null}
      </button>
    </td>
  );
}

function Row({
  model,
  system,
  dim,
  marked,
}: {
  readonly model: Model;
  readonly system: GridSystem;
  readonly dim: boolean;
  readonly marked: boolean;
}) {
  return (
    <tr data-dim={dim ? '' : undefined} data-mark={marked ? '' : undefined}>
      <th className={styles.system} scope="row">
        {system.team === null ? null : <TeamDot model={model} teamId={system.team} />}
        <EntityChip id={system.id} model={model} />
      </th>
      {system.cells.map((cell, i) => (
        <Cell cell={cell} key={cell?.store ?? `none-${String(i)}`} />
      ))}
    </tr>
  );
}

/** Which systems read and write which stores: a system per row, a store per column. */
export function StoreGrid({
  model,
  mode = 'asIs',
  lens = null,
  compact = false,
  highlight = [],
}: StoreGridProps) {
  const view = storeGridView(model, { mode, compact });
  if (view === null) return <p className={styles.none}>No databases or caches in this plan.</p>;
  const marks = new Set(highlight);
  return (
    <div className={styles.grid} data-compact={compact ? '' : undefined}>
      <ScrollCue note>
        <table className={styles.table}>
          <caption className={styles.srOnly}>Which systems read and write which stores</caption>
          <thead>
            <tr>
              <th className={styles.corner} scope="col">
                system ↓ · store →
              </th>
              {view.stores.map((store) => (
                <Head key={store.id} marked={marks.has(store.id)} store={store} />
              ))}
            </tr>
          </thead>
          <tbody>
            {view.systems.map((system) => (
              <Row
                dim={lens !== null && system.team !== lens}
                key={system.id}
                marked={marks.has(system.id)}
                model={model}
                system={system}
              />
            ))}
          </tbody>
        </table>
      </ScrollCue>
      {view.idle.length === 0 ? null : (
        <p className={styles.idle}>
          {view.idle.length === 1
            ? 'One system touches'
            : `${String(view.idle.length)} systems touch`}{' '}
          no store here:{' '}
          {view.idle.map((system, i) => (
            <span key={system.id}>
              {i === 0 ? '' : ', '}
              <EntityChip id={system.id} model={model} />
            </span>
          ))}
        </p>
      )}
      <Legend items={KEY} />
    </div>
  );
}
