import type { Model } from '@/application/plan/derive';
import type { ElementStatus } from '@/application/plan/derive-core';
import { prop, typeOf } from '@/application/plan/ids';
import type { EntityType } from '@/domain/plan/plan-ids';
import { TYPE_WORDS } from '@/domain/plan/plan-vocab';

import {
  idsIn,
  readEntries,
  type EntityFact,
  type EntitySection,
  type EntitySource,
} from './plan-pages-entity-read';
import { mentionsOf } from './plan-pages-entity-where';

// What the inspector shows for one thing in a plan: what it is, who owns it, what it says, what it points at,
// what points at it, and what the plan does to it. Built from the model, so a page and the browser agree.

const GLYPHS: Readonly<Record<EntityType, string>> = {
  team: '●',
  system: '⧉',
  service: '▣',
  store: '▤',
  schema: '▤',
  field: '▭',
  interface: '⊡',
  endpoint: '⇄',
  message: '⚡',
  flow: '➜',
  step: '↳',
  change: 'Δ',
  test: '○',
  workItem: '#',
  milestone: '◆',
  decision: '⚖',
  risk: '⚠',
  question: '?',
  scenario: '❝',
  concept: '◈',
  stage: '▸',
  screen: '◫',
  region: '▫',
  graph: '⬢',
  subgraph: '⬡',
  operation: '⬡',
  interaction: '☝',
  userJourney: '➜',
  handler: 'ƒ',
};

export function glyphOf(id: string): string {
  const type = typeOf(id);
  return type === null ? '·' : GLYPHS[type];
}

export interface EntityRef {
  readonly id: string;
  readonly label: string;
  readonly glyph: string;
  readonly status: ElementStatus;
}

export interface EntityGroup {
  readonly label: string;
  readonly refs: readonly EntityRef[];
}

export type { EntityFact, EntitySection, EntitySource } from './plan-pages-entity-read';

export interface EntityChange {
  readonly changeId: string | null;
  readonly kind: string;
  readonly summary: string;
}

export interface EntityView {
  readonly id: string;
  readonly glyph: string;
  readonly type: string;
  readonly name: string;
  readonly status: ElementStatus;
  /** Whether it reads the same today and with the plan (decisions, risks, work…), so there is no today to show. */
  readonly planLevel: boolean;
  readonly owner: readonly EntityRef[];
  /** The prose the plan gives it (description, why, summary), when it has any; it may cite [[id]]. */
  readonly text: string | null;
  /** Longer passages under their own heading (mitigation, why, what it costs). */
  readonly sections: readonly EntitySection[];
  readonly facts: readonly EntityFact[];
  /** A plan-relative path to its picture. */
  readonly image: string | null;
  readonly sources: readonly EntitySource[];
  /** What it points at. */
  readonly uses: readonly EntityGroup[];
  /** What plan work happens to it. */
  readonly changes: readonly EntityChange[];
  /** What points at it. */
  readonly usedBy: readonly EntityGroup[];
  /** The things whose prose cites it. */
  readonly mentionedIn: readonly EntityRef[];
  /** Parts of the plan without an id of their own that cite it. */
  readonly mentionedParts: readonly string[];
}

function refOf(model: Model, id: string): EntityRef {
  return { id, label: model.label(id), glyph: glyphOf(id), status: model.status(id) ?? 'existing' };
}

const INVERSE_LABELS: readonly (readonly [string, string])[] = [
  ['steps', 'Steps that use it'],
  ['flows', 'Flows that use it'],
  ['endpoints', 'Carried by endpoints'],
  ['messages', 'Carried by events'],
  ['scenarios', 'Scenarios'],
  ['changes', 'Changes that touch it'],
  ['decisions', 'Decisions'],
  ['questions', 'Questions waiting on it'],
  ['risks', 'Risks'],
  ['workItems', 'Work items'],
  ['tests', 'Tests'],
];

function usedByOf(model: Model, id: string): EntityGroup[] {
  const inverse: Record<string, unknown> = { ...model.inverse(id) };
  return INVERSE_LABELS.flatMap(([key, label]) => {
    const ids = idsIn(inverse[key]);
    return ids.length === 0 ? [] : [{ label, refs: ids.map((i) => refOf(model, i)) }];
  });
}

const ownerOf = (model: Model, id: string): EntityRef[] =>
  [model.ownerTeam(id), model.ownerService(id)]
    .filter((owner): owner is string => owner !== null && owner !== id)
    .map((owner) => refOf(model, owner));

const changesOf = (model: Model, id: string): EntityChange[] =>
  model.diff(id).map((d) => ({ changeId: d.changeId ?? null, kind: d.change, summary: d.summary }));

/** Prose with its [[id]] citations written out as names, to compare with the name. */
const plain = (model: Model, text: string): string =>
  text.replaceAll(/\[\[([\w:#.-]+)\]\]/g, (_, id: string) =>
    model.get(id) === undefined ? id : model.label(id),
  );

const TEAM_GROUPS = [
  ['services', 'Owns'],
  ['changes', 'Changes'],
  ['workItems', 'Work items'],
  ['tests', 'Tests'],
  ['decides', 'Decides'],
  ['questions', 'Questions it has a say in'],
  ['risks', 'Risks'],
] as const;

/** What a team owns and decides, which no field on the team says. */
function teamGroups(model: Model, id: string): EntityGroup[] {
  const cut = model.teamCut(id);
  return TEAM_GROUPS.flatMap(([key, label]) => {
    const ids = [...cut[key]];
    return ids.length === 0 ? [] : [{ label, refs: ids.map((i) => refOf(model, i)) }];
  });
}

/** The ids it points at, less its owners, which the header already names. */
function usesOf(
  model: Model,
  links: readonly { label: string; ids: readonly string[] }[],
  owner: readonly EntityRef[],
) {
  const owners = new Set(owner.map((o) => o.id));
  return links.flatMap(({ label, ids }) => {
    const rest = ids.filter((i) => !owners.has(i));
    return rest.length === 0 ? [] : [{ label, refs: rest.map((i) => refOf(model, i)) }];
  });
}

const PLAN_LEVEL = new Set<EntityType>([
  'decision',
  'question',
  'risk',
  'workItem',
  'milestone',
  'change',
  'test',
  'scenario',
]);

const SERVICE_KIND_WORDS: Readonly<Record<string, string>> = {
  service: 'service',
  job: 'job',
  ui: 'app',
  external: 'external system',
};

/** The type word for a thing: a component says its kind (service, job, app, external system), a store says topic when it is one. */
export function typeWord(type: EntityType, node: unknown): string {
  const kind = prop(node, 'kind');
  if (typeof kind !== 'string') return TYPE_WORDS[type];
  if (type === 'service') return SERVICE_KIND_WORDS[kind] ?? TYPE_WORDS[type];
  if (type === 'store' && (kind === 'topic' || kind === 'queue')) return kind;
  return TYPE_WORDS[type];
}

/** The inspector's page for an id, or null when the plan has no such thing. */
export function entityView(model: Model, id: string): EntityView | null {
  const node = model.get(id);
  const type = typeOf(id);
  if (node === undefined || type === null) return null;
  const read = readEntries(node);
  const owner = ownerOf(model, id);
  const name = model.label(id);
  const mentions = mentionsOf(model, id);
  return {
    id,
    glyph: GLYPHS[type],
    type: typeWord(type, node),
    name,
    status: model.status(id) ?? 'existing',
    planLevel: PLAN_LEVEL.has(type),
    owner,
    text: read.text === null || plain(model, read.text) === name ? null : read.text,
    sections: read.sections,
    facts: read.facts,
    image: read.image,
    sources: read.sources,
    uses: [...usesOf(model, read.links, owner), ...(type === 'team' ? teamGroups(model, id) : [])],
    changes: changesOf(model, id),
    usedBy: usedByOf(model, id),
    mentionedIn: mentions.ids.map((i) => refOf(model, i)),
    mentionedParts: mentions.parts,
  };
}
