'use client';

import { type RefObject, useEffect, useLayoutEffect, useRef, useState } from 'react';

import { type DomainMap, lineWordsOf } from '@/application/landscape-domains';
import type { MapDrawing } from '@/application/landscape-domains-layout';
import { Legend } from '@/ui/legend';

import { CustomerBox, DomainBox, type Lit } from './landscape-box';
import { LandscapeLines } from './landscape-lines';
import styles from './landscape-map.module.css';
import { PersonJourneys } from './person-journeys.client';

const LEGEND = [
  { label: 'Calls', line: 'solid' },
  { label: 'Events', line: 'dashed' },
  { label: 'Reads and writes', line: 'dotted' },
] as const;

interface Lighting {
  readonly lines: ReadonlySet<string>;
  readonly boxes: ReadonlySet<string>;
}

interface Focus {
  readonly person: string | null;
  readonly journey: string | null;
  readonly hover: string | null;
}

const endsOf = (map: DomainMap, lines: ReadonlySet<string>): string[] =>
  map.links.filter((l) => lines.has(l.id)).flatMap((l) => [l.a, l.b]);

/** What is lit: the chosen journey, else everything the chosen person's journeys touch, else what the resting box
 * connects to, else nothing. */
function lightingOf(map: DomainMap, focus: Focus): Lighting | null {
  const journey = map.journeys.find((j) => j.key === focus.journey);
  if (journey !== undefined) {
    const lines = new Set(journey.lines);
    return { lines, boxes: new Set([...journey.domains, ...endsOf(map, lines)]) };
  }
  const person = map.people.find((p) => p.id === focus.person);
  if (person !== undefined) {
    const theirs = map.journeys.filter((j) => j.actor === person.id);
    const lines = new Set(theirs.flatMap((j) => j.lines));
    const own = person.customer ? [person.id] : [];
    const boxes = [
      ...own,
      ...person.domains,
      ...theirs.flatMap((j) => j.domains),
      ...endsOf(map, lines),
    ];
    return { lines, boxes: new Set(boxes) };
  }
  const { hover } = focus;
  if (hover === null) return null;
  const touching = map.links.filter((l) => l.a === hover || l.b === hover);
  return {
    lines: new Set(touching.map((l) => l.id)),
    boxes: new Set([hover, ...touching.flatMap((l) => [l.a, l.b])]),
  };
}

const idle = (): void => {
  // nothing to undo
};

/** Fits now and again whenever the element's width changes; returns the way to stop. */
function watchWidth(el: HTMLElement, fit: () => void): () => void {
  fit();
  const watch = typeof ResizeObserver === 'function' ? new ResizeObserver(fit) : null;
  watch?.observe(el);
  return () => {
    watch?.disconnect();
  };
}

const boxAt = (target: EventTarget | null): string | null => {
  const box = target instanceof Element ? target.closest<HTMLElement>('[data-box]') : null;
  return box?.dataset.box ?? null;
};

/** The box the pointer or the keyboard rests on, or null. */
function useResting(ref: RefObject<HTMLElement | null>): string | null {
  const [resting, setResting] = useState<string | null>(null);
  useEffect((): (() => void) | undefined => {
    const el = ref.current;
    if (el === null) return idle;
    const rest = (event: Event): void => {
      setResting(boxAt(event.target));
    };
    const leave = (): void => {
      setResting(null);
    };
    el.addEventListener('pointerover', rest);
    el.addEventListener('focusin', rest);
    el.addEventListener('pointerleave', leave);
    el.addEventListener('focusout', leave);
    return () => {
      el.removeEventListener('pointerover', rest);
      el.removeEventListener('focusin', rest);
      el.removeEventListener('pointerleave', leave);
      el.removeEventListener('focusout', leave);
    };
  }, [ref]);
  return resting;
}

// Narrower than this and the words in the boxes are too small to read, so the canvas scrolls instead.
const READABLE = 760;

/** Shrinks the drawing to fit the page, set on the DOM because a style prop is not allowed. */
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
    if (outer === null || inner === null) return idle;
    const fit = (): void => {
      const s = Math.min(1, Math.max(outer.clientWidth, READABLE) / w);
      inner.style.setProperty('transform', `scale(${String(s)})`);
      inner.style.setProperty('width', `${String(w)}px`);
      inner.style.setProperty('height', `${String(h)}px`);
      inner.style.setProperty('margin-right', `${String(w * s - w)}px`);
      inner.style.setProperty('margin-bottom', `${String(h * s - h)}px`);
    };
    return watchWidth(outer, fit);
  }, [frame, stage, w, h]);
}

const litBy =
  (lighting: Lighting | null, of: 'lines' | 'boxes') =>
  (id: string): Lit => {
    if (lighting === null) return undefined;
    return lighting[of].has(id) ? 'hot' : 'dim';
  };

// The landscape as one canvas: the customer on the left, each domain a box with its people inside, and a line for
// everything that runs between two domains. Pick a person to light where their journeys go and list them; pick one
// of those to light just that journey, and open it in the explorer.
export function LandscapeMap({
  map,
  drawing,
}: {
  readonly map: DomainMap;
  readonly drawing: MapDrawing;
}) {
  const canvas = useRef<HTMLDivElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const hover = useResting(canvas);
  const [person, setPerson] = useState<string | null>(null);
  const [journey, setJourney] = useState<string | null>(null);
  const lighting = lightingOf(map, { person, journey, hover: person === null ? hover : null });
  useFit({ frame: canvas, stage }, { w: drawing.width, h: drawing.height });
  const people = new Map(map.people.map((p) => [p.id, p]));
  const domains = new Map(map.domains.map((d) => [d.id, d]));
  const links = new Map(map.links.map((l) => [l.id, l]));
  const nameOf = (id: string): string => domains.get(id)?.name ?? people.get(id)?.name ?? id;
  const pick = (id: string): void => {
    setPerson(person === id ? null : id);
    setJourney(null);
  };
  const picked = person === null ? undefined : people.get(person);
  const boxLit = litBy(lighting, 'boxes');
  return (
    <div className={styles.map} data-picked={picked === undefined ? undefined : ''}>
      <figure className={styles.figure}>
        <div className={styles.scroll} ref={canvas}>
          <div className={styles.stage} ref={stage}>
            <svg
              aria-label="The customer, the domains and the people in them, and how the domains connect"
              className={styles.canvas}
              height={drawing.height}
              role="img"
              viewBox={`0 0 ${String(drawing.width)} ${String(drawing.height)}`}
              width={drawing.width}
            >
              <LandscapeLines
                label={(id) => {
                  const link = links.get(id);
                  return link === undefined ? { short: '', full: '' } : lineWordsOf(link, nameOf);
                }}
                labelled={journey === null}
                lines={drawing.lines}
                lit={litBy(lighting, 'lines')}
              />
            </svg>
            {drawing.boxes.map((box) => {
              const domain = domains.get(box.id);
              if (domain !== undefined) {
                return (
                  <DomainBox
                    box={box}
                    domain={domain}
                    key={box.id}
                    lit={boxLit(box.id)}
                    onPick={pick}
                    people={domain.people.flatMap((id) => people.get(id) ?? [])}
                    picked={person}
                  />
                );
              }
              const customer = people.get(box.id);
              return customer === undefined ? null : (
                <CustomerBox
                  box={box}
                  key={box.id}
                  lit={boxLit(box.id)}
                  onPick={pick}
                  person={customer}
                  picked={person}
                />
              );
            })}
          </div>
        </div>
        <figcaption className={styles.caption}>
          <Legend items={LEGEND} />
          <span>
            Rest on a domain to light what it connects to; pick a person to see their journeys.
          </span>
        </figcaption>
      </figure>
      {picked === undefined ? null : (
        <aside className={styles.side}>
          <PersonJourneys
            domainName={nameOf}
            journeys={map.journeys.filter((j) => j.actor === picked.id)}
            key={picked.id}
            lighting={{ chosen: journey, onChoose: setJourney }}
            onClose={() => {
              pick(picked.id);
            }}
            person={picked}
          />
        </aside>
      )}
    </div>
  );
}
