import type { ReactNode } from 'react';

import { Panel } from './panel';
import styles from './split-view.module.css';

interface SplitViewProps {
  /** The long list to pick from. */
  readonly children: ReactNode;
  /** What is picked, in a panel that stays in view beside the list; null when nothing is. */
  readonly side: ReactNode;
}

/** A list with the picked thing open beside it, so the list keeps its place while you read. */
export function SplitView({ children, side }: SplitViewProps) {
  const open = side !== null && side !== undefined;
  return (
    <div className={styles.split} data-open={open ? '' : undefined}>
      <div className={styles.main}>{children}</div>
      {open ? (
        <aside className={styles.side}>
          <Panel>{side}</Panel>
        </aside>
      ) : null}
    </div>
  );
}
