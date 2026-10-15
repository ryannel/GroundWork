import type { ReactNode } from 'react';

import styles from './data-table.module.css';

interface Column {
  readonly key: string;
  readonly label: string;
}

interface Row {
  readonly key: string;
  readonly cells: Readonly<Record<string, ReactNode>>;
  /** Words a filter matches the row on. */
  readonly search?: string;
}

interface DataTableProps {
  readonly caption: string;
  readonly columns: readonly Column[];
  readonly rows: readonly Row[];
}

// Folds to labelled rows when its own container is narrow; data-label carries the column name.
export function DataTable({ caption, columns, rows }: DataTableProps) {
  return (
    <div className={styles.frame}>
      <table className={styles.table}>
        <caption className={styles.caption}>{caption}</caption>
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column.key} scope="col">
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr data-search={row.search} key={row.key}>
              {columns.map((column) => (
                <td data-label={column.label} key={column.key}>
                  {row.cells[column.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
