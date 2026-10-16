'use client';

import Link from 'next/link';
import { type RefObject, useId, useLayoutEffect, useRef, useState } from 'react';

import type { DiagramBox, DomainDiagram } from '@/application/domain-diagram';
import { Swatch } from '@/ui/swatch';

import styles from './domain-diagram.module.css';

const READABLE = 720;
const PAD = 16;

function useFit(
  frame: RefObject<HTMLElement | null>,
  stage: RefObject<HTMLElement | null>,
  size: { readonly w: number; readonly h: number },
) {
  const { w, h } = size;
  useLayoutEffect(() => {
    const outer = frame.current;
    const inner = stage.current;
    if (outer === null || inner === null) return;
    inner.style.setProperty('--sw', `${String(w)}px`);
    inner.style.setProperty('--sh', `${String(h)}px`);
    const fit = (): void => {
      const s = Math.min(1, Math.max(outer.clientWidth, READABLE) / w);
      inner.style.setProperty('--fit', String(s));
    };
    fit();
    if (typeof ResizeObserver !== 'function') return;
    const watch = new ResizeObserver(fit);
    watch.observe(outer);
    return () => {
      watch.disconnect();
    };
  }, [frame, stage, w, h]);
}

const placed = (box: DiagramBox) => (el: HTMLElement | null) => {
  if (el === null) return;
  el.style.setProperty('--x', `${String(box.x + PAD)}px`);
  el.style.setProperty('--y', `${String(box.y + PAD)}px`);
  el.style.setProperty('--w', `${String(box.w)}px`);
  el.style.setProperty('--h', `${String(box.h)}px`);
};

function BoxBody({ box }: { readonly box: DiagramBox }) {
  return (
    <>
      <span className={styles.name}>
        {box.kind === 'here' ? <Swatch slot={box.slot} /> : null}
        {box.name}
      </span>
      {box.does === '' ? null : <span className={styles.does}>{box.does}</span>}
    </>
  );
}

interface BoxProps {
  readonly box: DiagramBox;
  readonly state: 'lit' | 'dim' | undefined;
  readonly onLight: (id: string | null) => void;
}

function Box({ box, state, onLight }: BoxProps) {
  const on = (): void => {
    onLight(box.id);
  };
  const off = (): void => {
    onLight(null);
  };
  const common = {
    className: styles.box,
    'data-kind': box.kind,
    'data-state': state,
    onBlur: off,
    onFocus: on,
    onMouseEnter: on,
    onMouseLeave: off,
    ref: placed(box),
  };
  if (box.href === null) {
    return (
      <div {...common}>
        <BoxBody box={box} />
      </div>
    );
  }
  return (
    <Link {...common} href={box.href}>
      <BoxBody box={box} />
    </Link>
  );
}

// The domain's systems as boxes, the people and systems around them, and one line for each pair that talk, counted.
// Pointing at a box lights its lines and dims the rest; a box opens its system.
export function DomainDiagramView({ diagram }: { readonly diagram: DomainDiagram }) {
  const [lit, setLit] = useState<string | null>(null);
  const frame = useRef<HTMLDivElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const arrow = useId();
  useFit(frame, stage, { w: diagram.w + PAD * 2, h: diagram.h + PAD * 2 });
  const near = new Set(
    lit === null
      ? []
      : diagram.lines.flatMap((l) => (l.from === lit || l.to === lit ? [l.from, l.to] : [])),
  );
  if (lit !== null) near.add(lit);
  const stateOf = (touches: boolean): 'lit' | 'dim' | undefined => {
    if (lit === null) return undefined;
    return touches ? 'lit' : 'dim';
  };
  return (
    <div className={styles.frame} ref={frame}>
      <div className={styles.stage} ref={stage}>
        <svg
          aria-hidden
          className={styles.lines}
          height={diagram.h + PAD * 2}
          viewBox={`${String(-PAD)} ${String(-PAD)} ${String(diagram.w + PAD * 2)} ${String(diagram.h + PAD * 2)}`}
          width={diagram.w + PAD * 2}
        >
          <defs>
            <marker id={arrow} markerHeight="8" markerWidth="8" orient="auto" refX="7" refY="4">
              <path className={styles.head} d="M0,0 L8,4 L0,8 z" />
            </marker>
          </defs>
          {diagram.lines.map((line) => (
            <g
              className={styles.link}
              data-state={stateOf(line.from === lit || line.to === lit)}
              key={line.id}
            >
              <path className={styles.line} d={line.d} markerEnd={`url(#${arrow})`} />
              {line.label === '' ? null : (
                <text className={styles.label} textAnchor="middle" x={line.lx} y={line.ly - 6}>
                  {line.label}
                </text>
              )}
            </g>
          ))}
        </svg>
        {diagram.boxes.map((box) => (
          <Box box={box} key={box.id} onLight={setLit} state={stateOf(near.has(box.id))} />
        ))}
      </div>
    </div>
  );
}
