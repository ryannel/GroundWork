import type { ReactNode } from 'react';

import styles from './app-shell.module.css';

interface AppShellProps {
  /** The bar across the top. */
  readonly bar: ReactNode;
  /** The rail down the left; leave out for a page with nothing beside it. */
  readonly rail?: ReactNode;
  /** Overlays that sit outside the page, such as the inspector. */
  readonly overlays?: ReactNode;
  readonly children: ReactNode;
}

// Every page has the same frame: the bar on top, a rail on the left when there is one, and the stage, centred in
// what is left. An open inspector narrows the page on a wide window instead of covering it.
export function AppShell({ bar, rail, overlays, children }: AppShellProps) {
  return (
    <div className={styles.shell}>
      {bar}
      <div className={styles.body} data-rail={rail === undefined ? undefined : ''}>
        {rail}
        <main className={styles.stage}>{children}</main>
      </div>
      {overlays}
    </div>
  );
}
