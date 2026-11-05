import type { Model } from '@/application/plan/derive';
import type { PlanAddress } from '@/application/plan-pages';
import type { WaveView } from '@/application/plan-story-build';
import { teamSlot, workById } from '@/application/plan-viz-work';
import { workCardOf } from '@/application/plan-work-cards';
import { MilestoneCard } from '@/features/plan/viz/board/milestone-card';
import { WorkCard } from '@/features/plan/work/work-card';

import styles from './wave-stack.module.css';

interface WaveStackProps {
  readonly model: Model;
  /** The plan, so each card links and records against it. */
  readonly at: PlanAddress;
  readonly views: readonly WaveView[];
}

interface CardsProps {
  readonly model: Model;
  readonly at: PlanAddress;
  readonly view: WaveView;
}

// Every team's work sits in the wave it can start in, partners' beside ours: a lane of their own would hide the
// critical path.
function Cards({ model, at, view }: CardsProps) {
  return (
    <>
      <ol className={styles.cards}>
        {view.ids.map((id) => {
          const w = workById(model, id);
          const card = workCardOf(model, at, id);
          return w === undefined || card === null ? null : (
            <li key={id}>
              <WorkCard
                card={card}
                inspect
                slot={teamSlot(model, w)}
                today={model.today}
                workspace={at.workspace}
              />
            </li>
          );
        })}
      </ol>
      {view.checkpoints.map((ms) => (
        <MilestoneCard key={ms} model={model} msId={ms} />
      ))}
    </>
  );
}

/**
 * The build as waves: a set of work items that can start together once the wave before it is done. A finished wave
 * folds away; a milestone's card follows the wave that finishes its last item.
 */
export function WaveStack({ model, at, views }: WaveStackProps) {
  return (
    <div className={styles.stack}>
      {views.map((view) =>
        view.finished ? (
          <details className={styles.wave} data-done="" key={view.n}>
            <summary className={styles.head}>
              <span className={styles.n}>{view.n}</span>
              <strong>{view.label}</strong>
            </summary>
            <Cards at={at} model={model} view={view} />
          </details>
        ) : (
          <section className={styles.wave} key={view.n}>
            <header className={styles.head}>
              <span className={styles.n}>{view.n}</span>
              <strong>{view.label}</strong>
              <span className={styles.hint}>{view.hint}</span>
            </header>
            <Cards at={at} model={model} view={view} />
          </section>
        ),
      )}
    </div>
  );
}
