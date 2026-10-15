import type { Model } from '@/application/plan/derive';
import { versionPair } from '@/application/plan-viz-ladder';

import styles from './version-badge.module.css';

/** "New v2 · replaces v1" or "Deprecated v1 → v2": a versioned contract's place in its chain. */
export function VersionBadge({ model, id }: { readonly model: Model; readonly id: string }) {
  const pair = versionPair(model, id);
  if (pair === null) return null;
  return (
    <span className={styles.badge} data-side={pair.side}>
      <span>{pair.lead}</span>
      <span>{pair.other}</span>
    </span>
  );
}
