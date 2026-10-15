'use client';

import { useState } from 'react';

import type { Model } from '@/application/plan/derive';
import { canStepBack, close, stepBack, stepTo, trail } from '@/features/plan/inspector-history';
import { Button } from '@/ui/button';

import styles from './inspector-bar.module.css';

const CRUMBS = 3;
const COPIED_MS = 1600;

const clip = (text: string, n: number): string =>
  text.length <= n ? text : `${text.slice(0, n - 1)}…`;

function CopyLink() {
  const [copied, setCopied] = useState(false);
  const copy = (): void => {
    void navigator.clipboard.writeText(globalThis.location.href).then(() => {
      setCopied(true);
      setTimeout(() => {
        setCopied(false);
      }, COPIED_MS);
    });
  };
  return (
    <Button label="Copy a link to what is open" onClick={copy} size="sm" variant="ghost">
      {copied ? 'Copied' : 'Copy link'}
    </Button>
  );
}

interface InspectorBarProps {
  readonly id: string;
  /** Names the crumbs; null while the plan loads. */
  readonly model: Model | null;
}

// The panel's top line: back, the trail of what was opened before, a link to share, and close.
export function InspectorBar({ id, model }: InspectorBarProps) {
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
      <CopyLink />
      <Button label="Close the inspector" onClick={close} size="sm" variant="ghost">
        Close
      </Button>
    </div>
  );
}
