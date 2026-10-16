'use client';

import { useEffect, useRef, useState } from 'react';

import { entityCard, type EntityCard } from '@/application/plan-pages-entity-card';
import { pendingModel } from '@/features/plan/plan-model';
import { Badge } from '@/ui/badge';

import styles from './hover-card.module.css';
import { useHoverTarget } from './use-hover-target';

const GAP = 8;
const EDGE = 8;
const WIDTH = 300;
const SIGNS: Readonly<Record<string, string>> = {
  added: '+',
  add: '+',
  modified: '~',
  deprecated: '−',
  deprecate: '−',
  removed: '×',
  remove: '×',
};
const TONES = {
  added: 'added',
  modified: 'modified',
  deprecated: 'deprecated',
  removed: 'removed',
} as const;

/** Below the thing, or above it when there is no room below, and never off either side of the window. */
function place(card: HTMLElement, target: HTMLElement): void {
  const at = target.getBoundingClientRect();
  const height = card.offsetHeight;
  const below = at.bottom + GAP;
  const top = below + height > innerHeight - EDGE ? Math.max(EDGE, at.top - GAP - height) : below;
  const left = Math.min(Math.max(EDGE, at.left), Math.max(EDGE, innerWidth - WIDTH - EDGE));
  card.style.setProperty('--hc-top', `${String(Math.round(top))}px`);
  card.style.setProperty('--hc-left', `${String(Math.round(left))}px`);
}

function useCard(src: string, target: HTMLElement | null): EntityCard | null {
  const id = target?.dataset.inspect ?? null;
  const [read, setRead] = useState<{ id: string; card: EntityCard | null } | null>(null);
  useEffect(() => {
    if (id === null) return;
    let live = true;
    void pendingModel(src).model.then((model) => {
      if (live) setRead({ id, card: model === null ? null : entityCard(model, id) });
    });
    return () => {
      live = false;
    };
  }, [src, id]);
  return read !== null && read.id === id ? read.card : null;
}

function Body({ card, today }: { readonly card: EntityCard; readonly today: boolean }) {
  return (
    <>
      <p className={styles.kind}>
        <span aria-hidden="true">{card.glyph}</span> {card.type}
        {today || card.status === 'existing' ? null : (
          <Badge tone={TONES[card.status]}>{card.status}</Badge>
        )}
      </p>
      <p className={styles.name}>{card.name}</p>
      {card.team === null ? null : <p className={styles.team}>Owned by {card.team}</p>}
      {card.lines.length === 0 ? null : (
        <ul className={styles.lines}>
          {card.lines.map((line, i) => (
            <li data-change={line.change} key={`${line.summary}-${String(i)}`}>
              <span aria-hidden="true">{SIGNS[line.change] ?? '~'}</span> {line.summary}
            </li>
          ))}
        </ul>
      )}
      {today || card.inPlan === null ? null : (
        <p className={styles.team}>In this plan: {card.inPlan}</p>
      )}
      {card.summary === null ? null : <p className={styles.summary}>{card.summary}</p>}
      <p className={styles.foot}>Click to inspect</p>
    </>
  );
}

// A glance at a cited thing while the pointer or focus rests on it, as Plan Atlas gives. It never takes focus and
// is hidden from assistive tech, which reads the thing's own name and opens it with Enter. Read as today, it shows
// no status and nothing a plan does.
export function HoverCard({
  src,
  today = false,
}: {
  readonly src: string;
  readonly today?: boolean;
}) {
  const target = useHoverTarget();
  const card = useCard(src, target);
  const ref = useRef<HTMLDivElement>(null);
  const shown = target !== null && card !== null;
  useEffect(() => {
    if (shown && ref.current !== null) place(ref.current, target);
  }, [shown, target, card]);
  return (
    <div aria-hidden="true" className={styles.card} data-open={shown ? '' : undefined} ref={ref}>
      {shown ? <Body card={card} today={today} /> : null}
    </div>
  );
}
