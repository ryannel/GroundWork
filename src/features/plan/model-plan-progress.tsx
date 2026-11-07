import {
  modelProgressRecords,
  type ModelPlanProgress,
  type ModelProgressRecord,
} from '@/application/model-progress';
import { workOrderOf } from '@/application/work-order';
import { issueUrlOf } from '@/domain/code-links';
import type { ModelPlan } from '@/domain/workspace-model';
import { Badge } from '@/ui/badge';
import { Callout } from '@/ui/callout';
import { List, ListItem } from '@/ui/list';
import { Cluster, Stack } from '@/ui/stack';
import { Text, TextLink } from '@/ui/text';

import {
  ModelPlanText,
  ModelPlanValue,
  type ModelPlanLabels,
  type ModelPlanLabelLookup,
} from './model-plan-record';

const EVENT_KIND: Readonly<Record<ModelProgressRecord['kind'], string>> = {
  commitment: 'Commitment',
  work: 'Work update',
  note: 'Note',
};
function ProgressEvent({
  event,
  lookup,
}: {
  readonly event: ModelProgressRecord;
  readonly lookup: ModelPlanLabelLookup;
}) {
  return (
    <Stack gap={2}>
      <Cluster>
        <Text weight="strong">{lookup.labelOf(event.subject)}</Text>
        <Badge>{event.state ?? EVENT_KIND[event.kind]}</Badge>
        <Text size="sm" tone="muted">
          {event.at}
        </Text>
      </Cluster>
      <ModelPlanText text={event.note} lookup={lookup} />
      {event.saidBy === null ? null : <Text size="sm">Recorded by {event.saidBy}</Text>}
      {event.promisedFor === null ? null : <Text size="sm">Promised for {event.promisedFor}</Text>}
      {event.confidence === null ? null : <Text size="sm">Confidence: {event.confidence}</Text>}
      {event.source === null ? null : <TextLink href={event.source}>Recorded source</TextLink>}
      <details>
        <summary>Event detail</summary>
        <ModelPlanValue value={event.raw} lookup={lookup} />
      </details>
    </Stack>
  );
}
/** Recorded source order stays visible; manual work notes do not become GitHub issue states. */
export function ModelPlanProgressFeed({
  progress,
  labelOf,
  hrefOf,
  subject,
}: {
  readonly progress: ModelPlanProgress;
  readonly labelOf: (id: string) => string;
  readonly hrefOf?: ModelPlanLabelLookup['hrefOf'];
  readonly subject?: string;
}) {
  const lookup: ModelPlanLabelLookup = { labelOf, ...(hrefOf === undefined ? {} : { hrefOf }) };
  const records = modelProgressRecords(progress, subject).map((event, position) => ({
    key: `${event.subject}:${event.at}:${String(position)}`,
    event,
  }));
  return (
    <Stack gap={3}>
      {progress.errors.length === 0 ? null : (
        <Callout title="Progress could not be read completely">
          <List>
            {progress.errors.map((error) => (
              <ListItem key={`${error.path}:${error.message}`}>
                {error.path}: {error.message}
              </ListItem>
            ))}
          </List>
        </Callout>
      )}
      {records.length === 0 ? (
        <Text as="p" tone="muted">
          No progress events are recorded.
        </Text>
      ) : (
        <List>
          {records.map(({ key, event }) => (
            <ListItem key={key}>
              <ProgressEvent event={event} lookup={lookup} />
            </ListItem>
          ))}
        </List>
      )}
    </Stack>
  );
}
type WorkItem = NonNullable<ModelPlan['work_items']>[number];
function itemIssueHref(item: WorkItem, recorded: string | undefined): string | null {
  if (recorded !== undefined) return recorded;
  if (item.repo === undefined || item.github_issue === undefined) return null;
  return issueUrlOf(item.repo, item.github_issue);
}
function WorkDependencies({
  item,
  lookup,
}: {
  readonly item: WorkItem;
  readonly lookup: ModelPlanLabels;
}) {
  if ((item.depends_on?.length ?? 0) === 0) return null;
  return (
    <Stack gap={1}>
      <Text size="sm" tone="muted">
        Depends on
      </Text>
      <ModelPlanValue value={item.depends_on} lookup={lookup} />
    </Stack>
  );
}
function WorkItemRow({
  item,
  progress,
  lookup,
  detailHref,
}: {
  readonly item: WorkItem;
  readonly progress: ModelPlanProgress;
  readonly lookup: ModelPlanLabels;
  readonly detailHref?: string | undefined;
}) {
  const status = progress.status[item.id];
  const issueHref = itemIssueHref(item, status?.url);
  const records = modelProgressRecords(progress, item.id);
  return (
    <Stack gap={2}>
      <Cluster spread>
        <Text as="h3" weight="strong">
          {item.title}
        </Text>
        <Badge tone={status?.state === 'closed' ? 'added' : 'neutral'}>
          {status === undefined ? 'GitHub state unknown' : status.state}
        </Badge>
      </Cluster>
      <Cluster>
        <Text size="sm">Team: {lookup.labelOf(item.team)}</Text>
        {item.needed_by === undefined ? null : <Text size="sm">Needed by {item.needed_by}</Text>}
        {status?.closed_at === undefined ? null : <Text size="sm">Closed {status.closed_at}</Text>}
      </Cluster>
      <WorkDependencies item={item} lookup={lookup} />
      <ModelPlanText text={item.body} lookup={lookup} />
      {issueHref === null ? null : <TextLink href={issueHref}>GitHub issue</TextLink>}
      {records.length === 0 ? (
        <Text tone="muted" size="sm">
          No delivery update is recorded.
        </Text>
      ) : (
        <ModelPlanProgressFeed progress={progress} labelOf={lookup.labelOf} subject={item.id} />
      )}
      {detailHref === undefined ? (
        <details>
          <summary>Work item detail</summary>
          <ModelPlanValue value={item} lookup={lookup} />
        </details>
      ) : (
        <TextLink href={detailHref}>Work item detail</TextLink>
      )}
    </Stack>
  );
}
/** A team's work and recorded issue state come from plan metadata and the independent progress record. */
export function ModelPlanWork({
  plan,
  progress,
  lookup,
  team = null,
  grouped = false,
  detailHref,
}: {
  readonly plan: ModelPlan;
  readonly progress: ModelPlanProgress;
  readonly lookup: ModelPlanLabels;
  readonly team?: string | null;
  readonly grouped?: boolean;
  readonly detailHref?: (id: string) => string;
}) {
  const work = workOrderOf(plan.work_items ?? [], plan.milestones ?? []).filter(
    (item) => team === null || item.team === team,
  );
  const teams = grouped ? [...new Set(work.map((item) => item.team))] : [null];
  return (
    <Stack gap={4}>
      {work.length === 0 ? (
        <Text as="p" tone="muted">
          No work items are recorded for this selection.
        </Text>
      ) : (
        teams.map((owner) => (
          <Stack
            as="section"
            label={owner === null ? 'Work items' : lookup.labelOf(owner)}
            key={owner ?? 'all'}
            gap={3}
          >
            {owner === null ? null : (
              <Text as="h3" size="lg" weight="strong">
                {lookup.labelOf(owner)}
              </Text>
            )}
            <List>
              {work
                .filter((item) => owner === null || item.team === owner)
                .map((item) => (
                  <ListItem key={item.id}>
                    <WorkItemRow
                      item={item}
                      progress={progress}
                      lookup={lookup}
                      detailHref={detailHref?.(item.id)}
                    />
                  </ListItem>
                ))}
            </List>
          </Stack>
        ))
      )}
      <Stack as="section" label="Milestones" gap={2}>
        <Text as="h3" weight="strong">
          Milestones
        </Text>
        {(plan.milestones ?? []).map((milestone) => (
          <Stack key={milestone.id}>
            <ModelPlanValue value={milestone} lookup={lookup} />
            <ModelPlanProgressFeed
              progress={progress}
              labelOf={lookup.labelOf}
              subject={milestone.id}
            />
          </Stack>
        ))}
      </Stack>
    </Stack>
  );
}

type Responsibility =
  | NonNullable<ModelPlan['decisions']>[number]
  | NonNullable<ModelPlan['questions']>[number]
  | NonNullable<ModelPlan['risks']>[number]
  | ModelPlan['changes'][number];
function responsibilityTitle(record: Responsibility): string {
  if ('title' in record) return record.title;
  if ('question' in record) return record.question;
  return record.statement;
}
/** Team responsibility is read from explicit work, decider and risk-owner fields. */
export function ModelPlanPart({
  plan,
  progress,
  lookup,
  team,
  detailHref,
}: {
  readonly plan: ModelPlan;
  readonly progress: ModelPlanProgress;
  readonly lookup: ModelPlanLabels;
  readonly team: string | null;
  readonly detailHref: (id: string) => string;
}) {
  const assigned = (plan.work_items ?? []).filter((item) => team === null || item.team === team);
  const changes = new Set(assigned.flatMap((item) => item.implements ?? []));
  const records = [
    ...(plan.decisions ?? []).filter((item) => team === null || item.decider === team),
    ...(plan.questions ?? []).filter((item) => team === null || item.decider === team),
    ...(plan.risks ?? []).filter((item) => team === null || item.owner === team),
    ...plan.changes.filter((item) => changes.has(item.id)),
  ];
  return (
    <Stack gap={4}>
      <ModelPlanWork
        plan={plan}
        progress={progress}
        lookup={lookup}
        team={team}
        grouped={team === null}
        detailHref={detailHref}
      />
      <Stack as="section" label="Decisions, questions, risks and assigned changes" gap={3}>
        <Text as="h3" weight="strong">
          Decisions, questions, risks and assigned changes
        </Text>
        {records.length === 0 ? (
          <Text tone="muted">No additional responsibilities are explicitly assigned.</Text>
        ) : (
          <List>
            {records.map((record) => (
              <ListItem key={record.id}>
                <TextLink href={detailHref(record.id)}>{responsibilityTitle(record)}</TextLink>
              </ListItem>
            ))}
          </List>
        )}
      </Stack>
    </Stack>
  );
}
