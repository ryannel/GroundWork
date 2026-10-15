import type { Model } from '@/application/plan/derive';
import { workHeadline } from '@/application/plan-story-build';
import { buildSummary, type BuildSummary } from '@/application/plan-viz-milestone';
import { teamName } from '@/application/plan-viz-teams';
import { countOf } from '@/application/plan-viz-text';
import { orderTeams, wiState } from '@/application/plan-viz-work';
import { DeliveryHead } from '@/features/plan/chapters/delivery/delivery-head';
import { EmptyState } from '@/features/plan/chapters/delivery/empty-state';
import { TeamDot } from '@/features/plan/common/team-dot';
import type { BodyProps } from '@/features/plan/screen-bodies';
import { GateChip } from '@/features/plan/viz/board/gate-chip';
import { WorkExport } from '@/features/plan/viz/board/work-export';
import { WorkItemRows } from '@/features/plan/viz/board/work-item-rows';

import styles from './work-screen.module.css';

function progress(sum: BuildSummary, done: number, n: number): string {
  if (!sum.started) return countOf(n, 'work item');
  return n === 0 ? '' : `${String(done)} of ${String(n)} done`;
}

function TeamSection({
  model,
  sum,
  team,
}: {
  readonly model: Model;
  readonly sum: BuildSummary;
  readonly team: string;
}) {
  const mine = sum.items.filter((w) => w.team === team);
  const done = mine.filter((w) => wiState(model, w.id) === 'done').length;
  // what the first item still to do waits on, said once under the team's name
  const lead = mine.find((w) => wiState(model, w.id) !== 'done') ?? mine[0];
  const waits =
    lead === undefined || wiState(model, lead.id) === 'done' ? [] : model.blockersOf(lead.id);
  return (
    <section className={styles.team}>
      <header className={styles.head}>
        <TeamDot model={model} named teamId={team} />
        <button className={styles.name} data-inspect={team} type="button">
          {teamName(model, team)}
        </button>
        <span className={styles.count}>{progress(sum, done, mine.length)}</span>
      </header>
      {waits.length === 0 ? null : (
        <div className={styles.waits}>
          <span className={styles.kicker}>next item waits on</span>
          {waits.map((q) => (
            <GateChip id={q} key={q} model={model} />
          ))}
        </div>
      )}
      <WorkItemRows items={mine} model={model} waits={false} />
    </section>
  );
}

// 7.3: each team's work, in build order, and the work as GitHub issues to copy.
export function WorkScreen({ model, outline, page }: BodyProps) {
  const sum = buildSummary(model);
  const head = {
    chapter: 'build',
    headline: workHeadline(model, sum),
    model,
    outline,
    page,
  } as const;
  if (sum.total === 0) {
    return (
      <>
        <DeliveryHead {...head} />
        <EmptyState>No work items yet.</EmptyState>
      </>
    );
  }
  return (
    <>
      <DeliveryHead {...head} />
      <div className={styles.teams}>
        {orderTeams(
          model,
          sum.items.map((w) => w.team),
        ).map((team) => (
          <TeamSection key={team} model={model} sum={sum} team={team} />
        ))}
      </div>
      <details className={styles.export}>
        <summary>
          Send to GitHub
          <span className={styles.hint}>copy each work item as a GitHub issue</span>
        </summary>
        <p className={styles.note}>
          Each work item is written up as a GitHub issue. Open one to preview it, or copy a team’s
          at once.
        </p>
        <WorkExport model={model} />
      </details>
    </>
  );
}
