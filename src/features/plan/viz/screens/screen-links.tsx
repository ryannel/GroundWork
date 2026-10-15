import type { Model } from '@/application/plan/derive';
import { type ScreenMode, screenLinks } from '@/application/plan-viz-screens';

import styles from './screen-links.module.css';

interface ScreenLinksProps {
  readonly model: Model;
  /** The screen. */
  readonly id: string;
  /** Where the plan's pictures and mockups are served from. */
  readonly base: string;
  readonly mode?: ScreenMode;
}

// Where to see a screen designed (Figma) and the walking mockup, when the plan has them.
export function ScreenLinks({ model, id, base, mode }: ScreenLinksProps) {
  const { figma, mockup } = screenLinks(model, id, { base, mode });
  if (figma === null && mockup === null) return null;
  return (
    <div className={styles.links}>
      {figma === null ? null : (
        <a className={styles.link} href={figma} rel="noopener" target="_blank">
          Design in Figma ↗
        </a>
      )}
      {mockup === null ? null : (
        <a
          className={styles.link}
          href={mockup}
          rel="noopener"
          target="_blank"
          title="A static, clickable version of the new screens"
        >
          Walk the mockup ↗
        </a>
      )}
    </div>
  );
}
