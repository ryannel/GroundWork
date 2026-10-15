import type { Model } from '@/application/plan/derive';
import { prop } from '@/application/plan/ids';
import { chipInfo } from '@/application/plan-chips';
import { teamIndex } from '@/application/plan-viz-teams';
import { modeKey, opPlan } from '@/application/plan-viz-waterfall-facts';

// An operation's document with each field name marked by the team that answers it, and the fields the gateway adds
// on its own marked as the gateway's. Everything between the names is copied as it was written.

export interface TintToken {
  text: string;
  /** The team's colour slot, for a field name some fetch answers. */
  slot?: number;
  /** The gateway added this field itself (a key, or an @requires). */
  router?: boolean;
  /** Which subgraph and team answer it; set on every tinted name. */
  title?: string;
}

interface Owner {
  team: string | null;
  subgraph: string | null;
  router: boolean;
}

type Kind =
  'comment' | 'string' | 'spread' | 'inline' | 'sigil' | 'ident' | 'brace' | 'space' | 'other';

// In the order they are tried: a comment or string before the punctuation it may contain, "... on T" before "...".
const PATTERNS: readonly (readonly [Kind, string])[] = [
  ['comment', String.raw`#[^\n]*`],
  ['string', String.raw`"(?:[^"\\]|\\.)*"?`],
  ['inline', String.raw`\.\.\. ?on [A-Za-z_]\w*`],
  ['spread', String.raw`\.\.\.\w*`],
  ['sigil', String.raw`[$@]\w+`],
  ['ident', String.raw`[A-Za-z_]\w*`],
  ['brace', '[(){}]'],
  ['space', String.raw`\s+`],
  ['other', String.raw`[\s\S]`],
];
const LEXEME = new RegExp(PATTERNS.map(([kind, src]) => `(?<${kind}>${src})`).join('|'), 'g');
const OPERATION = /^(?:query|mutation|subscription|fragment)$/;

interface Lexeme {
  kind: Kind;
  text: string;
}

function lex(text: string): Lexeme[] {
  return [...text.matchAll(LEXEME)].map((m) => {
    const kind = PATTERNS.find(([k]) => m.groups?.[k] !== undefined)?.[0] ?? 'other';
    return { kind, text: m[0] };
  });
}

/** Where the walk is: the response keys of the selection sets entered, and what was seen last. */
interface Walk {
  paren: number;
  /** Null for the operation's own braces and for inline fragments, which add nothing to a path. */
  stack: readonly (string | null)[];
  last: string | null;
  alias: string | null;
}

const START: Walk = { paren: 0, stack: [], last: null, alias: null };

function brace(w: Walk, ch: string): Walk {
  if (ch === '(') return { ...w, paren: w.paren + 1 };
  if (ch === ')') return { ...w, paren: Math.max(0, w.paren - 1) };
  if (w.paren > 0) return w;
  if (ch === '{') {
    const entered = w.last === '__op' ? null : w.last;
    return { ...w, stack: [...w.stack, entered], last: null };
  }
  return { ...w, stack: w.stack.slice(0, -1), last: null };
}

/** The walk after a name, and the dotted path of the response key it is when it is a field's. */
function named(w: Walk, word: string, aliased: boolean): { walk: Walk; path: string | null } {
  if (w.paren > 0) return { walk: w, path: null };
  if (w.stack.length === 0) {
    return { walk: OPERATION.test(word) ? { ...w, last: '__op' } : w, path: null };
  }
  if (aliased) return { walk: { ...w, alias: word }, path: null };
  // with an alias, the response key, which is what the path is made of, is the alias
  const key = w.alias ?? word;
  const path = [...w.stack.filter((x): x is string => x !== null), key].join('.');
  return { walk: { ...w, alias: null, last: key }, path };
}

function aliasFollows(lexemes: readonly Lexeme[], from: number): boolean {
  const next = lexemes.slice(from).find((l) => l.kind !== 'space' && l.kind !== 'comment');
  return next?.text === ':';
}

/** Each lexeme, with the path of the field it names when it names one. */
function walkDocument(lexemes: readonly Lexeme[]): { lexeme: Lexeme; path: string | null }[] {
  let w = START;
  return lexemes.map((lexeme, i) => {
    if (lexeme.kind === 'brace') w = brace(w, lexeme.text);
    else if (lexeme.kind === 'inline') w = { ...w, last: null };
    if (lexeme.kind !== 'ident') return { lexeme, path: null };
    const step = named(w, lexeme.text, aliasFollows(lexemes, i + 1));
    w = step.walk;
    return { lexeme, path: step.path };
  });
}

/** Adjacent plain runs joined, so a document is as few tokens as it can be. */
function merge(parts: readonly TintToken[]): TintToken[] {
  const out: TintToken[] = [];
  for (const part of parts) {
    const last = out.at(-1);
    if (part.title === undefined && last !== undefined && last.title === undefined) {
      out[out.length - 1] = { text: last.text + part.text };
    } else out.push(part);
  }
  return out;
}

function ownersOf(model: Model, id: string, mode: string): Map<string, Owner> {
  const plan = opPlan(model, id, mode);
  const owners = new Map<string, Owner>();
  for (const s of plan?.selected ?? []) {
    const fetch = plan?.fetches.find((x) => x.id === s.fetch);
    owners.set(s.path, {
      team: fetch?.team ?? null,
      subgraph: fetch?.subgraph ?? null,
      router: s.addedByRouter !== null,
    });
  }
  return owners;
}

function tintOf(model: Model, owner: Owner, name: string): TintToken {
  const slot = owner.team === null ? 0 : teamIndex(model, owner.team);
  const who = [owner.subgraph, owner.team].filter((x): x is string => x !== null);
  return {
    text: name,
    ...(slot > 0 ? { slot } : {}),
    ...(owner.router ? { router: true } : {}),
    title: who.map((x) => chipInfo(model, x).label).join(' · '),
  };
}

/**
 * The operation's document as runs of text, each field name tinted by the team that answers it. One plain run
 * when the operation has no plan to say who answers, and none when it has no document.
 */
export function tintedDocument(model: Model, id: string, mode?: string): TintToken[] {
  const m = modeKey(mode);
  const document = prop(model[m].get(id), 'document');
  const text = typeof document === 'string' ? document : '';
  if (text === '') return [];
  if (opPlan(model, id, m) === null) return [{ text }];
  const owners = ownersOf(model, id, m);
  const parts = walkDocument(lex(text)).map(({ lexeme, path }): TintToken => {
    const owner = path === null ? undefined : owners.get(path);
    return owner === undefined ? { text: lexeme.text } : tintOf(model, owner, lexeme.text);
  });
  return merge(parts);
}
