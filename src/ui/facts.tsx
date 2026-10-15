import { Children, type ReactNode } from 'react';

import styles from './facts.module.css';

interface FactsProps {
  readonly items: readonly string[];
  /** More facts that are not plain text, such as a repo in code. */
  readonly children?: ReactNode;
}

// A row of short facts with a dot between them: "3 domains · 14 systems".
export function Facts({ items, children }: FactsProps) {
  const extra = Children.toArray(children);
  return (
    <ul className={styles.facts}>
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
      {extra.map((child, index) => (
        <li key={`extra-${String(index)}`}>{child}</li>
      ))}
    </ul>
  );
}
