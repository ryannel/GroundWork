'use client';

import type { ReactNode } from 'react';

import type { CatalogueJourney } from '@/application/plan-viz-screen-catalogue';

import styles from './screen-map-frame.module.css';

interface ScreenMapFrameProps {
  readonly journeys: readonly CatalogueJourney[];
  readonly hasShared: boolean;
  readonly children: ReactNode;
}

const MARKED = '[data-journeys]';

// Read the two controls and mark every screen and line: lit when it belongs to the journey, dim when it does not,
// and a shared line shown only when asked for or lit.
function refresh(frame: HTMLElement): void {
  const picked = frame.querySelector('select')?.value ?? '';
  const shared = frame.querySelector('input')?.checked ?? false;
  for (const part of frame.querySelectorAll<HTMLElement>(MARKED)) {
    const lit = picked !== '' && (part.dataset.journeys ?? '').split(' ').includes(picked);
    part.toggleAttribute('data-lit', lit);
    part.toggleAttribute('data-dim', picked !== '' && !lit);
    if (part.dataset.sharedLine !== undefined) part.toggleAttribute('data-show', shared || lit);
  }
}

function Choices({ journeys }: { readonly journeys: readonly CatalogueJourney[] }) {
  const actors = [...new Set(journeys.map((j) => j.actor))];
  return (
    <>
      <option value="">All journeys</option>
      {actors.map((actor) => (
        <optgroup key={actor} label={actor}>
          {journeys
            .filter((j) => j.actor === actor)
            .map((j) => (
              <option key={j.id} value={j.id}>
                {j.name}
              </option>
            ))}
        </optgroup>
      ))}
    </>
  );
}

// Picking a journey lights its screens and lines and dims the rest; nothing moves. Shared navigation stays out of
// the way until it is asked for.
export function ScreenMapFrame({ journeys, hasShared, children }: ScreenMapFrameProps) {
  return (
    <section aria-label="Current screens and user journeys" className={styles.frame}>
      <div className={styles.bar}>
        <label className={styles.field}>
          Highlight a journey
          <select
            onChange={(event) => {
              const frame = event.currentTarget.closest('section');
              if (frame !== null) refresh(frame);
            }}
          >
            <Choices journeys={journeys} />
          </select>
        </label>
        {hasShared ? (
          <label className={styles.check}>
            <input
              onChange={(event) => {
                const frame = event.currentTarget.closest('section');
                if (frame !== null) refresh(frame);
              }}
              type="checkbox"
            />
            Show shared navigation
          </label>
        ) : null}
      </div>
      {children}
    </section>
  );
}
