import type { Model } from '@/application/plan/derive';
import type { TeamPart } from '@/application/plan-story-part';
import { levelWord } from '@/application/plan-viz-tests';
import { NamedChip } from '@/features/plan/common/named-chip';
import { WorkItemRows } from '@/features/plan/viz/board/work-item-rows';
import { Badge } from '@/ui/badge';

import { PartSection } from './part-section';
import { BeforeApproval } from './team-gates';
import styles from './team-page.module.css';
import { LandsIn } from './team-steps';
import { TalksTo } from './team-talks';

interface TeamPageProps {
  readonly model: Model;
  readonly team: string;
  readonly part: TeamPart;
}

function ProvedBy({ model, part }: Omit<TeamPageProps, 'team'>) {
  const tests = part.tests.flatMap((id) => {
    const level = (model.plan.tests ?? []).find((t) => t.id === id)?.level;
    return level === undefined ? [] : [{ id, level }];
  });
  if (tests.length === 0) return null;
  return (
    <details className={styles.fold}>
      <summary>Tests that prove this part</summary>
      <ul className={styles.tests}>
        {tests.map((t) => (
          <li className={styles.test} key={t.id}>
            <Badge>{levelWord(t.level)}</Badge>
            <NamedChip id={t.id} model={model} />
          </li>
        ))}
      </ul>
    </details>
  );
}

// One team's page: what it decides and waits on, where its steps change, what it builds, and who it talks to.
export function TeamPage({ model, team, part }: TeamPageProps) {
  return (
    <div className={styles.stack}>
      <BeforeApproval model={model} part={part} team={team} />
      <LandsIn model={model} part={part} team={team} />
      {part.work.length === 0 ? null : (
        <PartSection title="What you build">
          <WorkItemRows items={part.work} model={model} waits={false} />
        </PartSection>
      )}
      <TalksTo model={model} part={part} team={team} />
      <ProvedBy model={model} part={part} />
    </div>
  );
}
