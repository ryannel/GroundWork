import Link from 'next/link';

import { planHref, type Outline, type Page } from '@/application/plan-pages';

import styles from './chapter-rail.module.css';
import { MarkRead, ReadCount, Tick } from './rail-marks.client';

// The plan as a story: each chapter opens to its screens, the current one already open. Reference and Versions
// sit apart, below the story. Each screen carries a mark: the one being read, the ones read before this session,
// and the rest.
export function ChapterRail({ outline, page }: { readonly outline: Outline; readonly page: Page }) {
  const plan = planHref(outline);
  return (
    <nav aria-label="Chapters" className={styles.rail}>
      <MarkRead href={page.href} plan={plan} />
      {outline.chapters.map((chapter) => (
        <details
          className={styles.chapter}
          data-current={chapter.key === page.chapter ? '' : undefined}
          data-side={chapter.side ? '' : undefined}
          key={chapter.key}
          open={chapter.key === page.chapter}
        >
          <summary className={styles.summary}>
            <span className={styles.number}>{chapter.number ?? '◦'}</span>
            <span className={styles.title}>{chapter.title}</span>
            {chapter.number === null ? null : (
              <span className={styles.count}>
                <ReadCount
                  current={page.href}
                  hrefs={chapter.pages.map((p) => p.href)}
                  plan={plan}
                />
              </span>
            )}
          </summary>
          <ol className={styles.screens}>
            {chapter.pages.map((screen) => (
              <li key={screen.href}>
                <Link
                  aria-current={screen.href === page.href ? 'page' : undefined}
                  className={styles.screen}
                  href={screen.href}
                >
                  <span aria-hidden="true" className={styles.tick}>
                    <Tick current={screen.href === page.href} href={screen.href} plan={plan} />
                  </span>
                  <span className={styles.name}>{screen.title}</span>
                </Link>
              </li>
            ))}
          </ol>
        </details>
      ))}
    </nav>
  );
}
