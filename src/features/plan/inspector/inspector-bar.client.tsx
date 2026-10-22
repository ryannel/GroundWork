'use client';

import Link from 'next/link';

import type { Model } from '@/application/plan/derive';
import { canStepBack, close, stepBack, stepTo, trail } from '@/features/plan/inspector-history';
import { Button } from '@/ui/button';

import { CopyLink } from './copy-link.client';
import styles from './inspector-bar.module.css';

const CRUMBS = 3;

const clip = (text: string, n: number): string =>
  text.length <= n ? text : `${text.slice(0, n - 1)}…`;

interface InspectorBarProps {
  readonly id: string;
  /** Names the crumbs; null while the plan loads. */
  readonly model: Model | null;
  /** The thing's own page, when it has one. */
  readonly page?: string | null;
}

// The panel's top line: back, the trail of what was opened before, its own page, a link to share, and close.
export function InspectorBar({ id, model, page = null }: InspectorBarProps) {
  const label = (x: string): string => (model?.get(x) === undefined ? x : model.label(x));
  const before = trail();
  const shown = before.slice(-CRUMBS);
  const offset = before.length - shown.length;
  return (
    <div className={styles.bar}>
      {canStepBack() ? (
        <Button label="Back to the previous thing" onClick={stepBack} size="sm" variant="ghost">
          ←
        </Button>
      ) : null}
      <nav aria-label="What you opened" className={styles.crumbs}>
        {offset > 0 ? <span className={styles.sep}>…</span> : null}
        {shown.map((x, i) => (
          <span className={styles.crumb} key={`${x}-${String(offset + i)}`}>
            <button
              className={styles.step}
              onClick={() => {
                stepTo(offset + i);
              }}
              title={label(x)}
              type="button"
            >
              {clip(label(x), 22)}
            </button>
            <span aria-hidden="true" className={styles.sep}>
              /
            </span>
          </span>
        ))}
        <span aria-current="page" className={styles.current} title={label(id)}>
          {clip(label(id), 28)}
        </span>
      </nav>
      {page === null ? null : (
        <Link className={styles.open} href={page} title={`Open ${label(id)} as a page of its own`}>
          Open page →
        </Link>
      )}
      <CopyLink label="Copy a link to what is open" />
      <Button label="Close the inspector" onClick={close} size="sm" variant="ghost">
        Close
      </Button>
    </div>
  );
}
