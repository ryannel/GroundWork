import { createElement, type ReactNode } from 'react';

import { ICON_SHAPES, type Shape } from './icon-shapes';
import styles from './icon.module.css';

export type IconName = keyof typeof ICON_SHAPES;

/** The text glyphs used across the app, mapped to their drawing. */
const BY_GLYPH: Readonly<Record<string, IconName>> = {
  '⧉': 'system',
  '▣': 'service',
  '◧': 'ui',
  '⏱': 'job',
  '◇': 'external',
  '⛁': 'database',
  '⇶': 'topic',
  '◍': 'cache',
  '▤': 'schema',
  '▭': 'field',
  '⊡': 'interface',
  '⇄': 'endpoint',
  '⚡': 'event',
  '➜': 'flow',
  '↳': 'step',
  Δ: 'change',
  '○': 'test',
  '#': 'ticket',
  '◆': 'milestone',
  '⚖': 'decision',
  '⚠': 'risk',
  '?': 'question',
  '❝': 'scenario',
  '●': 'team',
  '◈': 'concept',
  '▸': 'stage',
  '◫': 'screen',
  '▫': 'region',
  '⬢': 'graph',
  '⬡': 'subgraph',
  '⚿': 'key',
  '🔒': 'lock',
};

/** The drawing for a text glyph, or null when it has none. */
export const iconOf = (glyph: string): IconName | null => BY_GLYPH[glyph] ?? null;

/** The shapes of an icon, as children that need no keys: they never change, and a key would ship in every page. */
export function iconShapes(name: IconName): ReactNode[] {
  const shapes: readonly Shape[] = ICON_SHAPES[name];
  return shapes.map((shape) => createElement(shape.tag, shape.attrs));
}

// A small line drawing in the current text colour. Decorative: the word beside it carries the meaning. Stroke
// and fill come from the class, not attributes, because a page can hold hundreds of these.
export function Icon({ name }: { readonly name: IconName }) {
  return createElement(
    'svg',
    { 'aria-hidden': true, className: styles.icon, viewBox: '0 0 16 16' },
    ...iconShapes(name),
  );
}

/** A glyph drawn as its icon when it has one, else as the character. */
export function Glyph({ glyph }: { readonly glyph: string }) {
  const name = iconOf(glyph);
  return name === null ? glyph : <Icon name={name} />;
}
