import Link from 'next/link';

import type { Neighbour, Neighbours } from '@/application/today-neighbours';

import styles from './neighbour-list.module.css';

function Side({ title, list }: { readonly title: string; readonly list: readonly Neighbour[] }) {
  if (list.length === 0) return null;
  return (
    <div className={styles.side}>
      <h3 className={styles.title}>{title}</h3>
      <ul className={styles.list}>
        {list.map((n) => (
          <li key={n.id}>
            <Link href={n.href}>{n.name}</Link> <span className={styles.place}>{n.place}</span>{' '}
            <span className={styles.how}>{n.how}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// Where a domain or a system ends: the systems it leans on, and the ones that lean on it.
export function NeighbourList({
  neighbours,
  name,
}: {
  readonly neighbours: Neighbours;
  readonly name: string;
}) {
  if (neighbours.reaches.length === 0 && neighbours.reachedBy.length === 0) {
    return (
      <p className={styles.none}>
        {name} works on its own: nothing outside it calls, messages or shares data with it.
      </p>
    );
  }
  return (
    <div className={styles.sides}>
      <Side list={neighbours.reaches} title={`${name} reaches`} />
      <Side list={neighbours.reachedBy} title={`What reaches ${name}`} />
    </div>
  );
}
