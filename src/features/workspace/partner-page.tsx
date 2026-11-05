import { Fragment, type ReactNode } from 'react';

import { shortDate } from '@/application/plan-viz-state';
import {
  datesWords,
  type EventVM,
  type MilestoneVM,
} from '@/application/workspace-work/milestones';
import type { EvidenceVM, PartnerPageVM } from '@/application/workspace-work/partner-page';
import { ageText } from '@/application/workspace-work/partners';
import { Badge } from '@/ui/badge';
import { List, ListItem } from '@/ui/list';
import { PageHeader } from '@/ui/page-header';
import { Cluster, Stack } from '@/ui/stack';
import { Text, TextLink } from '@/ui/text';

import { WorkSection } from './work-section';

interface PartnerPageProps {
  readonly page: PartnerPageVM;
  /** Each work item's card, by key (`<plan>/wi:x`), drawn by the route with its Record update. */
  readonly cards: ReadonlyMap<string, ReactNode>;
  /** The day dates and ages are read against. */
  readonly today: Date;
}

const isoDay = (day: Date): string => day.toISOString().slice(0, 10);

function heardText(page: PartnerPageVM, today: Date): string {
  const heard = page.lastHeard;
  if (heard === null) return 'Nothing heard yet';
  return [
    `Last heard ${shortDate(heard.at, today)} (${ageText(heard.at, isoDay(today))})`,
    heard.by,
    heard.source,
  ]
    .filter((part) => part !== null)
    .join(' · ');
}

function None({ children }: { readonly children: string }) {
  return (
    <Text as="p" tone="muted">
      {children}
    </Text>
  );
}

function MilestoneHead({
  milestone,
  today,
}: {
  readonly milestone: MilestoneVM | null;
  readonly today: Date;
}) {
  if (milestone === null) return <Text weight="strong">Not in a milestone</Text>;
  return (
    <Stack gap={1}>
      <Cluster spread>
        <TextLink href={milestone.href} tone="title">
          {milestone.name}
        </TextLink>
        {milestone.commitment === null ? null : <Badge>{milestone.commitment}</Badge>}
      </Cluster>
      <Text size="sm" tone={milestone.gapText === null ? 'muted' : 'accent'}>
        {datesWords(milestone, today)}
      </Text>
    </Stack>
  );
}

function EvidenceItem({ item, today }: { readonly item: EvidenceVM; readonly today: Date }) {
  return (
    <ListItem>
      <Stack gap={1}>
        <Cluster gap={2}>
          <Text mono size="sm" tone="faint">
            {shortDate(item.at, today)}
          </Text>
          <TextLink href={item.url}>{`${item.source}: ${item.about}`}</TextLink>
        </Cluster>
        {item.by === null && item.note === null ? null : (
          <Text size="sm" tone="muted">
            {[item.by, item.note].filter((part) => part !== null).join(' · ')}
          </Text>
        )}
      </Stack>
    </ListItem>
  );
}

function HistoryItem({ event, today }: { readonly event: EventVM; readonly today: Date }) {
  return (
    <ListItem>
      <Cluster gap={2}>
        <Text mono size="sm" tone="faint">
          {shortDate(event.at, today)}
        </Text>
        <TextLink href={event.href}>{event.subjectLabel}</TextLink>
        <Text size="sm">{event.what}</Text>
        <Text size="sm" tone="muted">
          {[event.by, event.source].filter((part) => part !== null).join(' · ')}
        </Text>
      </Cluster>
    </ListItem>
  );
}

// One partner: who to talk to and when we last heard, the milestones with their work still to come (what we need,
// what they promised, the gap, and each item's card with Record update), the evidence they gave and what happened.
export function PartnerPage({ page, cards, today }: PartnerPageProps) {
  return (
    <>
      <PageHeader
        description="A partner: we cannot read their code, so what we know of their work comes from what they tell us."
        meta={heardText(page, today)}
        title={page.team.name}
      />
      <WorkSection says="Who to talk to about their work." title="Contacts">
        {page.contacts.length === 0 ? (
          <None>No one is named yet: add contacts to the team in workspace.yaml.</None>
        ) : (
          <List>
            {page.contacts.map((c) => (
              <ListItem key={c.name}>
                <Cluster gap={2}>
                  <Text weight="strong">{c.name}</Text>
                  {c.role === null ? null : <Text tone="muted">{c.role}</Text>}
                </Cluster>
              </ListItem>
            ))}
          </List>
        )}
      </WorkSection>
      <WorkSection
        says="Their work still to come, by milestone, soonest needed first: what we need, what they promised, and the gap."
        title="Milestones"
      >
        {page.milestones.length === 0 ? (
          <None>None of their work is still to come.</None>
        ) : (
          page.milestones.map((group) => (
            <Stack gap={3} key={group.milestone?.key ?? 'none'}>
              <MilestoneHead milestone={group.milestone} today={today} />
              {group.items.map((card) => (
                <Fragment key={card.key}>{cards.get(card.key)}</Fragment>
              ))}
            </Stack>
          ))
        )}
      </WorkSection>
      <WorkSection says="What they gave us, newest first, with a link to it." title="Evidence">
        {page.evidence.length === 0 ? (
          <None>No evidence with a link yet.</None>
        ) : (
          <List>
            {page.evidence.map((item) => (
              <EvidenceItem
                item={item}
                key={`${item.at}\n${item.url}\n${item.about}`}
                today={today}
              />
            ))}
          </List>
        )}
      </WorkSection>
      <WorkSection says="Everything recorded about their work, newest first." title="History">
        {page.history.length === 0 ? (
          <None>Nothing recorded yet.</None>
        ) : (
          <List dense>
            {page.history.map((event, i) => (
              <HistoryItem
                event={event}
                key={`${event.plan}/${event.subject}/${String(i)}`}
                today={today}
              />
            ))}
          </List>
        )}
      </WorkSection>
    </>
  );
}
