import Link from 'next/link';

import type { DomainSystemCard } from '@/application/workspace-domain';
import { plural } from '@/shared/text';
import { Swatch } from '@/ui/swatch';

import styles from './domain-systems.module.css';

// Each system as a short card of the same height: its name in its team's colour, what it does, and how big it is.
// The repos are counted here and listed on the system's own page.
export function DomainSystems({ systems }: { readonly systems: readonly DomainSystemCard[] }) {
  return (
    <ul className={styles.cards}>
      {systems.map((system) => (
        <li key={system.id}>
          <Link className={styles.card} href={system.href}>
            <h3 className={styles.name}>{system.name}</h3>
            {system.does === '' ? null : <p className={styles.does}>{system.does}</p>}
            <p className={styles.about}>
              <span className={styles.team}>
                <Swatch slot={system.team?.slot ?? 0} />
                {system.team?.name ?? 'No team'}
              </span>
              <span>
                {plural(system.components, 'component')}
                {system.repos.length === 0 ? '' : ` · ${plural(system.repos.length, 'repo')}`}
              </span>
            </p>
          </Link>
        </li>
      ))}
    </ul>
  );
}
