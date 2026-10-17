'use client';

import { usePathname } from 'next/navigation';
import { type ReactNode, type RefObject, useEffect, useRef, useSyncExternalStore } from 'react';

import styles from './rail-drawer.module.css';

// Below 56rem the rail is a drawer: a button in the bar slides it in over the page, and a tap outside, Esc, a
// link followed or a wider window puts it away.

const NARROW = '(width < 56rem)';
const DRAWER_ID = 'rail-drawer';
const TOGGLE_ID = 'rail-toggle';

const listeners = new Set<() => void>();
let shown = false;

function setShown(next: boolean): void {
  if (shown === next) return;
  shown = next;
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

const isShown = (): boolean => shown;
const serverShown = (): boolean => false;
const useShown = (): boolean => useSyncExternalStore(subscribe, isShown, serverShown);

/** The button that opens the drawer; only there while the rail is one. */
export function RailToggle({ label }: { readonly label: string }) {
  const open = useShown();
  return (
    <button
      aria-controls={DRAWER_ID}
      aria-expanded={open}
      aria-label={label}
      className={styles.toggle}
      id={TOGGLE_ID}
      onClick={() => {
        setShown(!open);
      }}
      title={label}
      type="button"
    >
      <svg aria-hidden="true" fill="none" height="16" viewBox="0 0 16 16" width="16">
        <path d="M2.5 4h11M2.5 8h11M2.5 12h11" />
      </svg>
    </button>
  );
}

function close(): void {
  setShown(false);
  document.querySelector<HTMLElement>(`#${TOGGLE_ID}`)?.focus();
}

function useDrawer(box: RefObject<HTMLDivElement | null>, open: boolean): void {
  const routed: unknown = usePathname();
  useEffect(() => {
    setShown(false);
  }, [routed]);
  useEffect((): (() => void) | undefined => {
    if (!open) return;
    const media = matchMedia(NARROW);
    if (!media.matches) {
      setShown(false);
      return;
    }
    const first =
      box.current?.querySelector('[aria-current="page"]') ??
      box.current?.querySelector('a, summary');
    if (first instanceof HTMLElement) first.focus({ preventScroll: true });
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') close();
    };
    const onWide = (): void => {
      setShown(false);
    };
    document.addEventListener('keydown', onKey);
    media.addEventListener('change', onWide);
    return () => {
      document.removeEventListener('keydown', onKey);
      media.removeEventListener('change', onWide);
    };
  }, [box, open]);
}

/** Holds the rail: beside the page on a wide window, a drawer over it on a narrow one. */
export function RailDrawer({ children }: { readonly children: ReactNode }) {
  const open = useShown();
  const box = useRef<HTMLDivElement>(null);
  useDrawer(box, open);
  return (
    <>
      <button
        aria-label="Close the menu"
        className={styles.scrim}
        data-open={open ? '' : undefined}
        onClick={close}
        tabIndex={-1}
        type="button"
      />
      <div className={styles.drawer} data-open={open ? '' : undefined} id={DRAWER_ID} ref={box}>
        {children}
      </div>
    </>
  );
}
