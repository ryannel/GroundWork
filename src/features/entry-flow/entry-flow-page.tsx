import type { EntryFlowPage as PageData } from '@/application/entry-flow-page';
import { AppBar } from '@/ui/app-bar';
import { AppShell } from '@/ui/app-shell';
import { PageHeader } from '@/ui/page-header';
import { Panel } from '@/ui/panel';
import { Cluster, Stack } from '@/ui/stack';
import { Text, TextLink } from '@/ui/text';

import { EntryFlow } from './entry-flow.client';

function Entries({ entries, pagination }: Pick<PageData, 'entries' | 'pagination'>) {
  return (
    <Stack gap={4}>
      {pagination === null || pagination.pages === 1 ? null : (
        <Cluster label="Entry pages">
          <Text>
            {pagination.total} entries · Page {pagination.page} of {pagination.pages}
          </Text>
          {pagination.previous === null ? null : (
            <TextLink href={pagination.previous}>Previous page</TextLink>
          )}
          {pagination.next === null ? null : <TextLink href={pagination.next}>Next page</TextLink>}
        </Cluster>
      )}
      {entries.map((entry) => (
        <Panel key={entry.id}>
          <Stack>
            <TextLink href={entry.href}>{entry.title}</TextLink>
            <Text mono size="sm" tone="muted">
              {entry.kind} · {entry.id}
            </Text>
          </Stack>
        </Panel>
      ))}
      {entries.length === 0 ? <Text>No entry is recorded in this scope.</Text> : null}
    </Stack>
  );
}
export function EntryFlowPage({
  workspace,
  flow,
  entries,
  pagination,
  plans,
  comparison,
}: PageData) {
  return (
    <AppShell
      bar={<AppBar title="Entry flows" trail={[{ label: workspace.name, href: workspace.href }]} />}
      wide
    >
      <PageHeader
        description={workspace.description}
        title={flow?.title ?? 'Entry flows'}
        meta={flow === null ? null : `${flow.kind} · ${flow.component}`}
      />
      <Stack gap={4}>
        {flow === null ? (
          <Entries entries={entries} pagination={pagination} />
        ) : (
          <>
            <Cluster>
              <TextLink href={workspace.href}>All entries</TextLink>
              {plans.map((plan) => (
                <TextLink href={plan.href} key={plan.href}>
                  {plan.title}
                </TextLink>
              ))}
            </Cluster>
            {comparison === null ? null : (
              <Panel title={comparison.title}>
                <Cluster>
                  <TextLink href={comparison.before}>Before</TextLink>
                  <TextLink href={comparison.after}>After</TextLink>
                  <Text>
                    {comparison.version === 'after' ? 'After the plan' : 'Before the plan'}
                  </Text>
                </Cluster>
              </Panel>
            )}
            <EntryFlow flow={flow} key={`${flow.id}-${comparison?.version ?? 'today'}`} />
          </>
        )}
      </Stack>
    </AppShell>
  );
}
