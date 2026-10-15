import type { Model } from '@/application/plan/derive';
import type { WaveView } from '@/application/plan-story-build';
import { workById } from '@/application/plan-viz-work';
import { MilestoneCard } from '@/features/plan/viz/board/milestone-card';
import { WorkItemCard } from '@/features/plan/viz/board/work-item-card';

import styles from './wave-stack.module.css';

interface WaveStackProps {
  readonly model: Model;
  readonly views: readonly WaveView[];
}

function Cards({ model, view }: { readonly model: Model; readonly view: WaveView }) {
  return (
    <>
      <ol className={styles.cards}>
        {view.ids.map((id) => {
          const w = workById(model, id);
          return w === undefined ? null : (
            <li key={id}>
              <WorkItemCard model={model} w={w} />
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
export function WaveStack({ model, views }: WaveStackProps) {
  return (
    <div className={styles.stack}>
      {views.map((view) =>
        view.finished ? (
          <details className={styles.wave} data-done="" key={view.n}>
            <summary className={styles.head}>
              <span className={styles.n}>{view.n}</span>
              <strong>{view.label}</strong>
            </summary>
            <Cards model={model} view={view} />
          </details>
        ) : (
          <section className={styles.wave} key={view.n}>
            <header className={styles.head}>
              <span className={styles.n}>{view.n}</span>
              <strong>{view.label}</strong>
              <span className={styles.hint}>{view.hint}</span>
            </header>
            <Cards model={model} view={view} />
          </section>
        ),
      )}
    </div>
  );
}
