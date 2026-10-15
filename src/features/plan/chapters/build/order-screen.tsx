import Link from 'next/link';

import { pageHref } from '@/application/plan-pages';
import { orderHeadline, showsStrip, waveViews } from '@/application/plan-story-build';
import { planStage, isApproved } from '@/application/plan-story-cover-standing';
import { buildSummary } from '@/application/plan-viz-milestone';
import { DeliveryHead } from '@/features/plan/chapters/delivery/delivery-head';
import { EmptyState } from '@/features/plan/chapters/delivery/empty-state';
import type { BodyProps } from '@/features/plan/screen-bodies';
import { MilestoneCard } from '@/features/plan/viz/board/milestone-card';
import { Dag } from '@/features/plan/viz/dag/dag';

import styles from './order-screen.module.css';
import { WaveStack } from './wave-stack';

const LEDE =
  'A wave is a set of work items that can start together once the wave before it is done. A milestone card follows the wave that finishes its last item.';

// 7.1: what leads the build, the waves it comes in, and the graph behind them.
export function OrderScreen({ model, outline, page }: BodyProps) {
  const sum = buildSummary(model);
  const waves = model.waves();
  const headline = orderHeadline(model, sum, waves);
  const head = { chapter: 'build', headline, model, outline, page } as const;
  if (sum.total === 0) {
    return (
      <>
        <DeliveryHead {...head} />
        <EmptyState>No work items yet.</EmptyState>
      </>
    );
  }
  const views = waveViews(model, sum, isApproved(planStage(model)));
  const plays = outline.pages.some((p) => p.chapter === 'journey' && p.screen === 'execution');
  return (
    <>
      <DeliveryHead {...head}>
        {sum.started ? null : <p>{LEDE}</p>}
        {showsStrip(sum) ? (
          <div className={styles.strip}>
            {sum.milestones.map((ms) => (
              <MilestoneCard density="chip" key={ms.id} model={model} msId={ms.id} />
            ))}
          </div>
        ) : null}
      </DeliveryHead>
      {plays ? (
        <p className={styles.plays}>
          <Link href={pageHref(outline, 'journey', 'execution')}>How it plays out →</Link>
        </p>
      ) : null}
      {sum.delivered ? (
        <>
          <div className={styles.board}>
            {sum.milestones.map((ms) => (
              <MilestoneCard key={ms.id} model={model} msId={ms.id} />
            ))}
          </div>
          <details className={styles.fold}>
            <summary>How it was built</summary>
            <WaveStack model={model} views={views} />
          </details>
        </>
      ) : (
        <WaveStack model={model} views={views} />
      )}
      <details className={styles.fold}>
        <summary>Dependency graph, with the critical path</summary>
        <Dag byMilestone model={model} />
      </details>
    </>
  );
}
