'use client';

import styles from './copy-mermaid.module.css';
import { useCopy } from './use-copy';

const WORDS = { idle: 'Copy as Mermaid', copied: 'Copied ✓', failed: 'Could not copy' } as const;

// Puts the flow on the clipboard as a Mermaid sequence diagram, for a document or a chat.
export function CopyMermaid({ text }: { readonly text: string }) {
  const { state, copy } = useCopy(text);
  return (
    <button className={styles.button} onClick={copy} type="button">
      <span aria-live="polite">{WORDS[state]}</span>
    </button>
  );
}
