import type { Model } from '@/application/plan/derive';
import type { Outline, Page } from '@/application/plan-pages';
import { recapOf } from '@/application/plan-story-recap';
import { ModelInline } from '@/features/plan/common/model-text';

import styles from './remember.module.css';

interface RememberProps {
  readonly model: Model;
  readonly outline: Outline;
  readonly page: Page;
}

/** Closes a chapter's last screen with the few points worth carrying into the next one. */
export function Remember({ model, outline, page }: RememberProps) {
  const chapter = outline.chapters.find((c) => c.key === page.chapter);
  if (chapter?.pages.at(-1)?.href !== page.href) return null;
  const points = recapOf(model, page.chapter);
  if (points.length === 0) return null;
  return (
    <section aria-label={`What to remember from ${chapter.title}`} className={styles.remember}>
      <h2 className={styles.eyebrow}>What to remember</h2>
      <ul className={styles.list}>
        {points.map((p) => (
          <li key={p}>
            <ModelInline model={model} text={p} />
          </li>
        ))}
      </ul>
    </section>
  );
}
