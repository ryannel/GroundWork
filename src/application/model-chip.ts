import type { ModelIndex } from '@/application/model-index';
import type { ChipRef } from '@/application/today-scope';
import { kindOf } from '@/domain/ids';

const GLYPHS: Readonly<Record<string, string>> = {
  workspace: '⧉',
  domain: '⧉',
  system: '⧉',
  service: '▣',
  app: '◧',
  store: '⛁',
  topic: '⇶',
  external: '◇',
  library: '▣',
  team: '●',
  actor: '●',
  interface: '⊡',
  endpoint: '⇄',
  subscription: '⇶',
  job: '⏱',
  interaction: '☝',
  operation: '⇄',
  message: '⚡',
  schema: '▤',
  field: '▭',
  handler: 'ƒ',
  step: '↳',
  failure: '⚠',
  flow: '➜',
  journey: '➜',
  screen: '◫',
  region: '▫',
  graph: '⬢',
  subgraph: '⬡',
  concept: '◈',
  keyTerm: '◈',
  stage: '▸',
  change: 'Δ',
  test: '○',
  workItem: '#',
  milestone: '◆',
  decision: '⚖',
  risk: '⚠',
  question: '?',
  scenario: '❝',
  evidence: '↗',
};
const WORDS: Readonly<Record<string, string>> = {
  external: 'external party',
  keyTerm: 'key term',
  workItem: 'work item',
  targetShift: 'target shift',
};
const MONO = new Set(['endpoint', 'message', 'field', 'store', 'topic', 'operation']);

/** Naming and symbols describe declared kinds; they do not infer a deployable or owner. */
export function modelKindPresentation(kind: string): {
  readonly glyph: string;
  readonly word: string;
} {
  return { glyph: GLYPHS[kind] ?? '·', word: WORDS[kind] ?? kind };
}
export interface ModelChip extends ChipRef {
  readonly word: string;
  readonly missing: boolean;
}
/** A bounded label record from the chosen index, including an explicit unresolved state. */
export function modelChipOf(index: ModelIndex, id: string): ModelChip {
  const node = index.get(id);
  const kind = node?.kind ?? kindOf(id) ?? 'item';
  const presentation = modelKindPresentation(kind);
  return {
    id: node?.id ?? id,
    label: index.label(id),
    glyph: presentation.glyph,
    word: presentation.word,
    mono: MONO.has(kind),
    missing: node === null,
  };
}
