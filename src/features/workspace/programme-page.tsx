import { shortDate } from '@/application/plan-viz-state';
import { ownerWords } from '@/application/workspace-work/impact';
import { datesWords } from '@/application/workspace-work/milestones';
import {
  HEALTH_WORDS,
  type LandingVM,
  planStandingWords,
  type PartnerDependencyVM,
  type PlanStandingVM,
  type ProgrammeItemVM,
  type ProgrammeMilestoneVM,
  type ProgrammePageVM,
} from '@/application/workspace-work/programme-page';
import { plural } from '@/shared/text';
import { Badge, type BadgeTone } from '@/ui/badge';
import { List, ListItem } from '@/ui/list';
import { PageHeader } from '@/ui/page-header';
import { Cluster, Stack } from '@/ui/stack';
import { Text, TextLink } from '@/ui/text';

import { WorkSection } from './work-section';

interface ProgrammePageProps {
  readonly page: ProgrammePageVM;
  readonly landing: readonly LandingVM[];
  /** The day dates are read against: a date this year leaves its year out. */
  readonly today?: Date | undefined;
}

const toneOf = (plan: PlanStandingVM): BadgeTone => {
  if (plan.landed) return 'added';
  if (plan.blocked || plan.health === 'conflict') return 'removed';
  return plan.stale || plan.health !== 'ready' ? 'modified' : 'neutral';
};

function None({ children }: { readonly children: string }) {
  return (
    <Text as="p" tone="muted">
      {children}
    </Text>
  );
}

function PlanItem({ plan, place }: { readonly plan: PlanStandingVM; readonly place: number }) {
  const { work } = plan;
  return (
    <ListItem>
      <Stack gap={1}>
        <Cluster spread>
          <TextLink href={plan.href} tone="title">
            {`${String(place)}. ${plan.title}`}
          </TextLink>
          <Badge tone={toneOf(plan)}>{planStandingWords(plan)}</Badge>
        </Cluster>
        <Text size="sm" tone="muted">
          {plan.buildsOn.length === 0 ? 'Builds on today' : 'Builds on '}
          {plan.buildsOn.map((base, i) => (
            <span key={base.slug}>
              {i === 0 ? null : ', '}
              <TextLink href={base.href}>{base.title}</TextLink>
              {` (${HEALTH_WORDS[base.health]})`}
            </span>
          ))}
        </Text>
        <Text size="sm" tone="faint">
          {work.total === 0
            ? 'No work items yet'
            : `${String(work.done)} of ${plural(work.total, 'work item')} done`}
        </Text>
      </Stack>
    </ListItem>
  );
}

function MilestoneItem({
  milestone,
  today,
}: {
  readonly milestone: ProgrammeMilestoneVM;
  readonly today: Date | undefined;
}) {
  return (
    <ListItem id={milestone.id}>
      <Stack gap={1}>
        <Cluster spread>
          <Text weight="strong">{milestone.name}</Text>
          {milestone.commitment === null ? null : <Badge>{milestone.commitment}</Badge>}
        </Cluster>
        <Text size="sm" tone={milestone.gapText === null ? 'muted' : 'accent'}>
          {datesWords(milestone, today)}
        </Text>
        <Text size="sm" tone="muted">
          {milestone.servedBy.length === 0 ? 'No plan milestone serves it yet' : 'Served by '}
          {milestone.servedBy.map((s, i) => (
            <span key={`${s.slug}/${s.milestone}`}>
              {i === 0 ? null : ', '}
              {s.name} in <TextLink href={s.href}>{s.title}</TextLink>
            </span>
          ))}
        </Text>
      </Stack>
    </ListItem>
  );
}

function Items({
  items,
  none,
  today,
}: {
  readonly items: readonly ProgrammeItemVM[];
  readonly none: string;
  readonly today: Date | undefined;
}) {
  if (items.length === 0) return <None>{none}</None>;
  return (
    <List>
      {items.map((item) => (
        <ListItem id={item.id} key={item.id}>
          <Cluster spread>
            <Text>{item.text}</Text>
            <Cluster gap={2}>
              {item.decideBy === null ? null : (
                <Text size="sm" tone="faint">
                  {`by ${shortDate(item.decideBy, today)}`}
                </Text>
              )}
              <Badge tone={item.open ? 'modified' : 'neutral'}>{item.status}</Badge>
            </Cluster>
          </Cluster>
        </ListItem>
      ))}
    </List>
  );
}

function Dependency({
  dependency,
  today,
}: {
  readonly dependency: PartnerDependencyVM;
  readonly today: Date | undefined;
}) {
  const { item } = dependency;
  return (
    <ListItem>
      <Stack gap={1}>
        <TextLink href={item.href} tone="title">
          {item.title}
        </TextLink>
        <Text size="sm" tone="muted">
          {[ownerWords(item.team), item.milestone?.label ?? null]
            .filter((part) => part !== null)
            .join(' · ')}
        </Text>
        <Text size="sm" tone={dependency.gapText === null ? 'muted' : 'accent'}>
          {datesWords({ ...item.dates, gapText: dependency.gapText }, today)}
        </Text>
        <Text size="sm">
          Holds up first:{' '}
          <TextLink href={dependency.blocksFirst.href}>{dependency.blocksFirst.title}</TextLink>
        </Text>
      </Stack>
    </ListItem>
  );
}

// One programme: its outcome and where it stands first, then its plans in the order they land, its milestones, the
// decisions and questions its plans share, where it lands, and the partner work it depends on.
export function ProgrammePage({ page, landing, today }: ProgrammePageProps) {
  const { programme, standing } = page;
  return (
    <>
      <PageHeader description={programme.outcome} meta={standing.text} title={programme.title} />
      <WorkSection
        says="In the order they land: each reads the systems after the plans it builds on."
        title="Plans"
      >
        {page.plans.length === 0 ? (
          <None>No plan has joined it yet.</None>
        ) : (
          <List>
            {page.plans.map((plan, i) => (
              <PlanItem key={plan.slug} place={i + 1} plan={plan} />
            ))}
          </List>
        )}
      </WorkSection>
      <WorkSection
        says="What is true at each step, with the plan milestones that get it there."
        title="Milestones"
      >
        {page.milestones.length === 0 ? (
          <None>It names no milestones.</None>
        ) : (
          <List>
            {page.milestones.map((m) => (
              <MilestoneItem key={m.key} milestone={m} today={today} />
            ))}
          </List>
        )}
      </WorkSection>
      <WorkSection says="Settled once for every plan in it." title="Decisions">
        <Items items={page.decisions} none="It records no decisions." today={today} />
      </WorkSection>
      <WorkSection says="Still to answer, for every plan in it." title="Questions">
        <Items items={page.questions} none="It records no questions." today={today} />
      </WorkSection>
      <WorkSection
        says="The domains its plans change, and how many of them do."
        title="Where it lands"
      >
        {landing.length === 0 ? (
          <None>Its plans change no domain yet.</None>
        ) : (
          <Cluster gap={3}>
            {landing.map((d) => (
              <Text key={d.id} size="sm">
                <TextLink href={d.href}>{d.name}</TextLink> {`(${plural(d.plans, 'plan')})`}
              </Text>
            ))}
          </Cluster>
        )}
      </WorkSection>
      <WorkSection
        says="Work partners owe us, latest against our need first, with the first plan it holds up."
        title="Partner dependencies"
      >
        {page.partnerDependencies.length === 0 ? (
          <None>No partner work is still to come.</None>
        ) : (
          <List>
            {page.partnerDependencies.map((d) => (
              <Dependency dependency={d} key={d.item.key} today={today} />
            ))}
          </List>
        )}
      </WorkSection>
    </>
  );
}
