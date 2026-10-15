import Link from 'next/link';

import styles from './go-link.module.css';

interface GoLinkProps {
  readonly href: string;
  /** "Open page" unless it says more. */
  readonly label?: string;
  /** What the link opens, for a screen reader and hover. */
  readonly title?: string;
}

/** A small link to the plan page that draws a thing, or its ladder. */
export function GoLink({ href, label = 'Open page', title }: GoLinkProps) {
  return (
    <Link className={styles.go} href={href} title={title}>
      {label}
    </Link>
  );
}
