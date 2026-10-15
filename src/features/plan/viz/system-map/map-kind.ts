// How a card says what kind of service it is: a glyph from the app's icon set and a word.

const KINDS = {
  service: { glyph: '▣', word: 'SERVICE' },
  ui: { glyph: '◧', word: 'UI' },
  job: { glyph: '⏱', word: 'JOB' },
  external: { glyph: '◇', word: 'EXTERNAL' },
} as const;

type KindName = keyof typeof KINDS;

const isKind = (kind: string): kind is KindName => kind in KINDS;

export function kindOf(kind: string): (typeof KINDS)[KindName] {
  return isKind(kind) ? KINDS[kind] : KINDS.service;
}
