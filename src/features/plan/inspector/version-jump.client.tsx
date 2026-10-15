'use client';

import { useId } from 'react';

import type { Model } from '@/application/plan/derive';
import { ledgerOf } from '@/application/plan/revision-ledger';

import styles from './version-jump.module.css';

interface VersionJumpProps {
  readonly model: Model;
  /** The version shown, null for the one being read. */
  readonly value: string | null;
  readonly onChange: (version: string | null) => void;
}

// Opens the thing as it stood at another revision of the plan. Only versions with a snapshot kept can be had.
export function VersionJump({ model, value, onChange }: VersionJumpProps) {
  const id = useId();
  const own = model.plan.meta.version;
  const others = ledgerOf(model.plan).filter((r) => r.version !== own);
  if (others.length === 0) return null;
  return (
    <div className={styles.jump} data-on={value === null ? undefined : ''}>
      <label className={styles.word} htmlFor={id}>
        As at
      </label>
      <select
        className={styles.select}
        id={id}
        onChange={(event) => {
          onChange(event.target.value === '' ? null : event.target.value);
        }}
        value={value ?? ''}
      >
        <option value="">{own === undefined ? 'This version' : `v${own}, this version`}</option>
        {others.toReversed().map((r) => (
          <option key={r.version} value={r.version}>
            {`v${r.version}, ${r.status}`}
          </option>
        ))}
      </select>
    </div>
  );
}

/** Where a revision's plan.json is, beside the plan's own. */
export const revisionSrc = (src: string, version: string): string =>
  `${src.slice(0, src.length - 'plan.json'.length)}revisions/${encodeURIComponent(version)}/plan.json`;
