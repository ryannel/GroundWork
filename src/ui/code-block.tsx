import type { ReactNode } from 'react';

import styles from './code-block.module.css';

interface CodeBlockProps {
  /** What the text is, above it. */
  readonly label: string;
  readonly children: string;
  /** An action beside the label, such as Copy. */
  readonly action?: ReactNode;
}

/** Text to copy and run or paste exactly as it is: a command, a YAML entry, a prompt. */
export function CodeBlock({ label, children, action }: CodeBlockProps) {
  return (
    <figure className={styles.block}>
      <figcaption className={styles.head}>
        <span className={styles.label}>{label}</span>
        {action}
      </figcaption>
      <pre className={styles.code}>{children}</pre>
    </figure>
  );
}
