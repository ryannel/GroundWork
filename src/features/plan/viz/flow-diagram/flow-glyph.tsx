import { createElement } from 'react';

import { iconOf } from '@/ui/icon';
import { ICON_SHAPES } from '@/ui/icon-shapes';

import styles from './flow-glyph.module.css';

const SCALE = 0.75;

export interface FlowGlyphProps {
  /** The text glyph (`▣`, `⚡` …) whose drawing is wanted. */
  readonly glyph: string;
  readonly x: number;
  readonly y: number;
}

// The app's icon drawn inside a diagram, where an html svg cannot be placed by x and y. Twelve units square.
export function FlowGlyph({ glyph, x, y }: FlowGlyphProps) {
  const name = iconOf(glyph);
  if (name === null) return null;
  return (
    <g
      aria-hidden="true"
      className={styles.glyph}
      transform={`translate(${String(x)} ${String(y)}) scale(${String(SCALE)})`}
    >
      {ICON_SHAPES[name].map((shape) =>
        createElement(shape.tag, { key: Object.values(shape.attrs).join(' '), ...shape.attrs }),
      )}
    </g>
  );
}
