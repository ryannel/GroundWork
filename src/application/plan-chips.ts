import type { Model } from '@/application/plan/derive';
import type { ElementStatus } from '@/application/plan/derive-core';
import { prop, typeOf } from '@/application/plan/ids';
import { refLabel } from '@/application/plan/ref-label';
import { glyphOf } from '@/application/plan-pages-entity';
import type { EntityType } from '@/domain/plan/plan-ids';
import { TYPE_WORDS } from '@/domain/plan/plan-vocab';
import { clip, plain, plainTitle } from '@/shared/plain-text';

// How a chip names one thing in a plan: its glyph and type word (type is told by glyph and word, never by
// colour), its label, whether it reads in mono, and its status. Colour is kept for status alone.

export interface ChipInfo {
  readonly id: string;
  readonly label: string;
  readonly glyph: string;
  /** The type in words, with the kind when the plan gives one ("database", "modal"). */
  readonly word: string;
  readonly mono: boolean;
  readonly status: ElementStatus;
  /** The plan does not know this id. */
  readonly missing: boolean;
  /** "R1", "D3", "Q2": a risk, decision or question's place in the plan, or "". */
  readonly number: string;
}

const MONO = new Set<EntityType>(['endpoint', 'message', 'field', 'store', 'operation']);

type Kinds = Readonly<Record<string, readonly [glyph: string, word: string]>>;

const KINDS: Partial<Record<EntityType, Kinds>> = {
  service: {
    service: ['▣', 'service'],
    ui: ['◧', 'UI'],
    job: ['⏱', 'job'],
    external: ['◇', 'external system'],
  },
  store: {
    database: ['⛁', 'database'],
    warehouse: ['⛁', 'warehouse'],
    bucket: ['⛁', 'bucket'],
    topic: ['⇶', 'topic'],
    queue: ['⇶', 'queue'],
    cache: ['◍', 'cache'],
  },
  screen: {
    page: ['◫', 'page'],
    modal: ['◫', 'modal'],
    sheet: ['◫', 'sheet'],
    email: ['◫', 'email'],
    push: ['◫', 'push notification'],
    print: ['◫', 'printed document'],
  },
  schema: {
    record: ['▤', 'record'],
    dto: ['▤', 'request or response body'],
    payload: ['▤', 'event data'],
    'graph-type': ['▤', 'graph type'],
  },
  operation: {
    query: ['⇄', 'operation · query'],
    mutation: ['⇄', 'operation · mutation'],
    subscription: ['⇄', 'operation · subscription'],
  },
};

/** Where a chip draws a type differently from the inspector's heading. */
const OWN_GLYPHS: Partial<Record<EntityType, string>> = { store: '⛁', operation: '⇄' };

interface Kind {
  readonly glyph: string;
  readonly word: string;
}

function kindOf(id: string, entity: unknown): Kind {
  const type = typeOf(id);
  if (type === null) return { glyph: '·', word: 'item' };
  const base = { glyph: OWN_GLYPHS[type] ?? glyphOf(id), word: TYPE_WORDS[type] };
  const kind = prop(entity, 'kind');
  const layer = prop(entity, 'layer');
  if (type === 'store' && kind === 'cache' && typeof layer === 'string') {
    return { glyph: '◍', word: `${layer} cache` };
  }
  const found = typeof kind === 'string' ? KINDS[type]?.[kind] : undefined;
  return found === undefined ? base : { glyph: found[0], word: found[1] };
}

const NUMBERED: Readonly<
  Record<string, readonly [key: 'risks' | 'decisions' | 'questions', letter: string]>
> = {
  risk: ['risks', 'R'],
  dec: ['decisions', 'D'],
  q: ['questions', 'Q'],
};

/** "R1", "D3", "Q2": a risk, decision or question's position in the plan's own list, so every page agrees. */
function refNumber(model: Model, id: string): string {
  const numbered = NUMBERED[id.split(':')[0] ?? ''];
  if (numbered === undefined) return '';
  const list: unknown = model.plan[numbered[0]];
  const index = Array.isArray(list) ? list.findIndex((x) => prop(x, 'id') === id) : -1;
  return index < 0 ? '' : `${numbered[1]}${String(index + 1)}`;
}

/** The question itself: the sentence that ends in "?", without the context around it. */
export function questionTitle(text: string): string {
  const words = plain(text, refLabel);
  const end = words.indexOf('?');
  if (end === -1) return clip(words, refLabel, 90);
  const head = words.slice(0, end + 1);
  const starts = [...head.matchAll(/[.!:;]\s+(?=[A-Z])/gu)].map((m) => m.index + m[0].length);
  return clip(head.slice(starts.at(-1) ?? 0), refLabel, 110);
}

const text = (entity: unknown, key: string): string | null => {
  const value = prop(entity, key);
  return typeof value === 'string' ? value : null;
};

/** What a chip calls a thing: a risk or question by its gist, anything else by the model's label as plain text. */
function chipLabel(model: Model, id: string): string {
  const entity = model.get(id);
  if (entity === undefined) return id;
  const type = typeOf(id);
  if (type === 'risk') {
    return clip(text(entity, 'title') ?? text(entity, 'statement') ?? id, refLabel, 64);
  }
  if (type === 'question') {
    const title = text(entity, 'title');
    return title === null
      ? questionTitle(text(entity, 'question') ?? id)
      : clip(title, refLabel, 90);
  }
  return plainTitle(model.label(id), refLabel).replaceAll('`', '');
}

/** Everything a chip needs to name one thing. */
export function chipInfo(model: Model, id: string): ChipInfo {
  const entity = model.get(id);
  const type = typeOf(id);
  const { glyph, word } = kindOf(id, entity);
  return {
    id,
    label: chipLabel(model, id),
    glyph,
    word,
    mono: type !== null && MONO.has(type),
    status: model.status(id) ?? 'existing',
    missing: entity === undefined,
    number: refNumber(model, id),
  };
}

const STATUS_WORDS: Readonly<Record<ElementStatus, string>> = {
  existing: 'unchanged',
  added: 'new',
  modified: 'changed',
  deprecated: 'deprecated',
  removed: 'removed',
};

/** A status in the words the reader sees. */
export const statusWord = (status: ElementStatus): string => STATUS_WORDS[status];

/** What a screen reader hears for a chip: "service: Orders (new)". */
export function chipName(info: ChipInfo): string {
  const status = info.status === 'existing' ? '' : ` (${statusWord(info.status)})`;
  return `${info.word}: ${info.label}${status}`;
}
