import { typeOf } from '@/application/plan/ids';
import { levelWord, ROAM_GLOSS } from '@/application/plan-risk-words';

// Sorts the fields of one thing in a plan into what the inspector shows: its prose, short facts (a link when the
// value is an address), longer passages under their own heading, its picture and its evidence links.

export interface EntityFact {
  readonly label: string;
  readonly value: string;
  /** Where the fact links to, when it is an address. */
  readonly href: string | null;
}

export interface EntitySection {
  readonly label: string;
  /** Plan prose, which may cite [[id]]. */
  readonly text: string;
}

export interface EntitySource {
  readonly label: string;
  readonly href: string;
}

export interface Read {
  readonly text: string | null;
  readonly sections: readonly EntitySection[];
  readonly facts: readonly EntityFact[];
  /** The ids it points at, by field. */
  readonly links: readonly { readonly label: string; readonly ids: readonly string[] }[];
  /** A plan-relative path to its picture. */
  readonly image: string | null;
  readonly sources: readonly EntitySource[];
}

/** The fields that say what it is, best first: the first one present is its text. */
const PROSE = [
  'description',
  'does',
  'summary',
  'statement',
  'question',
  'why',
  'story',
  'text',
  'what',
  'notes',
];
const HIDDEN = new Set(['id', 'name', 'title', 'colour', 'color', 'image', 'sources', 'mockup']);
const FACT_MAX = 80;

const LABELS: Readonly<Record<string, string>> = {
  roam: 'Handling',
  context: 'Why',
  consequences: 'What it costs',
  figma: 'Design',
  accepted_by: 'Accepted with',
  about: 'About',
};

const LEVEL_KEYS = new Set(['likelihood', 'impact']);
const isLevel = (v: string): v is 'low' | 'med' | 'high' =>
  v === 'low' || v === 'med' || v === 'high';

const humanise = (key: string): string =>
  LABELS[key] ?? key.replaceAll('_', ' ').replace(/^./u, (c) => c.toUpperCase());

const isUrl = (value: string): boolean => /^https?:\/\/\S+$/u.test(value);

/** What a fact says: a level in words, a handling word with what it means, an address as where it goes. */
function factValue(key: string, value: string): string {
  if (LEVEL_KEYS.has(key) && isLevel(value)) return levelWord(value);
  if (key === 'roam') {
    const gloss = ROAM_GLOSS[value];
    return gloss === undefined ? value : `${value}: ${gloss}`;
  }
  if (key === 'figma' && isUrl(value)) return 'Open in Figma';
  return isUrl(value) ? new URL(value).hostname : value;
}

const GITHUB_BLOB = /^https:\/\/github\.com\/[^/]+\/([^/]+)\/blob\/[^/]+\/(.+)$/u;

/** A source as its label, or repo · path#line for a GitHub permalink, or the address. */
function sourceOf(value: unknown): EntitySource | null {
  if (typeof value !== 'object' || value === null || !('url' in value)) return null;
  const { url } = value;
  if (typeof url !== 'string') return null;
  const label = 'label' in value && typeof value.label === 'string' ? value.label : null;
  const blob = GITHUB_BLOB.exec(url);
  const fallback =
    blob === null ? url.replace(/^https?:\/\//u, '') : `${blob[1] ?? ''} · ${blob[2] ?? ''}`;
  return { label: label ?? fallback, href: url };
}

export const idsIn = (value: unknown): string[] => {
  const list: unknown[] = Array.isArray(value) ? value : [value];
  return list.filter((v): v is string => typeof v === 'string' && typeOf(v) !== null);
};

const isScalar = (value: unknown): value is string | number | boolean =>
  typeof value === 'boolean' || typeof value === 'number' || typeof value === 'string';

type Field =
  | { readonly to: 'links'; readonly link: Read['links'][number] }
  | { readonly to: 'sections'; readonly section: EntitySection }
  | { readonly to: 'facts'; readonly fact: EntityFact };

/** A field that is not prose, the picture or sources: ids it points at, a long passage, or a short fact. */
function readField(key: string, value: unknown): Field | null {
  const ids = idsIn(value);
  if (ids.length > 0 && (!Array.isArray(value) || ids.length === value.length)) {
    return { to: 'links', link: { label: humanise(key), ids } };
  }
  if (!isScalar(value)) return null;
  const text = String(value);
  if (typeof value === 'string' && text.length > FACT_MAX && !isUrl(text)) {
    return { to: 'sections', section: { label: humanise(key), text } };
  }
  return {
    to: 'facts',
    fact: { label: humanise(key), value: factValue(key, text), href: isUrl(text) ? text : null },
  };
}

/** Sorts what the thing carries: prose, short facts, passages, ids it points at, its picture and sources. */
export function readEntries(node: object): Read {
  const record: Record<string, unknown> = { ...node };
  const [first, ...rest] = PROSE.filter((key) => typeof record[key] === 'string');
  const { image, sources } = record;
  const listed = Array.isArray(sources) ? sources.map(sourceOf) : [];
  const fields = Object.entries(record)
    .filter(([key]) => !HIDDEN.has(key) && !key.startsWith('$') && !PROSE.includes(key))
    .flatMap(([key, value]) => readField(key, value) ?? []);
  return {
    text: first === undefined ? null : String(record[first]),
    sections: [
      ...rest.map((key) => ({ label: humanise(key), text: String(record[key]) })),
      ...fields.flatMap((field) => (field.to === 'sections' ? [field.section] : [])),
    ],
    facts: fields.flatMap((field) => (field.to === 'facts' ? [field.fact] : [])),
    links: fields.flatMap((field) => (field.to === 'links' ? [field.link] : [])),
    image: typeof image === 'string' ? image : null,
    sources: listed.filter((x): x is EntitySource => x !== null),
  };
}
