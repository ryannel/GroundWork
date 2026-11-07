import type { ReactNode } from 'react';

import styles from './inspector-body.module.css';

/** The scrollable record inside the inspector. */
export function InspectorBody({ children }: { readonly children: ReactNode }) {
  return <div className={styles.body}>{children}</div>;
}
