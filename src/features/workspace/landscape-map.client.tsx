'use client';

import Link from 'next/link';
import { type RefObject, useEffect, useMemo, useRef, useState } from 'react';

import type { LandscapeMapInput, MapPath } from '@/application/landscape-map-input';
import { drawLandscape } from '@/application/landscape-map-layout';
import { pathBoxes, pathLines } from '@/application/landscape-map-rollup';
import type { LandDrawing } from '@/application/landscape-map-types';
import { Legend } from '@/ui/legend';

import { LandscapeBox, type Lit } from './landscape-box';
import { LandscapeLines } from './landscape-lines';
import styles from './landscape-map.module.css';

const LEGEND = [
  { label: 'Uses or calls', line: 'solid' },
  { label: 'Events', line: 'dashed' },
  { label: 'Reads and writes', line: 'dotted' },
] as const;

interface Lighting {
  readonly lines: ReadonlySet<string>;
  readonly boxes: ReadonlySet<string>;
}

/** What is lit: the chosen journey's way through, else what the resting box connects to, else nothing. */
function lightingOf(
  drawing: LandDrawing,
  at: { input: LandscapeMapInput; open: ReadonlySet<string> },
  focus: { path: MapPath | null; hover: string | null },
): Lighting | null {
  if (focus.path !== null) {
    const lines = pathLines(at.input, at.open, focus.path);
    return { lines, boxes: pathBoxes(lines) };
  }
  const { hover } = focus;
  if (hover === null) return null;
  const touching = drawing.lines.filter((l) => l.a === hover || l.b === hover);
  return {
    lines: new Set(touching.map((l) => l.id)),
    boxes: new Set([hover, ...touching.flatMap((l) => [l.a, l.b])]),
  };
}

const boxAt = (target: EventTarget | null): string | null => {
  const box = target instanceof Element ? target.closest<HTMLElement>('[data-box]') : null;
  return box?.dataset.box ?? null;
};

/** The box the pointer or the keyboard rests on, or null. */
function useResting(
  ref: RefObject<HTMLElement | null>,
): [string | null, (id: string | null) => void] {
  const [resting, setResting] = useState<string | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (el === null) return;
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
  return [resting, setResting];
}

function PathPicker(props: {
  readonly paths: readonly MapPath[];
  readonly chosen: MapPath | null;
  readonly onChoose: (key: string) => void;
}) {
  const { paths, chosen, onChoose } = props;
  const group = (kind: MapPath['kind'], label: string) => (
    <optgroup label={label}>
      {paths
        .filter((p) => p.kind === kind)
        .map((p) => (
          <option key={p.key} value={p.key}>
            {p.title}
          </option>
        ))}
    </optgroup>
  );
  return (
    <span className={styles.picker}>
      <label className={styles.label} htmlFor="landscape-path">
        Light up
      </label>
      <select
        className={styles.select}
        id="landscape-path"
        onChange={(event) => {
          onChoose(event.target.value);
        }}
        value={chosen?.key ?? ''}
      >
        <option value="">Nothing</option>
        {group('journey', 'User journeys')}
        {group('flow', 'Flows')}
      </select>
      {chosen === null ? null : (
        <Link className={styles.walk} href={chosen.href}>
          Walk it
        </Link>
      )}
    </span>
  );
}

// The landscape as one canvas. Folded, each domain is a box and the lines between them are the context map;
// open one and its systems take its place, with every line rolled up to whatever shows its ends.
export function LandscapeMap({ input }: { readonly input: LandscapeMapInput }) {
  const [open, setOpen] = useState<ReadonlySet<string>>(new Set());
  const canvas = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useResting(canvas);
  const [pathKey, setPathKey] = useState('');
  const drawing = useMemo(() => drawLandscape(input, open), [input, open]);
  const path = input.paths.find((p) => p.key === pathKey) ?? null;
  const lighting = lightingOf(drawing, { input, open }, { path, hover });
  const boxLit = (id: string, kind: string): Lit => {
    if (lighting === null || kind === 'frame') return undefined;
    return lighting.boxes.has(id) ? 'hot' : 'dim';
  };
  const lineLit = (id: string): Lit => {
    if (lighting === null) return undefined;
    return lighting.lines.has(id) ? 'hot' : 'dim';
  };
  const names = new Map(drawing.nodes.map((n) => [n.id, n.name]));
  const toggle = (id: string): void => {
    const next = new Set(open);
    if (!next.delete(id)) next.add(id);
    setOpen(next);
    setHover(null);
  };
  const all = input.domains.map((d) => d.id);
  return (
    <figure className={styles.map}>
      <div aria-label="Landscape controls" className={styles.toolbar} role="toolbar">
        <button
          className={styles.button}
          disabled={open.size === all.length}
          onClick={() => {
            setOpen(new Set(all));
          }}
          type="button"
        >
          Open every domain
        </button>
        <button
          className={styles.button}
          disabled={open.size === 0}
          onClick={() => {
            setOpen(new Set());
          }}
          type="button"
        >
          Fold every domain
        </button>
        <PathPicker chosen={path} onChoose={setPathKey} paths={input.paths} />
      </div>
      <div className={styles.scroll} ref={canvas}>
        <svg
          aria-label="The people, domains and outside services, and how they connect"
          className={styles.canvas}
          height={drawing.height}
          role="img"
          viewBox={`0 0 ${String(drawing.width)} ${String(drawing.height)}`}
          width={drawing.width}
        >
          {drawing.nodes
            .filter((n) => n.kind === 'frame')
            .map((n) => (
              <LandscapeBox
                key={n.id}
                lit={undefined}
                node={n}

                onToggle={toggle}
              />
            ))}
          <LandscapeLines
            labelled={path === null}
            lines={drawing.lines}
            lit={lineLit}
            name={(id) => names.get(id) ?? id}
          />
          {drawing.nodes
            .filter((n) => n.kind !== 'frame')
            .map((n) => (
              <LandscapeBox
                key={n.id}
                lit={boxLit(n.id, n.kind)}
                node={n}

                onToggle={toggle}
              />
            ))}
        </svg>
      </div>
      <figcaption className={styles.caption}>
        <Legend items={LEGEND} />
        <span>Open a domain to see its systems; rest on a box to light what it connects to.</span>
      </figcaption>
    </figure>
  );
}
