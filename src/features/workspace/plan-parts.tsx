import type { PlanPart } from '@/application/plan-footprint';
import { Card } from '@/ui/card';

import styles from './plan-parts.module.css';

const progress = (part: PlanPart): string =>
  part.workItems === 0
    ? 'Changes here, no work items yet'
    : `${String(part.done)} of ${String(part.workItems)} work items done`;

// The plans that would change a domain or a system, with how far their work here has got.
export function PlanParts({
  parts,
  where,
}: {
  readonly parts: readonly PlanPart[];
  readonly where: string;
}) {
  if (parts.length === 0) return <p className={styles.none}>No plan changes {where} yet.</p>;
  return (
    <ul className={styles.cards}>
      {parts.map((part) => (
        <li key={part.id}>
          <Card href={part.href} title={part.title}>
            {part.workItems === 0 ? null : (
              <progress
                aria-label={`${part.title}: work done here`}
                className={styles.bar}
                max={part.workItems}
                value={part.done}
              />
            )}
            <p className={styles.progress}>{progress(part)}</p>
          </Card>
        </li>
      ))}
    </ul>
  );
}
