import Link from 'next/link';
import type { ReactNode } from 'react';

import styles from './card.module.css';

interface CardProps {
  readonly href: string;
  readonly title: string;
  readonly children: ReactNode;
}

// One card, one action: the whole card opens what it names.
export function Card({ href, title, children }: CardProps) {
  return (
    <Link className={styles.card} href={href}>
      <h3 className={styles.title}>{title}</h3>
      {children}
    </Link>
  );
}
