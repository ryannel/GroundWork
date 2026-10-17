import type { Core } from '@/application/plan/derive-core';
import type { Domain } from '@/application/plan/derive-domain';
import { memo, textOf, uniq } from '@/application/plan/derive-values';
import { prop } from '@/application/plan/ids';

export interface GlossaryTerm {
  readonly term: string;
  readonly means: string;
  readonly ref?: string;
  readonly title?: string;
}

const ACRONYM = /^[A-Z][A-Z0-9]{1,5}$/u;
const KIND_WITH_NAMES = new Set(['service', 'store', 'team', 'interface', 'system']);

type Sentence = (t: unknown) => string;

export interface GlossaryQueries {
  /** Text with [[id]] citations replaced by labels and inline markdown stripped (for tooltips). */
  readonly plainText: Sentence;
  readonly firstSentence: Sentence;
  readonly glossaryTerms: () => Glossary;
}

/** A character that joins a word: a letter or digit of the basic Latin alphabet, an underscore or a hyphen. */
const joins = (ch: string | undefined): boolean => ch !== undefined && /[\w-]/u.test(ch);

/** The term that stands whole at `i` (nothing word-like either side), trying them in order; matched case-blind. */
function termAt(text: string, i: number, terms: readonly string[]): string | null {
  if (joins(text[i - 1])) return null;
  for (const term of terms) {
    const seen = text.slice(i, i + term.length);
    if (seen.toLowerCase() === term.toLowerCase() && !joins(text[i + term.length])) return seen;
  }
  return null;
}

/** Each whole-word use of the terms in the text, left to right, the first listed term winning at a place. */
function findTerms(text: string, terms: readonly string[]): string[] {
  const out: string[] = [];
  let i = 0;
  while (i <= text.length) {
    const seen = termAt(text, i, terms);
    if (seen !== null) out.push(seen);
    i += Math.max(seen?.length ?? 0, 1);
  }
  return out;
}

/** Text with [[id]] citations replaced by labels and inline markdown stripped (for tooltips). */
const plainer =
  (label: Core['label']) =>
  (t: unknown): string =>
    (typeof t === 'string' ? t : '')
      .replaceAll(/\[\[([^\]\s]{1,200})\]\]/gu, (_, id: string) => label(id))
      .replaceAll(/\*\*|__|`/gu, '')
      .trim();

const sentencer =
  (plainText: Sentence): Sentence =>
  (t) => {
    const x = plainText(t);
    return /^(.+?[.!?])(?:\s|$)/u.exec(x)?.[1] ?? x;
  };

function conceptTerms(concepts: Domain['concepts'], firstSentence: Sentence) {
  return concepts.flatMap((c): GlossaryTerm[] => {
    const means = firstSentence(c.means);
    const alts = [c.name, ...(c.terms ?? [])];
    if (!/s$/iu.test(c.name)) alts.push(`${c.name}s`);
    return alts.filter(Boolean).map((term) => ({ term, means, ref: c.id, title: c.name }));
  });
}

// services and systems named by an acronym (WMS, OMS, PIM) explain themselves on hover and open the thing
function acronymTerms({ asIs, toBe }: Core, firstSentence: Sentence): GlossaryTerm[] {
  const seen = new Set<string>();
  const out: GlossaryTerm[] = [];
  for (const n of [...toBe.byId.values(), ...asIs.byId.values()]) {
    const name = textOf(prop(n, 'name'));
    const named = name !== undefined && ACRONYM.test(name);
    if (seen.has(n.id) || !named || (n.$type !== 'service' && n.$type !== 'system')) continue;
    seen.add(n.id);
    const means = firstSentence(textOf(prop(n, 'does')) ?? textOf(prop(n, 'summary')) ?? '');
    if (means !== '') out.push({ term: name, means, ref: n.id, title: name });
  }
  return out;
}

// names of things that contain a concept word ("Order Service", "PIM API") are matched whole and left alone
function blockedNames(
  { asIs, toBe }: Core,
  known: readonly GlossaryTerm[],
  seen: ReadonlySet<string>,
): string[] {
  if (known.length === 0) return [];
  const names = [...asIs.byId.values(), ...toBe.byId.values()]
    .filter((n) => KIND_WITH_NAMES.has(n.$type))
    .map((n) => textOf(prop(n, 'name')))
    .filter((nm): nm is string => nm !== undefined && /[\s-]/u.test(nm));
  return uniq(names).filter(
    (nm) => !seen.has(nm.toLowerCase()) && known.some((t) => findTerms(nm, [t.term]).length > 0),
  );
}

export interface Glossary {
  /** Each use of a term in running text, left to right; the longest term wins where two start together. */
  readonly find: (text: string) => string[];
  readonly terms: readonly GlossaryTerm[];
  readonly block: readonly string[];
  readonly lookup: (match: string) => string | null;
}

function buildGlossary(
  core: Core,
  concepts: readonly GlossaryTerm[],
  firstSentence: Sentence,
): Glossary {
  const own = (core.plan.problem.glossary ?? []).map((g) => ({ term: g.term, means: g.means }));
  const aterms = acronymTerms(core, firstSentence);
  const known = [...concepts, ...aterms];
  const seen = new Set(known.map((t) => t.term.toLowerCase()));
  const terms: GlossaryTerm[] = [
    ...concepts,
    ...aterms.filter((t) => !concepts.some((c) => c.term.toLowerCase() === t.term.toLowerCase())),
    ...own.filter((g) => !seen.has(g.term.toLowerCase())),
  ];
  if (terms.length === 0) return { find: () => [], terms, block: [], lookup: () => null };
  const byKey = new Map(terms.map((g) => [g.term.toLowerCase(), g.means]));
  const alts = terms.toSorted((a, b) => b.term.length - a.term.length).map((g) => g.term);
  return {
    find: (text) => findTerms(text, alts),
    terms,
    block: blockedNames(core, known, seen),
    lookup: (match) => byKey.get(match.toLowerCase()) ?? null,
  };
}

/** The words a reader may not know: concepts, acronyms and the plan's own glossary, as one matcher. */
export function createGlossary(core: Core, domain: () => Domain): GlossaryQueries {
  const plainText = plainer(core.label);
  const firstSentence = sentencer(plainText);
  const glossaryTerms = memo(() =>
    buildGlossary(core, conceptTerms(domain().concepts, firstSentence), firstSentence),
  );
  return { plainText, firstSentence, glossaryTerms };
}
