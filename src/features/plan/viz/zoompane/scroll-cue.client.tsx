'use client';

import { type ReactNode, useRef, useState } from 'react';

import styles from './scroll-cue.module.css';
import { useScrollCue } from './use-scroll-cue';

interface ScrollCueProps {
  readonly children: ReactNode;
  /** Say in words, above the box, that it scrolls sideways, until the reader has scrolled it. */
  readonly note?: boolean;
  /** Keep the box within the window's height and scroll it up and down too, so its sideways scrollbar is in reach. */
  readonly tall?: boolean;
}

// A box wider than its frame: it fades the edge that has more behind it, and can say so in words.
export function ScrollCue({ children, note = false, tall = false }: ScrollCueProps) {
  const box = useRef<HTMLDivElement>(null);
  const cue = useScrollCue(box);
  const [scrolled, setScrolled] = useState(false);
  return (
    <div className={styles.cue}>
      {note && cue.more && !scrolled ? (
        <p aria-hidden="true" className={styles.note}>
          Scrolls sideways →
        </p>
      ) : null}
      <div
        className={styles.box}
        data-more-left={cue.left ? '' : undefined}
        data-more-right={cue.right ? '' : undefined}
        data-scrolls=""
        data-tall={tall ? '' : undefined}
        onScroll={() => {
          if (cue.left && !scrolled) setScrolled(true);
        }}
        ref={box}
      >
        {children}
      </div>
    </div>
  );
}
