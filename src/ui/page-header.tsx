import Link from 'next/link';
import type { ReactNode } from 'react';

import styles from './page-header.module.css';

interface Crumb {
  readonly label: string;
  readonly href: string;
}

interface PageHeaderProps {
  /** Where the page sits: each parent, outermost first. */
  readonly trail?: readonly Crumb[];
  /** The name of what the page is about. */
  readonly title: string;
  /** One line on what it is, or what is true of it. */
  readonly description?: ReactNode;
  /** Quiet facts: sizes, counts, owners. */
  readonly meta?: ReactNode;
  /** Anything longer that the reader needs before the content. */
  readonly children?: ReactNode;
}

// Breadcrumb, name, description, facts: the same order on every page, so the eye always lands in the same place.
export function PageHeader({ trail = [], title, description, meta, children }: PageHeaderProps) {
  return (
    <header className={styles.header}>
      {trail.length === 0 ? null : (
        <nav aria-label="Breadcrumb" className={styles.trail}>
          <ol className={styles.crumbs}>
            {trail.map((crumb) => (
              <li className={styles.crumb} key={crumb.href}>
                <Link href={crumb.href}>{crumb.label}</Link>
              </li>
            ))}
          </ol>
        </nav>
      )}
      <h1 className={styles.title}>{title}</h1>
      {description === undefined || description === null ? null : (
        <div className={styles.description}>{description}</div>
      )}
      {meta === undefined ? null : <div className={styles.meta}>{meta}</div>}
      {children === undefined ? null : <div className={styles.body}>{children}</div>}
    </header>
  );
}
