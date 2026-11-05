import type { ReactNode } from 'react';

import { shortDate } from '@/application/plan-viz-state';
import type { WorkCardVM } from '@/application/workspace-work/work-card';
import { Mention } from '@/ui/mention';
import { RecordCard, type RecordRow } from '@/ui/record-card';
import { Text, TextLink } from '@/ui/text';

import { RecordUpdate } from './record-update.client';
import styles from './work-card.module.css';

interface WorkCardProps {
  readonly card: WorkCardVM;
  /** The workspace the plan is in, for the command Record update gives. */
  readonly workspace: string;
  /** The day dates are read against: a date this year leaves its year out. */
  readonly today?: Date | undefined;
  /** The title opens the inspector rather than the item's page. */
  readonly inspect?: boolean;
  /** A team's hue, 1 to 13. */
  readonly slot?: number | null;
}

const dayOf = (date: string, today: Date | undefined): string => shortDate(date, today);

function commitmentText(card: WorkCardVM, today: Date | undefined): string {
  const { commitment } = card;
  if (commitment === null) return 'nothing promised yet';
  return [
    commitment.state,
    commitment.confidence === null ? null : `${commitment.confidence} confidence`,
    commitment.promisedFor === null ? null : `for ${dayOf(commitment.promisedFor, today)}`,
  ]
    .filter((part) => part !== null)
    .join(', ');
}

function lastHeardText(card: WorkCardVM, today: Date | undefined): string {
  const heard = card.lastHeard;
  if (heard === null) return 'nothing heard yet';
  return [dayOf(heard.at, today), heard.by, heard.source]
    .filter((part) => part !== null)
    .join(' · ');
}

function rowsOf(card: WorkCardVM, today: Date | undefined): RecordRow[] {
  const { dates, blockers } = card;
  return [
    { label: 'Commitment', value: commitmentText(card, today) },
    { label: 'Progress', value: card.progress?.state ?? 'nothing recorded' },
    ...(dates.neededBy === null
      ? []
      : [
          {
            label: 'Needed by',
            value: dayOf(dates.neededBy, today),
            ...(dates.gapText === null ? {} : { aside: dates.gapText, warn: true }),
          },
        ]),
    { label: 'Last heard', value: lastHeardText(card, today) },
    ...(blockers.length === 0
      ? []
      : [
          {
            label: 'Blocked by',
            warn: true,
            value: (
              <span className={styles.blockers}>
                {blockers.map((b) => (
                  <TextLink href={b.href} key={b.id}>
                    {b.label}
                  </TextLink>
                ))}
              </span>
            ),
          },
        ]),
  ];
}

function IssueLink({ issue }: { readonly issue: NonNullable<WorkCardVM['issue']> }) {
  const state = issue.state === null ? '' : ` · ${issue.state}`;
  const words = `#${String(issue.number)}${state}`;
  return issue.url === null ? (
    <Text size="sm">{`GitHub issue ${words}`}</Text>
  ) : (
    <TextLink href={issue.url}>{`GitHub issue ${words}`}</TextLink>
  );
}

function Actions({ card, workspace }: { readonly card: WorkCardVM; readonly workspace: string }) {
  if (card.team.partner) {
    const subjects = [
      { id: card.id, label: card.title },
      ...(card.milestone === null ? [] : [{ id: card.milestone.id, label: card.milestone.label }]),
    ];
    return <RecordUpdate plan={card.plan} subjects={subjects} workspace={workspace} />;
  }
  if (card.issue !== null) return <IssueLink issue={card.issue} />;
  return (
    <Text size="sm" tone="muted">
      No GitHub issue yet
    </Text>
  );
}

/**
 * One piece of work, the one way it is drawn for every team: who owns it, its commitment, progress, dates and when we
 * last heard, what holds it up, then its GitHub issue (ours) or Record update (a partner's).
 */
export function WorkCard({ card, workspace, today, inspect = false, slot = null }: WorkCardProps) {
  const title: ReactNode = inspect ? (
    <Mention id={card.id} label={card.title} />
  ) : (
    <TextLink href={card.href} tone="title">
      {card.title}
    </TextLink>
  );
  const meta = [
    card.team.partner ? `${card.team.name} · ${card.ownership}` : card.ownership,
    card.milestone?.label ?? null,
  ]
    .filter((part) => part !== null)
    .join(' · ');
  return (
    <RecordCard
      actions={<Actions card={card} workspace={workspace} />}
      done={card.done}
      label={card.title}
      meta={meta}
      owner={card.team.name}
      rows={rowsOf(card, today)}
      slot={slot}
      title={title}
    />
  );
}
