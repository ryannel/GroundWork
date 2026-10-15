'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';

import { type PickTally, pickCell } from './risk-pick';
import styles from './risk-picker.module.css';

interface Picked extends PickTally {
  readonly cell: string;
  /** "high likelihood, medium impact". */
  readonly words: string;
}

interface RiskPickerProps {
  /** The grid, drawn with `pick`. */
  readonly grid: ReactNode;
  /** The register the pick filters. */
  readonly register: ReactNode;
}

const plural = (n: number): string => (n === 1 ? 'risk' : 'risks');

// The grid filters the register: a click on a cell shows only the risks in it, a second click or Clear filter shows
// them all again. A click on a dot still opens that risk.
export function RiskPicker({ grid, register }: RiskPickerProps) {
  const root = useRef<HTMLDivElement>(null);
  const [picked, setPicked] = useState<Picked | null>(null);
  const latest = useRef<string | null>(null);

  useEffect(() => {
    const el = root.current;
    if (el === null) return;
    const onClick = (event: MouseEvent): void => {
      const target = event.target instanceof Element ? event.target : null;
      const button = target?.closest<HTMLElement>('[data-pick]') ?? null;
      if (button === null) return;
      const key = button.dataset.pick ?? '';
      const cell = latest.current !== null && key === latest.current ? null : key;
      latest.current = cell;
      const tally = pickCell(el, cell);
      setPicked(cell === null ? null : { ...tally, cell, words: button.dataset.words ?? key });
    };
    el.addEventListener('click', onClick);
    return () => {
      el.removeEventListener('click', onClick);
    };
  }, []);

  const clear = (): void => {
    latest.current = null;
    if (root.current !== null) pickCell(root.current, null);
    setPicked(null);
  };

  return (
    <div className={styles.picker} ref={root}>
      {grid}
      <p aria-live="polite" className={styles.bar}>
        {picked === null ? (
          <span className={styles.hint}>Pick a cell of the grid to show only its risks.</span>
        ) : (
          <>
            <span>
              <strong>
                {picked.shown} of {picked.total}
              </strong>{' '}
              {plural(picked.total)}: {picked.words}
            </span>
            <button className={styles.clear} onClick={clear} type="button">
              Clear filter
            </button>
          </>
        )}
      </p>
      {register}
    </div>
  );
}
