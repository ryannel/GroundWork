import type { ReactNode } from 'react';

import type { Model } from '@/application/plan/derive';
import type { Outline, Page } from '@/application/plan-pages';
import { ScreenHead } from '@/features/plan/chapters/screen-head';
import { ModelInline } from '@/features/plan/common/model-text';

import styles from './delivery-head.module.css';

interface DeliveryHeadProps {
  readonly model: Model;
  readonly outline: Outline;
  readonly page: Page;
  /** What is true on this screen. */
  readonly headline: string;
  /** The plan's own claim for the chapter is said once, on the chapter's first screen. */
  readonly chapter: 'prove' | 'build' | 'commit';
  readonly children?: ReactNode;
}

// The head of a screen in chapters 6 to 8: the chapter's claim where the chapter starts, then this screen's headline.
export function DeliveryHead({
  model,
  outline,
  page,
  headline,
  chapter,
  children,
}: DeliveryHeadProps) {
  const first = outline.pages.find((p) => p.chapter === page.chapter)?.screen === page.screen;
  const claim = first ? (model.plan.story?.chapters?.[chapter]?.headline ?? '') : '';
  return (
    <ScreenHead headline={headline} outline={outline} page={page}>
      {claim === '' ? null : (
        <p className={styles.claim}>
          <ModelInline model={model} text={claim} />
        </p>
      )}
      {children}
    </ScreenHead>
  );
}
