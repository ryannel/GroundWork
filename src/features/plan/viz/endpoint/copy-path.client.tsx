'use client';

import { useState } from 'react';

import styles from './copy-path.module.css';

/** "Copy path": puts the endpoint's path on the clipboard and says so for a moment. */
export function CopyPath({ text }: { readonly text: string }) {
  const [done, setDone] = useState(false);
  const copy = () => {
    void navigator.clipboard.writeText(text).then(() => {
      setDone(true);
      setTimeout(() => {
        setDone(false);
      }, 1500);
    });
  };
  return (
    <button className={styles.copy} onClick={copy} title={`Copy ${text}`} type="button">
      <span aria-live="polite">{done ? 'Copied ✓' : 'Copy path'}</span>
    </button>
  );
}
