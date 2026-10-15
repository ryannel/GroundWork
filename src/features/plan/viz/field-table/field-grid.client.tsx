'use client';

import { useState, type ReactNode } from 'react';

import styles from './field-grid.module.css';

export interface GridRow {
  readonly key: string;
  /** Which run of folded rows it belongs to, from 1; 0 when it never folds. */
  readonly fold: number;
  readonly status: string;
  /** What the filter box looks through. */
  readonly search: string;
  /** The gutter and field cells. */
  readonly before: ReactNode;
  readonly typeText: string;
  /** The type before this plan changed it. */
  readonly typeWas: string | null;
  /** The fields of the type this one holds, opened by clicking it. */
  readonly nested: ReactNode;
  readonly nestedName: string | null;
  /** The cells after the type. */
  readonly after: ReactNode;
}

interface FieldGridProps {
  /** The header row's cells. */
  readonly head: ReactNode;
  readonly rows: readonly GridRow[];
  /** One per run of folded rows, the first run first. */
  readonly foldLabels: readonly string[];
  readonly columns: number;
  readonly filter: boolean;
}

function Caret({ open }: { readonly open: boolean }) {
  return (
    <span aria-hidden="true" className={styles.caret}>
      {open ? '▾' : '▸'}
    </span>
  );
}

function TypeCell({
  row,
  open,
  toggle,
}: {
  readonly row: GridRow;
  readonly open: boolean;
  readonly toggle: () => void;
}) {
  const now = row.typeWas === null ? row.typeText : <ins>{row.typeText}</ins>;
  return (
    <td className={styles.type}>
      {row.typeWas === null ? null : <del>{row.typeWas}</del>}
      {row.nestedName === null ? (
        now
      ) : (
        <button
          aria-expanded={open}
          className={styles.nest}
          onClick={toggle}
          title={`show the fields of ${row.nestedName}`}
          type="button"
        >
          <Caret open={open} />
          <ins>{row.typeText}</ins>
        </button>
      )}
    </td>
  );
}

const toggled = <T,>(set: ReadonlySet<T>, item: T): Set<T> => {
  const next = new Set(set);
  if (!next.delete(item)) next.add(item);
  return next;
};

/** The field table: unfold a run of unchanged rows, open a nested type, filter. The rows arrive drawn. */
export function FieldGrid({ head, rows, foldLabels, columns, filter }: FieldGridProps) {
  const [unfolded, setUnfolded] = useState<ReadonlySet<number>>(new Set());
  const [opened, setOpened] = useState<ReadonlySet<string>>(new Set());
  const [query, setQuery] = useState('');
  const q = query.trim().toLowerCase();
  const sizes = new Map<number, number>();
  for (const r of rows) if (r.fold > 0) sizes.set(r.fold, (sizes.get(r.fold) ?? 0) + 1);
  return (
    <>
      {filter ? (
        <label className={styles.filter}>
          <span aria-hidden="true">⌕</span>
          <input
            aria-label="Filter fields"
            onChange={(e) => {
              setQuery(e.target.value);
            }}
            placeholder="Filter fields"
            type="search"
            value={query}
          />
        </label>
      ) : null}
      <div className={styles.scroll}>
        <table className={styles.table}>
          <thead>
            <tr>{head}</tr>
          </thead>
          <tbody>
            {rows.map((row, i) => {
              const folded = row.fold > 0 && !unfolded.has(row.fold);
              const first = row.fold > 0 && rows[i - 1]?.fold !== row.fold;
              const searching = q !== '';
              if (searching ? !row.search.includes(q) : folded && !first) return null;
              const open = opened.has(row.key);
              return (
                <FoldedRow
                  columns={columns}
                  first={!searching && first}
                  folded={!searching && folded}
                  foldLabel={foldLabels[row.fold - 1] ?? ''}
                  key={row.key}
                  onFold={() => {
                    setUnfolded(toggled(unfolded, row.fold));
                  }}
                  onNest={() => {
                    setOpened(toggled(opened, row.key));
                  }}
                  open={open}
                  row={row}
                  unfolded={unfolded.has(row.fold)}
                />
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}

interface FoldedRowProps {
  readonly row: GridRow;
  readonly columns: number;
  readonly first: boolean;
  readonly folded: boolean;
  readonly unfolded: boolean;
  readonly foldLabel: string;
  readonly open: boolean;
  readonly onFold: () => void;
  readonly onNest: () => void;
}

function FoldedRow({
  row,
  columns,
  first,
  folded,
  unfolded,
  foldLabel,
  open,
  onFold,
  onNest,
}: FoldedRowProps) {
  const fold = first ? (
    <tr className={styles.foldRow}>
      <td colSpan={columns}>
        <button aria-expanded={unfolded} className={styles.more} onClick={onFold} type="button">
          <Caret open={unfolded} />
          {foldLabel}
        </button>
      </td>
    </tr>
  ) : null;
  return (
    <>
      {fold}
      {folded ? null : (
        <>
          <tr data-fold={row.fold > 0 ? row.fold : undefined} data-status={row.status}>
            {row.before}
            <TypeCell open={open} row={row} toggle={onNest} />
            {row.after}
          </tr>
          {open ? (
            <tr className={styles.nested}>
              <td colSpan={columns}>{row.nested}</td>
            </tr>
          ) : null}
        </>
      )}
    </>
  );
}
