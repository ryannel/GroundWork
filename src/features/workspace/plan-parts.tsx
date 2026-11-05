import type { PlanPart } from '@/application/plan-footprint';
import {
  impactHeading,
  type ImpactRowVM,
  type ImpactRows,
} from '@/application/workspace-work/impact';
import { Callout } from '@/ui/callout';
import { Card } from '@/ui/card';
import { List, ListItem } from '@/ui/list';
import { Stack } from '@/ui/stack';
import { Text, TextLink } from '@/ui/text';

import styles from './plan-parts.module.css';

const NO_IMPACT: ImpactRows = [];

const progress = (part: PlanPart): string =>
  part.workItems === 0
    ? 'Changes here, no work items yet'
    : `${String(part.done)} of ${String(part.workItems)} work items done`;

// One line a row, as a system can have many plans' work pending: its title, who owns it, how it stands, its plan.
function ImpactRow({ row }: { readonly row: ImpactRowVM }) {
  return (
    <ListItem>
      <TextLink href={row.href} tone="title">
        {row.title}
      </TextLink>{' '}
      <Text size="sm" tone="muted">
        {`${row.owner} · ${row.state} · in `}
        <TextLink href={row.plan.href}>{row.plan.title}</TextLink>
      </Text>
      {row.reason === null ? null : (
        <Text as="p" size="sm" tone="accent">
          {row.reason}
        </Text>
      )}
    </ListItem>
  );
}

/** The work still to do here across every plan, in the order it can happen: now, next, then, and blocked. */
function Pending({ impact }: { readonly impact: ImpactRows }) {
  return (
    <Stack gap={4} label="Pending work">
      {impact.map((group) => (
        <Stack gap={2} key={group.state}>
          <Text caps size="sm" tone="muted" weight="strong">
            {impactHeading(group.state)}
          </Text>
          <List>
            {group.rows.map((row) => (
              <ImpactRow key={row.key} row={row} />
            ))}
          </List>
        </Stack>
      ))}
    </Stack>
  );
}

// The plans that would change a domain or a system, with how far their work here has got; on a system, the work
// still to do here across them comes first.
export function PlanParts({
  parts,
  name,
  impact = NO_IMPACT,
}: {
  readonly parts: readonly PlanPart[];
  /** What the plans would change, named in the call to make the first one. */
  readonly name: string;
  /** The work across plans still to do here, grouped now, next, then and blocked. */
  readonly impact?: ImpactRows;
}) {
  if (parts.length === 0 && impact.length === 0) {
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
    <Stack gap={4}>
      {impact.length === 0 ? null : <Pending impact={impact} />}
      {parts.length === 0 ? null : (
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
      )}
    </Stack>
  );
}
