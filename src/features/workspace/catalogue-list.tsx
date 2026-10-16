import type { Catalogue, CatalogueRow } from '@/application/today-catalogue';

import styles from './catalogue-list.module.css';
import { RefChip, RefChips } from './ref-chip';

interface BlockProps {
  readonly title: string;
  /** One line on how to read the rows. */
  readonly says: string;
  readonly rows: readonly CatalogueRow[];
}

function Block({ title, says, rows }: BlockProps) {
  if (rows.length === 0) return null;
  return (
    <div className={styles.block}>
      <h3 className={styles.title}>{title}</h3>
      <p className={styles.says}>{says}</p>
      <ul className={styles.rows}>
        {rows.map((row) => (
          <li className={styles.row} key={row.head.id}>
            <span className={styles.head}>
              <RefChip chip={row.head} />
            </span>
            <span className={styles.body}>
              {row.note === '' ? null : <span className={styles.note}>{row.note}</span>}
              <RefChips chips={row.items} />
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// What a domain offers, announces and keeps, in short rows; every name opens in the inspector.
export function CatalogueList({ catalogue }: { readonly catalogue: Catalogue }) {
  const { apis, events, data } = catalogue;
  if (apis.length + events.length + data.length === 0) {
    return <p className={styles.none}>Nothing here is called, announced or kept yet.</p>;
  }
  return (
    <div className={styles.blocks}>
      <Block
        rows={apis}
        says="Each component that answers calls, with what it is called on."
        title="Calls it answers"
      />
      <Block
        rows={events}
        says="Each message announced here, and who listens to it."
        title="Events it announces"
      />
      <Block
        rows={data}
        says="Each store kept here, with the records in it."
        title="Data it keeps"
      />
    </div>
  );
}
