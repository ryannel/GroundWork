'use client';

import Link from 'next/link';
import { type RefObject, Suspense, use, useEffect, useRef, useSyncExternalStore } from 'react';

import type { Model } from '@/application/plan/derive';
import { aheadStop } from '@/application/plan-changes-ahead';
import type { PlanAddress } from '@/application/plan-pages';
import { EntityChip } from '@/features/plan/common/entity-chip';
import { pendingModel } from '@/features/plan/plan-model';

import styles from './changes-ahead.module.css';
import {
  type Pin,
  clearPins,
  markSeen,
  pinsOf,
  setTrayOpen,
  subscribe,
  trayOpen,
} from './tray-store';

// The changes-ahead tray: what the reader pinned while walking today's journey, each with a link to the screen of
// chapter 4 that shows how it changes. A pin is ticked off once that screen has been read.

const PANEL_ID = 'changes-ahead';
const NO_PINS: readonly Pin[] = [];

const usePins = (plan: string): readonly Pin[] =>
  useSyncExternalStore(
    subscribe,
    () => pinsOf(plan),
    () => NO_PINS,
  );
const useOpen = (): boolean => useSyncExternalStore(subscribe, trayOpen, () => false);

function pillText(pins: readonly Pin[]): string {
  const seen = pins.filter((p) => p.seen).length;
  if (seen === pins.length) return `All ${String(pins.length)} planned changes seen ✓`;
  const ahead = pins.length - seen;
  const changes = ahead === 1 ? 'change' : 'changes';
  return seen === 0
    ? `◇ ${String(ahead)} ${changes} ahead`
    : `◇ ${String(ahead)} ${changes} ahead · ${String(seen)} seen`;
}

interface RowsProps {
  readonly src: string;
  readonly at: PlanAddress;
  readonly here: string;
  readonly pins: readonly Pin[];
}

function PinRow({
  model,
  at,
  pin,
}: {
  readonly model: Model;
  readonly at: PlanAddress;
  readonly pin: Pin;
}) {
  const stop = aheadStop(model, at, pin.id);
  return (
    <li className={styles.row} data-seen={pin.seen ? '' : undefined}>
      <span aria-label={pin.seen ? 'Seen' : 'Still ahead'} className={styles.mark} role="img">
        {pin.seen ? '✓' : '◇'}
      </span>
      <EntityChip id={pin.id} model={model} />
      {stop === null ? null : (
        <Link className={styles.go} href={stop.href}>
          {stop.position} {stop.title}
        </Link>
      )}
    </li>
  );
}

/** Ticks off the pins whose changes this screen shows. */
function SeenHere({ src, at, here }: Omit<RowsProps, 'pins'>) {
  const model = use(pendingModel(src).model);
  const plan = `${at.workspace}/${at.slug}`;
  useEffect(() => {
    if (model !== null) markSeen(plan, (pin) => aheadStop(model, at, pin.id)?.href === here);
  }, [model, at, plan, here]);
  return null;
}

function Rows({ src, at, pins }: Omit<RowsProps, 'here'>) {
  const model = use(pendingModel(src).model);
  if (model === null) return <p className={styles.note}>The plan could not be loaded.</p>;
  return (
    <ul className={styles.rows}>
      {pins.map((pin) => (
        <PinRow at={at} key={pin.id} model={model} pin={pin} />
      ))}
    </ul>
  );
}

function usePanel(open: boolean, box: RefObject<HTMLDivElement | null>): void {
  useEffect((): (() => void) | undefined => {
    if (!open) return;
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') setTrayOpen(false);
    };
    const onDown = (event: PointerEvent): void => {
      if (event.target instanceof Node && box.current?.contains(event.target) !== true) {
        setTrayOpen(false);
      }
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onDown);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onDown);
    };
  }, [open, box]);
}

interface ChangesAheadProps {
  readonly src: string;
  readonly plan: PlanAddress;
  /** The screen being read. */
  readonly here: string;
}

/** The tray in the corner of a plan; nothing until the reader has pinned something. */
export function ChangesAhead({ src, plan, here }: ChangesAheadProps) {
  const key = `${plan.workspace}/${plan.slug}`;
  const pins = usePins(key);
  const open = useOpen();
  const box = useRef<HTMLDivElement>(null);
  usePanel(open, box);
  if (pins.length === 0) return null;
  return (
    <div className={styles.tray} data-tray="" ref={box}>
      {pins.every((p) => p.seen) ? null : (
        <Suspense fallback={null}>
          <SeenHere at={plan} here={here} src={src} />
        </Suspense>
      )}
      {open ? (
        <section aria-label="Changes ahead" className={styles.panel} id={PANEL_ID}>
          <header className={styles.head}>
            <h2 className={styles.title}>Changes ahead</h2>
            <button
              className={styles.clear}
              onClick={() => {
                clearPins(key);
                setTrayOpen(false);
              }}
              type="button"
            >
              Clear
            </button>
          </header>
          <p className={styles.note}>Pick one to see it before and after.</p>
          <Suspense fallback={<p className={styles.note}>Loading the plan…</p>}>
            <Rows at={plan} pins={pins} src={src} />
          </Suspense>
        </section>
      ) : null}
      <button
        aria-controls={PANEL_ID}
        aria-expanded={open}
        className={styles.pill}
        onClick={() => {
          setTrayOpen(!open);
        }}
        type="button"
      >
        {pillText(pins)}
      </button>
    </div>
  );
}
