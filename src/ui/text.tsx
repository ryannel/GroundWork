import type { ReactNode } from 'react';

import { IntentLink } from './intent-link.client';
import styles from './text.module.css';

type Tone = 'strong' | 'body' | 'muted' | 'faint' | 'accent';

interface TextProps {
  readonly children: ReactNode;
  readonly as?: 'span' | 'p' | 'div' | 'h3';
  readonly tone?: Tone;
  /** sm, md and lg are body sizes; xl is a heading in the display face. */
  readonly size?: 'sm' | 'md' | 'lg' | 'xl';
  readonly weight?: 'regular' | 'strong';
  readonly mono?: boolean;
  readonly caps?: boolean;
  /** Stop after this many lines, with an ellipsis. */
  readonly clamp?: 2 | 3;
}

/** Words in one of the type styles: how bright, how big, how heavy. Features set none of these themselves. */
export function Text({
  children,
  as: Tag = 'span',
  tone = 'body',
  size = 'md',
  weight = 'regular',
  mono = false,
  caps = false,
  clamp,
}: TextProps) {
  return (
    <Tag
      className={styles.text}
      data-caps={caps ? '' : undefined}
      data-clamp={clamp}
      data-mono={mono ? '' : undefined}
      data-size={size}
      data-tone={tone}
      data-weight={weight}
    >
      {children}
    </Tag>
  );
}

interface TextLinkProps {
  readonly href: string;
  readonly children: ReactNode;
  /** A title link is bright and heavy; a quiet link is faint until pointed at; a bare link is a whole row. */
  readonly tone?: 'title' | 'quiet' | 'accent' | 'bare';
}

export function TextLink({ href, children, tone = 'accent' }: TextLinkProps) {
  return (
    <IntentLink className={styles.link} data-tone={tone} href={href}>
      {children}
    </IntentLink>
  );
}
