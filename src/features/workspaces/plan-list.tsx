import Link from 'next/link';

import { GROUP_NAMES, type PlanBrief, type PlanGroup } from '@/application/workspace-library-plans';

import styles from './plan-list.module.css';

interface PlanListProps {
  /** Already in the order to read them. */
  readonly plans: readonly PlanBrief[];
}

function grouped(plans: readonly PlanBrief[]): [PlanGroup, PlanBrief[]][] {
  const groups = new Map<PlanGroup, PlanBrief[]>();
  for (const plan of plans) groups.set(plan.group, [...(groups.get(plan.group) ?? []), plan]);
  return [...groups];
}

// Plans under what they wait on; one in delivery shows how much of its work is done.
export function PlanList({ plans }: PlanListProps) {
  return (
    <div className={styles.groups}>
      {grouped(plans).map(([group, members]) => (
        <section className={styles.group} data-group={group} key={group}>
          <h4 className={styles.groupName}>{GROUP_NAMES[group]}</h4>
          <ul className={styles.plans}>
            {members.map((plan) => (
              <li key={plan.id}>
                <Link className={styles.plan} href={plan.href}>
                  <span className={styles.title}>{plan.title}</span>
                  <span className={styles.note} data-late={plan.late}>
                    {plan.note}
                  </span>
                  {group === 'delivery' && plan.total > 0 ? (
                    <span aria-hidden="true" className={styles.bar}>
                      {Array.from({ length: plan.total }, (_, index) => (
                        <span data-done={index < plan.done} key={index} />
                      ))}
                    </span>
                  ) : null}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
