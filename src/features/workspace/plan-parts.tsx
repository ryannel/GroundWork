import type { PlanPart } from '@/application/plan-footprint';
import { Callout } from '@/ui/callout';
import { Card } from '@/ui/card';

import styles from './plan-parts.module.css';

const progress = (part: PlanPart): string =>
  part.workItems === 0
    ? 'Changes here, no work items yet'
    : `${String(part.done)} of ${String(part.workItems)} work items done`;

// The plans that would change a domain or a system, with how far their work here has got.
export function PlanParts({
  parts,
  name,
}: {
  readonly parts: readonly PlanPart[];
  /** What the plans would change, named in the call to make the first one. */
  readonly name: string;
}) {
  if (parts.length === 0) {
    return (
      <Callout title={`No plan changes ${name} yet`}>
        <p>
          To make the first, ask your agent: <q>Use groundwork-plan to plan a change to {name}.</q>{' '}
          It reads the map and the code, asks what you want, and writes the plan into the workspace.
        </p>
      </Callout>
    );
  }
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
