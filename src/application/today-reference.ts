import type { Model } from '@/application/plan/derive';
import { refHead } from '@/application/plan-story-ref-words';
import { countWord } from '@/application/plan-viz-text';

// The reference of a workspace as it runs today: one catalogue per kind of thing its systems hold, only the
// kinds it has. The address names the kind in the workspace's words; the catalogue is the plan's.

const REFERENCE_KINDS = [
  'components',
  'stores',
  'apis',
  'schemas',
  'events',
  'flows',
  'screens',
  'operations',
] as const;

export type ReferenceKind = (typeof REFERENCE_KINDS)[number];

interface ReferenceEntry {
  readonly kind: ReferenceKind;
  readonly title: string;
  readonly count: number;
  /** The count in words: "41 components". */
  readonly size: string;
  /** What is true of the kind, as the catalogue's headline. */
  readonly headline: string;
  /** What the catalogue is for, in a sentence. */
  readonly lede: string;
}

interface KindWords {
  readonly title: string;
  /** The plan's name for the catalogue. */
  readonly plan: string;
  readonly lede: string;
  /** What one of them is called. */
  readonly one: string;
  readonly count: (model: Model) => number;
}

const WORDS: Readonly<Record<ReferenceKind, KindWords>> = {
  components: {
    title: 'Components',
    plan: 'services',
    one: 'component',
    lede: 'Every service, app and job that runs, grouped by the team that owns it, with what each owns, offers, announces and listens to.',
    count: (m) => m.asIs.services.length,
  },
  stores: {
    title: 'Stores',
    plan: 'stores',
    one: 'store',
    lede: 'Databases, warehouses and caches, with who owns each and who else reads or writes it; topics and queues apart, as they only carry events.',
    count: (m) => m.asIs.stores.length,
  },
  apis: {
    title: 'APIs',
    plan: 'apis',
    one: 'endpoint',
    lede: 'Every endpoint, grouped by the interface that serves it: its signature, who calls it and, opened, what it takes and returns.',
    count: (m) => m.asIs.endpoints.length,
  },
  schemas: {
    title: 'Schemas',
    plan: 'schemas',
    one: 'schema',
    lede: 'Records grouped by the store that holds them, then request bodies and event data, then the graph’s types.',
    count: (m) => m.asIs.schemas.length,
  },
  events: {
    title: 'Events',
    plan: 'events',
    one: 'event',
    lede: 'Messages on topics: who announces each, who listens and how it is delivered.',
    count: (m) => m.asIs.messages.length,
  },
  flows: {
    title: 'Flows',
    plan: 'flows',
    one: 'flow',
    lede: 'Every flow in one table: who sets it off, how many steps it takes, which teams it crosses and what it comes to.',
    count: (m) => m.asIs.flows.length,
  },
  screens: {
    title: 'Screens',
    plan: 'screens',
    one: 'screen',
    lede: 'What people see: pages, modals, emails and prints, grouped by the app that serves them.',
    count: (m) => m.asIs.screens.length,
  },
  operations: {
    title: 'Operations',
    plan: 'operations',
    one: 'operation',
    lede: 'What the front end asks the graph for, by screen: which teams own the answer and where it is cached.',
    count: (m) => m.asIs.operations.length,
  },
};

/** The kinds the workspace has, each with its count and words. */
export function referenceOf(model: Model): ReferenceEntry[] {
  return REFERENCE_KINDS.flatMap((kind) => {
    const words = WORDS[kind];
    const count = words.count(model);
    if (count === 0) return [];
    const { headline } = refHead(model, words.plan);
    return [
      {
        kind,
        title: words.title,
        count,
        size: countWord(count, words.one),
        headline,
        lede: words.lede,
      },
    ];
  });
}
