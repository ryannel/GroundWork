import type { Catalogue, CatalogueRow } from '@/application/today-catalogue';
import { plural } from '@/shared/text';

import styles from './catalogue-list.module.css';
import { RefChip, RefChips } from './ref-chip';

interface BlockProps {
  readonly id: string;
  readonly title: string;
  /** What each item under a row is, in the singular. */
  readonly item: string;
  /** One line on how to read the rows. */
  readonly says: string;
  readonly rows: readonly CatalogueRow[];
}

// A row folds to its name, its note and how many things sit under it, so a long catalogue reads as an index.
function Row({ row, item }: { readonly row: CatalogueRow; readonly item: string }) {
  const head = (
    <>
      <span className={styles.head}>
        <RefChip chip={row.head} />
      </span>
      <span className={styles.note}>{row.note}</span>
    </>
  );
  if (row.items.length === 0) return <li className={styles.row}>{head}</li>;
  return (
    <li>
      <details className={styles.fold}>
        <summary className={styles.row}>
          {head}
          <span className={styles.count}>{plural(row.items.length, item)}</span>
        </summary>
        <div className={styles.items}>
          <RefChips chips={row.items} />
        </div>
      </details>
    </li>
  );
}

function Block({ id, title, item, says, rows }: BlockProps) {
  if (rows.length === 0) return null;
  return (
    <section className={styles.block} id={id}>
      <h3 className={styles.title}>
        {title} <span className={styles.total}>{String(rows.length)}</span>
      </h3>
      <p className={styles.says}>{says}</p>
      <ul className={styles.rows}>
        {rows.map((row) => (
          <Row item={item} key={row.head.id} row={row} />
        ))}
      </ul>
    </section>
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
        id="calls"
        item="call"
        rows={apis}
        says="Each component that answers calls. Open one for what it is called on."
        title="Calls it answers"
      />
      <Block
        id="events"
        item="listener"
        rows={events}
        says="Each message announced here. Open one for who listens."
        title="Events it announces"
      />
      <Block
        id="stores"
        item="record"
        rows={data}
        says="Each store kept here. Open one for the records in it."
        title="Data it keeps"
      />
    </div>
  );
}
