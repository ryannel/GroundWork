import Link from 'next/link';
import type { ReactNode } from 'react';

import { modelGapSummary } from '@/application/model-gap-summary';
import type { ModelSystemView } from '@/application/model-system';
import type { ModelSystemPlans as Plans } from '@/application/model-system-plans';
import { Callout } from '@/ui/callout';
import { List, ListItem } from '@/ui/list';
import { Stack } from '@/ui/stack';
import { Text } from '@/ui/text';

import { ModelSystemNarratives } from './model-system-narratives.client';

/** Native additions to the shared system page retain visible uncertainty and every declared entry. */
export function ModelSystemOverview({
  view,
  children,
}: {
  readonly view: ModelSystemView;
  readonly children?: ReactNode;
}) {
  const gaps = modelGapSummary(view.gaps);
  return (
    <Stack gap={3}>
      {children}
      {view.entries.length === 0 ? null : (
        <Stack gap={2}>
          <Text as="h3" size="lg" weight="strong">
            Recorded entries
          </Text>
          <List>
            {view.entries.slice(0, 30).map((entry) => (
              <ListItem key={entry.id}>
                <Link href={entry.href}>{entry.name}</Link> <Text tone="muted">{entry.kind}</Text>
              </ListItem>
            ))}
          </List>
          {view.entries.length <= 30 ? null : (
            <Link href={view.allEntriesHref}>All {view.entries.length} recorded entries →</Link>
          )}
        </Stack>
      )}
      {view.gaps.length === 0 ? null : (
        <Callout title="What remains unknown">
          <ul>
            {gaps.map((gap, at) => (
              <li key={`${gap.kind}:${String(at)}`}>
                {gap.message}
                {gap.count === 1 ? null : ` (${String(gap.count)} occurrences)`}
              </li>
            ))}
          </ul>
        </Callout>
      )}
      <ModelSystemNarratives narratives={view.narratives} labels={view.narrativeLabels} />
    </Stack>
  );
}
/** Plan links use exact footprints; missing progress is reported rather than turned into zero completion. */
export function ModelSystemPlans({ plans }: { readonly plans: Plans }) {
  return (
    <Stack gap={3}>
      {plans.items.length === 0 ? (
        <Callout title="No plan has a recorded location here">
          Plans with unknown locations remain listed on the workspace&apos;s Plans page.
        </Callout>
      ) : (
        <List>
          {plans.items.map((plan) => (
            <ListItem key={plan.id}>
              <Stack gap={1}>
                <Link href={plan.href}>{plan.title}</Link>
                <Text tone="muted">{plan.progress}</Text>
              </Stack>
            </ListItem>
          ))}
        </List>
      )}
      {plans.gaps.length === 0 ? null : (
        <Callout title="Plan locations still unknown">
          <ul>
            {plans.gaps.map((gap, at) => (
              <li key={`${gap.id}:${gap.kind}:${String(at)}`}>{gap.message}</li>
            ))}
          </ul>
        </Callout>
      )}
    </Stack>
  );
}
