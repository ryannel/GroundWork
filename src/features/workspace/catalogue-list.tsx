import Link from 'next/link';

import type { Catalogue, CatalogueRow } from '@/application/today-catalogue';
import type { SystemCatalogue } from '@/application/workspace-domain';
import { plural } from '@/shared/text';
import { SectionHeading } from '@/ui/section-heading';

import styles from './catalogue-list.module.css';
import { RefChip, RefChips } from './ref-chip';

interface BlockProps {
  readonly id: string;
  readonly title: string;
  /** What each item under a row is, in the singular. */
  readonly item: string;
  /** One line on how to read the rows; left out where the page has said it once. */
  readonly says: string | null;
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
      {says === null ? null : <p className={styles.says}>{says}</p>}
      <ul className={styles.rows}>
        {rows.map((row) => (
          <Row item={item} key={row.head.id} row={row} />
        ))}
      </ul>
    </section>
  );
}

interface CatalogueListProps {
  readonly catalogue: Catalogue;
  /** Put before each block's anchor, so several lists can share a page. */
  readonly idPrefix?: string;
  /** Leave out the line under each block, where the page has said how to read them. */
  readonly quiet?: boolean;
}

// What a domain or a system offers, announces and keeps, in short rows; every name opens in the inspector.
export function CatalogueList({ catalogue, idPrefix = '', quiet = false }: CatalogueListProps) {
  const { apis, events, data } = catalogue;
  if (apis.length + events.length + data.length === 0) {
    return <p className={styles.none}>Nothing here is called, announced or kept yet.</p>;
  }
  const says = (line: string): string | null => (quiet ? null : line);
  return (
    <div className={styles.blocks}>
      <Block
        id={`${idPrefix}calls`}
        item="call"
        rows={apis}
        says={says('Each component that answers calls. Open one for what it is called on.')}
        title="Calls it answers"
      />
      <Block
        id={`${idPrefix}events`}
        item="listener"
        rows={events}
        says={says('Each message announced here. Open one for who listens.')}
        title="Events it announces"
      />
      <Block
        id={`${idPrefix}stores`}
        item="record"
        rows={data}
        says={says('Each store kept here. Open one for the records in it.')}
        title="Data it keeps"
      />
    </div>
  );
}

const tally = ({ apis, events, data }: Catalogue): string =>
  [
    plural(
      apis.reduce((sum, row) => sum + row.items.length, 0),
      'call',
    ),
    plural(events.length, 'event'),
    plural(data.length, 'store'),
  ].join(' · ');

// A domain's interfaces, one system at a time: a system is what a reader looks for, and its components follow.
export function SystemCatalogues({ systems }: { readonly systems: readonly SystemCatalogue[] }) {
  if (systems.length === 0) {
    return <p className={styles.none}>Nothing here is called, announced or kept yet.</p>;
  }
  return (
    <div className={styles.systems}>
      {systems.map((system) => (
        <section className={styles.block} id={system.id} key={system.id}>
          <SectionHeading title={system.name}>
            <p>
              {tally(system.catalogue)} · <Link href={system.href}>Open {system.name} →</Link>
            </p>
          </SectionHeading>
          <CatalogueList catalogue={system.catalogue} idPrefix={`${system.id}-`} quiet />
        </section>
      ))}
    </div>
  );
}
