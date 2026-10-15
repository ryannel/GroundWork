import { createElement } from 'react';

import { ICON_SHAPES } from './icon-shapes';
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

// A small line drawing in the current text colour. Decorative: the word beside it carries the meaning.
export function Icon({ name }: { readonly name: IconName }) {
  return (
    <svg
      aria-hidden="true"
      className={styles.icon}
      data-icon={name}
      fill="none"
      focusable="false"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.4"
      viewBox="0 0 16 16"
    >
      {ICON_SHAPES[name].map((shape) =>
        createElement(shape.tag, { key: Object.values(shape.attrs).join(' '), ...shape.attrs }),
      )}
    </svg>
  );
}

/** A glyph drawn as its icon when it has one, else as the character. */
export function Glyph({ glyph }: { readonly glyph: string }) {
  const name = iconOf(glyph);
  return name === null ? glyph : <Icon name={name} />;
}
