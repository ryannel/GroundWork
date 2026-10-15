import type { Model } from '@/application/plan/derive';
import { prop } from '@/application/plan/ids';
import { domainView } from '@/application/plan-viz-domain';
import { countWord, numWord } from '@/application/plan-viz-text';
import { andList, plural } from '@/application/plan-viz-waterfall-text';
import type { Concept } from '@/domain/plan/plan.generated';

// What the domain screen says: where the words are created, and which words the plan adds.

export interface DomainHead {
  readonly headline: string;
  readonly lede: string;
  /** The concepts the plan adds, which today's page leaves for the journeys. */
  readonly added: readonly { readonly id: string; readonly name: string }[];
  /** What the line says before and after the added words, which the page lists as buttons. */
  readonly addedBefore: string;
  readonly addedAfter: string;
}

const MOST_NAMED = 3;

const text = (value: unknown): string => (typeof value === 'string' ? value : '');

function byBirth(concepts: readonly Concept[]): [string, Concept[]] | undefined {
  const born = new Map<string, Concept[]>();
  for (const c of concepts) {
    if (c.born_in !== undefined) born.set(c.born_in, [...(born.get(c.born_in) ?? []), c]);
  }
  return [...born].toSorted((a, b) => b[1].length - a[1].length)[0];
}

const pluralName = (name: string): string =>
  name.endsWith('s') ? name.toLowerCase() : plural(name.toLowerCase());

function hubName(model: Model, hub: string): string {
  const does = (text(prop(model.asIs.get(hub), 'does')).split(/[.;]/)[0] ?? '').trim();
  const label = model.label(hub);
  if (does === '') return label;
  return `${label} (${does.charAt(0).toLowerCase()}${does.slice(1)})`;
}

function keeps(n: number): string {
  const [verb, whose] = n === 1 ? ['keeps', 'its'] : ['keep', 'their'];
  return `; ${countWord(n, 'other system')} ${verb} a copy under ${whose} own names`;
}

function headlineOf(model: Model, concepts: readonly Concept[]): string {
  const found = byBirth(concepts);
  if (found === undefined) return 'The plan uses a few words with a specific meaning.';
  const [hub, born] = found;
  const holders = new Set(
    concepts
      .flatMap((c) => (c.aka ?? []).map((a) => a.at))
      .filter((at) => at !== undefined && at !== hub),
  );
  const made = andList(born.slice(0, MOST_NAMED).map((c) => pluralName(c.name)));
  const keep = holders.size === 0 ? '' : keeps(holders.size);
  return `${hubName(model, hub)} is where ${made} are created${keep}.`;
}

export function domainHead(model: Model): DomainHead {
  const view = domainView(model, true);
  const added = view.added.map((c) => ({ id: c.id, name: c.name.toLowerCase() }));
  const one = added.length === 1;
  const count = one ? 'one word' : `${numWord(added.length)} words`;
  return {
    headline: headlineOf(model, view.concepts),
    lede: 'The plan uses these words. Click a concept to see where it lives and what each system calls it.',
    added,
    addedBefore: `This plan adds ${count}: `,
    addedAfter: `; you meet ${one ? 'it' : 'them'} in Journey.`,
  };
}
