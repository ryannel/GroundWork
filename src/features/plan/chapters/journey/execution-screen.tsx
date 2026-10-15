import Link from 'next/link';

import { pageHref } from '@/application/plan-pages';
import { executionStory } from '@/application/plan-story-journey-execution';
import { ScreenHead } from '@/features/plan/chapters/screen-head';
import { ModelText } from '@/features/plan/common/model-text';
import type { BodyProps } from '@/features/plan/screen-bodies';

import styles from './execution-screen.module.css';

// How the plan plays out: each path in the plan's own words, and where a step cites a flow, a way into its journey.
export function ExecutionScreen({ model, outline, page }: BodyProps) {
  const story = executionStory(model);
  if (story === null) return null;
  return (
    <>
      <ScreenHead headline={story.headline} outline={outline} page={page}>
        <p>With this plan.</p>
      </ScreenHead>
      {story.paths.map((path) => (
        <section className={styles.path} key={path.name}>
          <h3 className={styles.name}>{path.name}</h3>
          {path.summary === '' ? null : <ModelText model={model} text={path.summary} />}
          <ol className={styles.steps}>
            {path.steps.map((step) => (
              <li key={step.label}>
                {step.page === null ? (
                  <strong>{step.label}</strong>
                ) : (
                  <Link className={styles.go} href={pageHref(outline, 'journey', step.page)}>
                    {step.label} →
                  </Link>
                )}
                <ModelText model={model} text={step.detail} />
              </li>
            ))}
          </ol>
        </section>
      ))}
    </>
  );
}
