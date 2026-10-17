// The Language page: the key terms the business has agreed on, above the domains, and the words each domain
// speaks, scanned from its code. Each row opens a side panel that says what the word means, where it lives in
// the systems, what each system calls it, and how well the code's word matches the business's.

import { type Place, type Places, placesOf, type Where } from '@/application/language-places';
import { firstSentence } from '@/application/plan-viz-text';
import { domainHref } from '@/application/workspace-paths';
import type { Concept } from '@/domain/plan/plan.generated';
import type { Workspace } from '@/domain/workspace';
import type {
  DomainLanguage,
  KeyTerm,
  KeyTerms,
  TermExample,
  TermFit,
} from '@/domain/workspace-model';
import { plain } from '@/shared/plain-text';

export interface TermRow {
  readonly id: string;
  readonly kind: 'key' | 'word';
  readonly name: string;
  /** The first sentence of what it means. */
  readonly gist: string;
  readonly aliases: readonly string[];
  /** The domains it lives in, by id, to filter on. */
  readonly domains: readonly string[];
  /** A key term's closest match in the code; null for a domain's word, or a key term not found yet. */
  readonly fit: TermFit | null;
  /** Lower-case text to search. */
  readonly text: string;
}

export interface TermPlace {
  readonly where: Where;
  /** The scanned word it is anchored to, if any. */
  readonly word: { readonly id: string; readonly name: string } | null;
  readonly fit: TermFit | null;
  readonly note: string | null;
}

/** What one part of the systems calls it. */
export interface TermName {
  readonly as: string;
  readonly in: string;
  readonly at: string | null;
  readonly note: string | null;
}

export interface TermLink {
  /** The row it opens; null when it names something not on the page. */
  readonly id: string | null;
  readonly name: string;
  readonly as: string;
}

export interface TermDetail {
  readonly id: string;
  readonly kind: 'key' | 'word';
  readonly name: string;
  readonly means: string;
  readonly group: string | null;
  readonly aliases: readonly string[];
  readonly examples: readonly TermExample[];
  readonly places: readonly TermPlace[];
  readonly names: readonly TermName[];
  readonly relates: readonly TermLink[];
  /** For a domain's word: the key terms anchored to it. */
  readonly keyTerms: readonly TermLink[];
}

export interface LanguagePage {
  readonly summary: string | null;
  readonly source: KeyTerms['source'];
  readonly groups: readonly {
    readonly id: string;
    readonly name: string;
    readonly terms: readonly TermRow[];
  }[];
  readonly words: readonly TermRow[];
  readonly domains: readonly Place[];
  readonly details: Readonly<Record<string, TermDetail>>;
  /** What each citation [[id]] in a meaning reads as. */
  readonly labels: Readonly<Record<string, string>>;
}

const CLOSEST: readonly TermFit[] = ['same', 'renamed', 'close', 'clash', 'lives-in'];

function closest(term: KeyTerm): TermFit | null {
  return CLOSEST.find((fit) => term.anchors.some((a) => a.fit === fit)) ?? null;
}

interface Lookup {
  readonly places: Places;
  readonly keyTerms: KeyTerms;
  readonly nameOf: (id: string) => string | null;
  /** What a citation [[id]] reads as. */
  readonly label: (id: string) => string;
}

function lookupOf(
  workspace: Workspace,
  languages: readonly DomainLanguage[],
  keyTerms: KeyTerms,
): Lookup {
  const places = placesOf(workspace, languages);
  const terms = new Map(keyTerms.terms.map((t) => [t.id, t.name]));
  const nameOf = (id: string): string | null =>
    terms.get(id) ?? places.words.get(id)?.concept.name ?? null;
  const label = (id: string): string => nameOf(id) ?? id.replace(/^[a-z]+:/u, '');
  return { places, keyTerms, nameOf, label };
}

function linkOf(lookup: Lookup, to: string, as: string): TermLink {
  const name = lookup.nameOf(to);
  return { id: name === null ? null : to, name: name ?? to, as };
}

function namesOf(lookup: Lookup, concept: Concept): TermName[] {
  return (concept.aka ?? []).map((aka) => {
    const where = lookup.places.of(aka.in);
    return {
      as: aka.as,
      in: where?.component ?? where?.system?.name ?? aka.in,
      at: aka.at ?? null,
      note: aka.note === undefined ? null : plain(aka.note, lookup.label),
    };
  });
}

function keyTermDetail(lookup: Lookup, term: KeyTerm): TermDetail {
  const words = term.anchors.flatMap((a) => {
    const word = lookup.places.words.get(a.to);
    return word === undefined ? [] : [word.concept];
  });
  const group = lookup.keyTerms.groups.find((g) => g.id === term.group);
  return {
    id: term.id,
    kind: 'key',
    name: term.name,
    means: term.means,
    group: group?.name ?? term.group,
    aliases: term.aliases,
    examples: term.examples,
    places: term.anchors.map((a) => {
      const word = lookup.places.words.get(a.to);
      return {
        where: lookup.places.of(a.to) ?? { domain: null, system: null, component: null },
        word: word === undefined ? null : { id: a.to, name: word.concept.name },
        fit: a.fit,
        note: a.note,
      };
    }),
    names: words.flatMap((c) => namesOf(lookup, c)),
    relates: term.relates.map((r) => linkOf(lookup, r.to, r.as)),
    keyTerms: [],
  };
}

function wordDetail(lookup: Lookup, concept: Concept): TermDetail {
  const anchored = lookup.keyTerms.terms.flatMap((t) =>
    t.anchors
      .filter((a) => a.to === concept.id)
      .map((a) => ({ id: t.id, name: t.name, as: a.fit })),
  );
  const where = lookup.places.of(concept.id);
  return {
    id: concept.id,
    kind: 'word',
    name: concept.name,
    means: concept.means,
    group: null,
    aliases: concept.terms ?? [],
    examples: [],
    places: where === null ? [] : [{ where, word: null, fit: null, note: null }],
    names: namesOf(lookup, concept),
    relates: (concept.relates ?? []).map((r) => linkOf(lookup, r.to, r.as)),
    keyTerms: anchored,
  };
}

function rowOf(lookup: Lookup, detail: TermDetail, fit: TermFit | null): TermRow {
  const domains = [
    ...new Set(
      detail.places.flatMap(({ where }) => (where.domain === null ? [] : [where.domain.id])),
    ),
  ];
  const names = detail.names.map((n) => n.as);
  const means = plain(detail.means, lookup.label);
  return {
    id: detail.id,
    kind: detail.kind,
    name: detail.name,
    gist: firstSentence(means),
    aliases: detail.aliases,
    domains,
    fit,
    text: [detail.name, ...detail.aliases, ...names, means].join(' ').toLowerCase(),
  };
}

const byName = (a: TermRow, b: TermRow): number => a.name.localeCompare(b.name);

function groupsOf(
  keyTerms: KeyTerms,
  rows: readonly (readonly [KeyTerm, TermRow])[],
): LanguagePage['groups'] {
  const named = new Set(keyTerms.groups.map((g) => g.id));
  const inGroup = (id: string | null) => rows.filter(([t]) => t.group === id).map(([, row]) => row);
  const loose = rows.filter(([t]) => t.group === null || !named.has(t.group)).map(([, row]) => row);
  return [
    ...keyTerms.groups.map((g) => ({ id: g.id, name: g.name, terms: inGroup(g.id) })),
    { id: 'other', name: 'Other key terms', terms: loose },
  ].filter((g) => g.terms.length > 0);
}

/** The key terms, in their groups, and every domain's words, each with what its side panel shows. */
export function languagePageOf(
  workspace: Workspace,
  languages: readonly DomainLanguage[],
  keyTerms: KeyTerms,
): LanguagePage {
  const lookup = lookupOf(workspace, languages, keyTerms);
  const keys = keyTerms.terms.map((t) => [t, keyTermDetail(lookup, t)] as const);
  const words = [...lookup.places.words.values()].map(({ concept }) => wordDetail(lookup, concept));
  return {
    summary: keyTerms.summary,
    source: keyTerms.source,
    groups: groupsOf(
      keyTerms,
      keys.map(([t, detail]) => [t, rowOf(lookup, detail, closest(t))] as const),
    ),
    words: words.map((d) => rowOf(lookup, d, null)).toSorted(byName),
    domains: workspace.domains.map((d) => ({
      id: d.id,
      name: d.name,
      href: domainHref(workspace.id, d.id),
    })),
    details: Object.fromEntries([...keys.map(([, d]) => d), ...words].map((d) => [d.id, d])),
    labels: Object.fromEntries([...keys.map(([, d]) => d), ...words].map((d) => [d.id, d.name])),
  };
}
