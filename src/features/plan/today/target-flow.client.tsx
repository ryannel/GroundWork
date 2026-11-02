'use client';

import { type RefObject, useLayoutEffect, useRef, useState } from 'react';

import { CARD_W, type FlowCard, type TargetFlow } from '@/application/workspace-target-flow';
import { ZoomPane } from '@/features/plan/viz/zoompane/zoom-pane.client';
import {
  FlowCard as FlowCardBox,
  FlowCardRow,
  FlowLines,
  type FlowLit,
  type FlowTrace,
} from '@/ui/flow-card';
import { Legend } from '@/ui/legend';

import styles from './target-flow.module.css';

const KEY = [
  { label: 'feeds', line: 'solid' as const },
  { label: 'where the lanes meet', swatch: 'cur' as const },
  { label: 'Hover or focus a stage to trace it · click a system to read it' },
];

function litOf(card: FlowCard, active: FlowCard | null): FlowLit {
  if (active === null) return undefined;
  if (active.id === card.id) return 'on';
  return active.near.includes(card.id) ? 'near' : 'off';
}

/** Puts a card where the layout says; it is moved with the DOM because a style prop is not allowed. */
function placed(card: FlowCard) {
  return (el: HTMLElement | null): void => {
    if (el === null) return;
    el.style.setProperty('left', `${String(card.x)}px`);
    el.style.setProperty('top', `${String(card.y)}px`);
    el.style.setProperty('width', `${String(CARD_W)}px`);
    el.style.setProperty('height', `${String(card.h)}px`);
  };
}

/** What lights a card while the pointer or focus is on one of its parts. */
function tracing(id: string, onTrace: (id: string | null) => void): FlowTrace {
  const on = (): void => {
    onTrace(id);
  };
  const off = (): void => {
    onTrace(null);
  };
  return { onBlur: off, onFocus: on, onPointerEnter: on, onPointerLeave: off };
}

function Card({
  card,
  lit,
  onTrace,
}: {
  readonly card: FlowCard;
  readonly lit: FlowLit;
  readonly onTrace: (id: string | null) => void;
}) {
  const trace = tracing(card.id, onTrace);
  return (
    <div className={styles.slot} ref={placed(card)}>
      <FlowCardBox
        hub={card.hub}
        href={`#stage-${card.id}`}
        lit={lit}
        note={card.outside}
        title={card.title}
        trace={trace}
      >
        {card.owners.map((owner) => (
          <FlowCardRow
            glyph={owner.chip.glyph}
            inspect={owner.chip.id}
            key={owner.chip.id}
            lines={owner.lines}
            place={owner.place}
            trace={trace}
          />
        ))}
      </FlowCardBox>
    </div>
  );
}

/**
 * Shrinks the drawing to the width its frame was given (none when expanded, where the pane zooms instead), set on
 * the DOM because a style prop is not allowed.
 */
function useFit(
  refs: {
    readonly frame: RefObject<HTMLElement | null>;
    readonly stage: RefObject<HTMLElement | null>;
  },
  size: { readonly w: number; readonly h: number },
): void {
  const { frame, stage } = refs;
  const { w, h } = size;
  useLayoutEffect((): (() => void) | undefined => {
    const outer = frame.current;
    const inner = stage.current;
    if (outer === null || inner === null) return undefined;
    const fit = (): void => {
      const s = Math.min(1, outer.clientWidth / w);
      outer.style.setProperty('height', `${String(h * s)}px`);
      inner.style.setProperty('transform', `scale(${String(s)})`);
    };
    outer.style.setProperty('width', `${String(w)}px`);
    inner.style.setProperty('width', `${String(w)}px`);
    inner.style.setProperty('height', `${String(h)}px`);
    fit();
    const watch = new ResizeObserver(fit);
    watch.observe(outer);
    return (): void => {
      watch.disconnect();
    };
  }, [frame, stage, w, h]);
}

/** A domain's target as a flow: lanes of stages on the left that meet in a trunk running right. */
export function TargetFlowView({ flow }: { readonly flow: TargetFlow }) {
  const [traced, setTraced] = useState<string | null>(null);
  const frame = useRef<HTMLDivElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  useFit({ frame, stage }, flow);
  const active = flow.cards.find((card) => card.id === traced) ?? null;
  const lineLit = (from: string, to: string): FlowLit => {
    if (active === null) return undefined;
    return from === active.id || to === active.id ? 'on' : 'off';
  };
  return (
    <ZoomPane
      h={flow.h}
      label="Target flow, full screen"
      legend={<Legend items={KEY} />}
      w={flow.w}
      what="the flow"
    >
      <div className={styles.frame} ref={frame}>
        <div className={styles.canvas} ref={stage}>
          <div className={styles.lines}>
            <FlowLines
              id="target-flow-arrow"
              lines={flow.lines.map((line) => ({
                key: `${line.from}>${line.to}`,
                d: line.d,
                lit: lineLit(line.from, line.to),
              }))}
              size={flow}
            />
          </div>
          {flow.cards.map((card) => (
            <Card card={card} key={card.id} lit={litOf(card, active)} onTrace={setTraced} />
          ))}
        </div>
      </div>
    </ZoomPane>
  );
}
