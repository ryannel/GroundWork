import Link from 'next/link';

import type { WorkspaceCard } from '@/application/workspace-library';
import { Badge } from '@/ui/badge';
import { Facts } from '@/ui/facts';

import { PlanList } from './plan-list';
import styles from './workspace-panel.module.css';

interface WorkspacePanelProps {
  readonly card: WorkspaceCard;
}

// One workspace: what it is, its domains to step straight into, and its plans by what they wait on.
export function WorkspacePanel({ card }: WorkspacePanelProps) {
  return (
    <article aria-labelledby={`ws-${card.id}`} className={styles.panel}>
      <header className={styles.head}>
        <div className={styles.identity}>
          <h2 className={styles.name} id={`ws-${card.id}`}>
            <Link href={card.href}>{card.name}</Link>
          </h2>
          {card.isPrivate ? <Badge>Private</Badge> : null}
        </div>
        {card.description === null ? null : (
          <p className={styles.description}>{card.description}</p>
        )}
        <div className={styles.size}>
          <Facts items={card.facts} />
        </div>
      </header>
      <div className={styles.body}>
        <section className={styles.domains}>
          <h3 className={styles.label}>Domains</h3>
          <ul className={styles.domainList}>
            {card.domains.map((domain) => (
              <li key={domain.id}>
                <Link className={styles.domain} href={domain.href}>
                  <span>{domain.name}</span>
                  <span className={styles.count}>{domain.systems}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
        <section className={styles.plans}>
          <h3 className={styles.label}>Plans</h3>
          {card.plans.length === 0 ? (
            <p className={styles.empty}>
              No plans yet. Each plan is a folder under <code>plans/</code> in the workspace.
            </p>
          ) : (
            <PlanList plans={card.plans} />
          )}
          {card.morePlans === 0 ? null : (
            <Link className={styles.more} href={card.href}>
              {card.morePlans} more {card.morePlans === 1 ? 'plan' : 'plans'} →
            </Link>
          )}
        </section>
      </div>
      <footer className={styles.foot}>
        <Link className={styles.open} href={card.href}>
          Open {card.name} →
        </Link>
      </footer>
    </article>
  );
}
