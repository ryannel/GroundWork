import type { Model } from '@/application/plan/derive';
import type { Concept } from '@/domain/plan/plan.generated';

// The domain as the plan tells it: concept cards, and what each system calls the same thing.

type Aka = NonNullable<Concept['aka']>[number];

export interface Relation {
  /** "part of", "has", or the plan's own verb phrase. */
  readonly as: string;
  readonly to: string;
}

export interface ConceptCard {
  readonly id: string;
  readonly name: string;
  /** Markdown. */
  readonly means: string;
  /** The plan introduces it. */
  readonly isNew: boolean;
  readonly bornIn: string | null;
  readonly relations: readonly Relation[];
}

export interface NameCell {
  /** Where its id is minted. */
  readonly born: boolean;
  readonly names: readonly {
    readonly as: string;
    readonly at: string | null;
    readonly note: string;
  }[];
}

export interface NameRow {
  readonly id: string;
  readonly name: string;
  readonly cells: readonly NameCell[];
}

export interface NameLine {
  readonly id: string;
  readonly name: string;
  readonly names: readonly {
    readonly as: string;
    readonly at: string | null;
    readonly systems: readonly string[];
  }[];
}

export interface NamesPlan {
  readonly kind: 'none' | 'table' | 'lines';
  readonly columns: readonly string[];
  readonly rows: readonly NameRow[];
  readonly lines: readonly NameLine[];
}

/** A table needs this share of its cells filled to beat a sentence: below it the page would be mostly dots. */
const NAMES_DENSE = 0.5;

export interface DomainView {
  readonly summary: string;
  readonly concepts: readonly Concept[];
  /** Concepts the plan introduces; only set when reading today. */
  readonly added: readonly Concept[];
}

const isNewConcept = (c: Concept): boolean => (c.introduced_by ?? []).length > 0;

function todays(c: Concept, has: (id: string | undefined) => boolean): Concept {
  const { born_in: born, ...rest } = c;
  const aka = (c.aka ?? []).filter((a) => has(a.at));
  return born !== undefined && has(born) ? { ...rest, born_in: born, aka } : { ...rest, aka };
}

/**
 * The domain; with `today`, only what runs today: no concept the plan introduces, and no name that points at
 * something the plan adds.
 */
export function domainView(model: Model, today: boolean): DomainView {
  const concepts = model.plan.domain?.concepts ?? [];
  const summary = model.plan.domain?.summary ?? '';
  if (!today) return { summary, concepts, added: [] };
  const has = (id: string | undefined): boolean => id === undefined || model.asIs.has(id);
  return {
    summary,
    concepts: concepts.filter((c) => !isNewConcept(c)).map((c) => todays(c, has)),
    added: concepts.filter(isNewConcept),
  };
}

function relationsOf(
  concept: Concept,
  all: readonly Concept[],
  keep: (id: string) => boolean,
): Relation[] {
  const out: Relation[] = [];
  if (concept.part_of !== undefined && keep(concept.part_of))
    out.push({ as: 'part of', to: concept.part_of });
  for (const r of concept.relates ?? []) if (keep(r.to)) out.push({ as: r.as, to: r.to });
  for (const other of all) {
    if (other.part_of === concept.id && keep(other.id)) out.push({ as: 'has', to: other.id });
  }
  return out;
}

/** One card per concept: name, meaning, where it is created, relations. */
export function conceptCards(domain: DomainView): ConceptCard[] {
  const known = new Set(domain.concepts.map((c) => c.id));
  const keep = (id: string): boolean => !id.startsWith('con:') || known.has(id);
  return domain.concepts.map((c) => ({
    id: c.id,
    name: c.name,
    means: c.means,
    isNew: isNewConcept(c),
    bornIn: c.born_in ?? null,
    relations: relationsOf(c, domain.concepts, keep),
  }));
}

const squash = (s: string): string => s.toLowerCase().replaceAll(/[^a-z0-9]/g, '');

const systemsOf = (c: Concept): string[] => [
  ...new Set(
    [c.born_in, ...(c.aka ?? []).map((a) => a.in)].filter(
      (x): x is string => x !== undefined && x !== '',
    ),
  ),
];

function cellOf(c: Concept, system: string): NameCell {
  return {
    born: c.born_in === system,
    names: (c.aka ?? [])
      .filter((a: Aka) => a.in === system)
      .map((a) => ({ as: a.as, at: a.at ?? null, note: a.note ?? '' })),
  };
}

function secondNames(c: Concept): NameLine['names'] {
  const byName = new Map<string, { as: string; at: string | null; systems: string[] }>();
  for (const a of c.aka ?? []) {
    if (a.as === '' || squash(a.as) === squash(c.name)) continue;
    const key = a.as.toLowerCase();
    const entry = byName.get(key) ?? { as: a.as, at: a.at ?? null, systems: [] };
    if (a.in !== '' && !entry.systems.includes(a.in)) entry.systems.push(a.in);
    byName.set(key, entry);
  }
  return [...byName.values()];
}

/**
 * What the "same thing, different names" part says. Only a concept with a name in two or more systems (where it is
 * created counts) gets a row. With two or more such rows the names are a table, unless it would be mostly empty;
 * otherwise each concept with a second name gets one sentence.
 */
export function namesPlan(model: Model, domain: DomainView): NamesPlan {
  const rows = domain.concepts.filter((c) => systemsOf(c).length >= 2);
  const rank = (id: string): number => {
    const stage = model.domain().stageOf(id);
    const at = stage === null ? -1 : model.domain().stageIndex(stage);
    return at < 0 ? 99 : at;
  };
  const columns = [...new Set(rows.flatMap(systemsOf))].toSorted((a, b) => rank(a) - rank(b));
  const filled = rows.reduce((n, c) => n + systemsOf(c).length, 0);
  const fill = rows.length > 0 && columns.length > 0 ? filled / (rows.length * columns.length) : 0;
  const lines = domain.concepts
    .map((c) => ({ id: c.id, name: c.name, names: secondNames(c) }))
    .filter((line) => line.names.length > 0);
  const table = rows.length >= 2 && fill >= NAMES_DENSE;
  const loose = lines.length > 0 ? 'lines' : 'none';
  return {
    kind: table ? 'table' : loose,
    columns,
    rows: table
      ? rows.map((c) => ({ id: c.id, name: c.name, cells: columns.map((s) => cellOf(c, s)) }))
      : [],
    lines: table ? [] : lines,
  };
}
