import type { ReactNode } from 'react';

import styles from './button.module.css';

type ButtonVariant = 'default' | 'primary' | 'ghost';

interface ButtonProps {
  readonly children: ReactNode;
  readonly variant?: ButtonVariant;
  readonly size?: 'sm' | 'md';
  readonly type?: 'button' | 'submit';
  readonly label?: string;
  readonly onClick?: () => void;
}

export function Button({
  children,
  variant = 'default',
  size = 'md',
  type = 'button',
  label,
  onClick,
}: ButtonProps) {
  return (
    <button
      aria-label={label}
      className={styles.button}
      data-size={size}
      data-variant={variant}
      onClick={onClick}
      type={type}
    >
      {children}
    </button>
  );
}
