import type { ReactNode } from 'react';

import styles from './button.module.css';

/**
 * default, primary and ghost are buttons that look like buttons. link reads as an accent link; quiet is faint
 * words that brighten when pointed at; bare is a whole row or card that can be pressed, laid out by its caller.
 */
type ButtonVariant = 'default' | 'primary' | 'ghost' | 'link' | 'quiet' | 'bare';

interface ButtonProps {
  readonly children: ReactNode;
  readonly variant?: ButtonVariant;
  readonly size?: 'sm' | 'md';
  readonly type?: 'button' | 'submit';
  readonly label?: string;
  readonly title?: string;
  /** Set for a toggle: whether it is pressed now. */
  readonly pressed?: boolean;
  readonly onClick?: () => void;
}

export function Button({
  children,
  variant = 'default',
  size = 'md',
  type = 'button',
  label,
  title,
  pressed,
  onClick,
}: ButtonProps) {
  return (
    <button
      aria-label={label}
      aria-pressed={pressed}
      className={styles.button}
      data-size={size}
      data-variant={variant}
      onClick={onClick}
      title={title}
      type={type === 'submit' ? 'submit' : 'button'}
    >
      {children}
    </button>
  );
}
