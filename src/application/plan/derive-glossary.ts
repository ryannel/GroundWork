import type { Core } from '@/application/plan/derive-core';
import type { createDomain } from '@/application/plan/derive-domain';
import { memo, str, uniq } from '@/application/plan/derive-values';
import { prop } from '@/application/plan/ids';

export interface GlossaryTerm {
  term: string;
  means: string;
  ref?: string;
  title?: string;
}

type Domain = typeof createDomain;

const escapeRe = (s: string): string => s.replaceAll(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`);
const ACRONYM = /^[A-Z][A-Z0-9]{1,5}$/;
const KIND_WITH_NAMES = new Set(['service', 'store', 'team', 'interface', 'system']);

type Sentence = (t: unknown) => string;

/** Text with [[id]] citations replaced by labels and inline markdown stripped (for tooltips). */
const plainer =
  (label: Core['label']) =>
  (t: unknown): string =>
    (typeof t === 'string' ? t : '')
      .replaceAll(/\[\[([^\]\s]{1,200})\]\]/g, (_, id: string) => label(id))
      .replaceAll(/\*\*|__|`/g, '')
      .trim();

const sentencer =
  (plainText: Sentence): Sentence =>
  (t) => {
    const x = plainText(t);
    return /^(.+?[.!?])(\s|$)/.exec(x)?.[1] ?? x;
  };

function conceptTerms(
  concepts: ReturnType<ReturnType<Domain>['domain']>['concepts'],
  firstSentence: Sentence,
) {
  return concepts.flatMap((c): GlossaryTerm[] => {
    const means = firstSentence(c.means);
    const alts = [c.name, ...(c.terms ?? [])];
    if (!/s$/i.test(c.name)) alts.push(`${c.name}s`);
    return alts.filter(Boolean).map((term) => ({ term, means, ref: c.id, title: c.name }));
  });
}

// services and systems named by an acronym (WMS, OMS, PIM) explain themselves on hover and open the thing
function acronymTerms({ asIs, toBe }: Core, firstSentence: Sentence): GlossaryTerm[] {
  const seen = new Set<string>();
  const out: GlossaryTerm[] = [];
  for (const n of [...toBe.byId.values(), ...asIs.byId.values()]) {
    const name = str(prop(n, 'name'));
    if (seen.has(n.id) || name === undefined || !ACRONYM.test(name)) continue;
    if (n.$type !== 'service' && n.$type !== 'system') continue;
    seen.add(n.id);
    const means = firstSentence(str(prop(n, 'does')) ?? str(prop(n, 'summary')) ?? '');
    if (means !== '') out.push({ term: name, means, ref: n.id, title: name });
  }
  return out;
}

// names of things that contain a concept word ("Order Service", "PIM API") are matched whole and left alone
function blockedNames({ asIs, toBe }: Core, known: GlossaryTerm[], seen: Set<string>): string[] {
  if (known.length === 0) return [];
  const names = [...asIs.byId.values(), ...toBe.byId.values()]
    .filter((n) => KIND_WITH_NAMES.has(n.$type))
    .map((n) => str(prop(n, 'name')))
    .filter((nm): nm is string => nm !== undefined && /[\s-]/.test(nm));
  return uniq(names).filter(
    (nm) =>
      !seen.has(nm.toLowerCase()) &&
      known.some((t) =>
        new RegExp(String.raw`(?<![\w-])${escapeRe(t.term)}(?![\w-])`, 'i').test(nm),
      ),
  );
}

interface Glossary {
  regex: RegExp | null;
  terms: GlossaryTerm[];
  block: string[];
  lookup: (match: string) => string | null;
}

function buildGlossary(core: Core, concepts: GlossaryTerm[], firstSentence: Sentence): Glossary {
  const own = (core.plan.problem.glossary ?? []).map((g) => ({ term: g.term, means: g.means }));
  const aterms = acronymTerms(core, firstSentence);
  const known = [...concepts, ...aterms];
  const seen = new Set(known.map((t) => t.term.toLowerCase()));
  const terms: GlossaryTerm[] = [
    ...concepts,
    ...aterms.filter((t) => !concepts.some((c) => c.term.toLowerCase() === t.term.toLowerCase())),
    ...own.filter((g) => !seen.has(g.term.toLowerCase())),
  ];
  if (terms.length === 0) return { regex: null, terms, block: [], lookup: () => null };
  const byKey = new Map(terms.map((g) => [g.term.toLowerCase(), g.means]));
  const alts = terms.toSorted((a, b) => b.term.length - a.term.length).map((g) => escapeRe(g.term));
  return {
    regex: new RegExp(String.raw`(?<![\w-])(${alts.join('|')})(?![\w-])`, 'gi'),
    terms,
    block: blockedNames(core, known, seen),
    lookup: (match) => byKey.get(match.toLowerCase()) ?? null,
  };
}

/** The words a reader may not know: concepts, acronyms and the plan's own glossary, as one matcher. */
export function createGlossary(core: Core, domain: ReturnType<Domain>['domain']) {
  const plainText = plainer(core.label);
  const firstSentence = sentencer(plainText);
  const glossaryTerms = memo(() =>
    buildGlossary(core, conceptTerms(domain().concepts, firstSentence), firstSentence),
  );
  return { plainText, firstSentence, glossaryTerms };
}
