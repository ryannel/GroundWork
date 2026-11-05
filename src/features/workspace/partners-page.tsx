import { shortDate } from '@/application/plan-viz-state';
import type { PartnerRowVM } from '@/application/workspace-work/partners';
import { plural } from '@/shared/text';
import { Callout } from '@/ui/callout';
import { List, ListItem } from '@/ui/list';
import { PageHeader } from '@/ui/page-header';
import { Stack } from '@/ui/stack';
import { Text, TextLink } from '@/ui/text';

interface PartnersPageProps {
  readonly rows: readonly PartnerRowVM[];
  /** The day dates are read against: a date this year leaves its year out. */
  readonly today?: Date | undefined;
}

function workText(row: PartnerRowVM): string {
  const { work } = row;
  if (work.total === 0) return 'No work in any plan';
  return [
    `${plural(work.total, 'work item')} in ${plural(work.plans, 'plan')}`,
    `${String(work.open)} still to do`,
    work.blocked === 0 ? null : `${String(work.blocked)} held up`,
  ]
    .filter((part) => part !== null)
    .join(' · ');
}

function Systems({ row }: { readonly row: PartnerRowVM }) {
  if (row.systems.length === 0) {
    return (
      <Text size="sm" tone="faint">
        No system of theirs is in the map yet
      </Text>
    );
  }
  return (
    <Text size="sm">
      {'Owns '}
      {row.systems.map((s, i) => (
        <span key={s.id}>
          {i === 0 ? null : ', '}
          <TextLink href={s.href}>{s.name}</TextLink>
        </span>
      ))}
    </Text>
  );
}

// The partners: teams outside the company whose code we cannot read, with the work our plans need from them.
export function PartnersPage({ rows, today }: PartnersPageProps) {
  return (
    <>
      <PageHeader
        description="Teams outside the company whose code we cannot read. What we know of their work comes from what they tell us."
        meta={plural(rows.length, 'partner')}
        title="Partners"
      />
      {rows.length === 0 ? (
        <Callout title="No partners yet">
          <p>
            Mark a team in workspace.yaml with <code>partner: true</code>, and name who to talk to
            under <code>contacts</code>.
          </p>
        </Callout>
      ) : (
        <List>
          {rows.map((row) => (
            <ListItem key={row.id}>
              <Stack gap={1}>
                <TextLink href={row.href} tone="title">
                  {row.name}
                </TextLink>
                <Systems row={row} />
                <Text size="sm" tone="muted">
                  {workText(row)}
                </Text>
                <Text size="sm" tone="faint">
                  {row.lastHeard === null
                    ? 'Nothing heard yet'
                    : `Last heard ${shortDate(row.lastHeard.at, today)} · ${row.lastHeard.age}`}
                </Text>
              </Stack>
            </ListItem>
          ))}
        </List>
      )}
    </>
  );
}
