import Link from 'next/link';

import type { Model } from '@/application/plan/derive';
import type { Revision } from '@/application/plan/revision-types';
import { type Outline, type Page, pageHref } from '@/application/plan-pages';
import { versionKey } from '@/application/plan-pages-screens-versions';
import { type HistoryCard, historyView } from '@/application/plan-story-versions-history';
import { ScreenHead } from '@/features/plan/chapters/screen-head';
import { ModelInline } from '@/features/plan/common/model-text';

import styles from './history-screen.module.css';
import { StatusBadge } from './version-parts';

function Card({
  model,
  outline,
  card,
}: {
  readonly model: Model;
  readonly outline: Outline;
  readonly card: HistoryCard;
}) {
  return (
    <li>
      <Link className={styles.card} href={pageHref(outline, 'versions', versionKey(card.version))}>
        <span className={styles.top}>
          <span className={styles.version}>{card.version}</span>
          <StatusBadge look={card.look} word={card.word} />
          <span className={styles.hint}>Read it →</span>
        </span>
        <span className={styles.summary}>{card.summary}</span>
        {card.rejection === null ? null : (
          <span className={styles.rejection}>
            Why it was rejected:{' '}
            {card.rejection.reason === '' ? (
              <span className={styles.faint}>nobody recorded why</span>
            ) : (
              card.rejection.reason
            )}
          </span>
        )}
        {card.facts.map((fact) => (
          <span className={styles.fact} key={`${fact.label ?? ''}${fact.text}`}>
            {fact.label === null ? null : <span className={styles.faint}>{fact.label} </span>}
            <ModelInline model={model} text={fact.text} />
          </span>
        ))}
        {card.first === null ? null : <span className={styles.faint}>{card.first}</span>}
      </Link>
    </li>
  );
}

/** Every version of the plan, newest first, each leading to its own page. */
export function HistoryScreen({
  model,
  outline,
  page,
  revision,
}: {
  readonly model: Model;
  readonly outline: Outline;
  readonly page: Page;
  readonly revision: Revision;
}) {
  const view = historyView(model, revision);
  return (
    <div className={styles.screen}>
      <ScreenHead headline={view.headline} outline={outline} page={page}>
        <p className={styles.lede}>{view.lede}</p>
      </ScreenHead>
      <ol className={styles.cards}>
        {view.cards.map((card) => (
          <Card card={card} key={card.version} model={model} outline={outline} />
        ))}
      </ol>
    </div>
  );
}
