import type { Model } from '@/application/plan/derive';
import type { ElementStatus } from '@/application/plan/derive-core';
import { prop, typeOf } from '@/application/plan/ids';
import { cutAtWord, plain } from '@/shared/plain-text';

import { glyphOf, typeWord } from './plan-pages-entity';

// The hover card: what a thing is, at a glance, before the reader opens it. Its type, status and team, the first
// lines of what the plan does to it, and the gist of what it says.

export interface CardLine {
  readonly change: string;
  readonly summary: string;
}

export interface EntityCard {
  readonly glyph: string;
  readonly type: string;
  readonly name: string;
  readonly status: ElementStatus;
  /** The owning team's name, when it is not itself a team. */
  readonly team: string | null;
  readonly lines: readonly CardLine[];
  /** "2 changes · 1 work item", or null when the plan does no work on it. */
  readonly inPlan: string | null;
  readonly summary: string | null;
}

const SUMMARY_KEYS = [
  'summary',
  'description',
  'does',
  'why',
  'statement',
  'question',
  'logic',
  'outcome',
  'decision',
  'story',
  'notes',
];
const SUMMARY_MAX = 180;
const LINES_MAX = 4;

function count(n: number, word: string): string {
  if (n === 0) return '';
  return n === 1 ? `1 ${word}` : `${String(n)} ${word}s`;
}

function summaryOf(model: Model, node: unknown, name: string): string | null {
  const key = SUMMARY_KEYS.find((k) => typeof prop(node, k) === 'string');
  const raw = key === undefined ? null : prop(node, key);
  if (typeof raw !== 'string') return null;
  const text = plain(raw, (id) => (model.get(id) === undefined ? id : model.label(id)));
  return text === '' || text === name ? null : cutAtWord(text, SUMMARY_MAX);
}

/** The card for an id, or null when the plan has no such thing. */
export function entityCard(model: Model, id: string): EntityCard | null {
  const node = model.get(id);
  const type = typeOf(id);
  if (node === undefined || type === null) return null;
  const name = model.label(id);
  const team = type === 'team' ? null : model.ownerTeam(id);
  const inverse = model.inverse(id);
  const inPlan = [
    count(type === 'change' ? 0 : inverse.changes.length, 'change'),
    count(inverse.workItems.length, 'work item'),
  ]
    .filter((x) => x !== '')
    .join(' · ');
  return {
    glyph: glyphOf(id),
    type: typeWord(type, node),
    name,
    status: model.status(id) ?? 'existing',
    team: team === null ? null : model.label(team),
    lines: model
      .diff(id)
      .slice(0, LINES_MAX)
      .map((d) => ({ change: d.change, summary: d.summary })),
    inPlan: inPlan === '' ? null : inPlan,
    summary: summaryOf(model, node, name),
  };
}
