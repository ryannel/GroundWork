'use client';

import { useEffect, useRef, useState, type ReactNode, type RefObject } from 'react';

import styles from './menu.module.css';

/** While `open`, a click outside `root`, a click on a link inside it, or Esc calls `close`. */
export function useDismiss(root: RefObject<HTMLElement | null>, open: boolean, close: () => void) {
  useEffect((): (() => void) | undefined => {
    if (!open) return;
    const onClick = (event: MouseEvent): void => {
      const target = event.target instanceof Element ? event.target : null;
      const inside = target !== null && root.current?.contains(target) === true;
      if (!inside || target.closest('a') !== null) close();
    };
    const onKey = (event: KeyboardEvent): void => {
      if (event.key !== 'Escape' || document.querySelector('dialog[open]') !== null) return;
      event.stopPropagation();
      close();
    };
    document.addEventListener('click', onClick);
    document.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('click', onClick);
      document.removeEventListener('keydown', onKey, true);
    };
  }, [root, open, close]);
}

interface MenuProps {
  /** What the button is called for assistive tech, and its tooltip. */
  readonly label: string;
  /** What the button shows. */
  readonly button: ReactNode;
  /** The menu's content, shown under the button while open. */
  readonly children: ReactNode;
}

// A button that opens a panel of links or choices beneath it. A click outside, a link followed or Esc closes it.
export function Menu({ label, button, children }: MenuProps) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  useDismiss(root, open, () => {
    setOpen(false);
  });
  return (
    <div className={styles.menu} ref={root}>
      <button
        aria-expanded={open}
        aria-label={label}
        className={styles.button}
        onClick={() => {
          setOpen(!open);
        }}
        title={label}
        type="button"
      >
        {button}
        <span aria-hidden="true" className={styles.caret} />
      </button>
      {open ? <div className={styles.panel}>{children}</div> : null}
    </div>
  );
}
