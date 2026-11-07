import { permalinkOf } from '@/domain/code-links';
import { appendChild, kindOf } from '@/domain/ids';
import { codeCitationResolver } from '@/domain/model-cite-resolution';
import {
  modelList,
  modelRecord,
  modelText,
  type ModelCite,
  type ModelEntity,
  type ModelGap,
  type WorkspaceModel,
} from '@/domain/workspace-model';
import { parseInline, type Inline } from '@/shared/markdown';

import { modelKindPresentation } from './model-chip';
import type { ModelEdge, ModelIndex } from './model-index';
import type { ModelQueryContext } from './model-reader';
import type { EntityChange, EntityGroup, EntityRef, EntityView } from './plan-pages-entity';
import { readEntries, type EntityFact } from './plan-pages-entity-read';

export interface ModelInspection {
  readonly view: EntityView;
  readonly raw: Readonly<Record<string, unknown>>;
  readonly gaps: readonly ModelGap[];
  readonly href: string | null;
}
export interface ModelInspectionRecord {
  readonly id: string;
  readonly kind: string;
  readonly data: Readonly<Record<string, unknown>>;
  readonly label: string;
}
const contextRecords = new WeakMap<ModelQueryContext, ReadonlyMap<string, ModelInspectionRecord>>();
const planRecords = new WeakMap<
  NonNullable<ModelQueryContext['plan']>,
  readonly ModelInspectionRecord[]
>();
const citations = new WeakMap<
  WorkspaceModel['evidence'],
  ReturnType<typeof codeCitationResolver>
>();

function recordLabel(data: Readonly<Record<string, unknown>>, id: string): string {
  return (
    ['name', 'title', 'label', 'say', 'summary', 'text']
      .map((key) => modelText(data[key]))
      .find((value) => value !== null && value !== '') ?? id
  );
}
function metadataRecords(
  plan: NonNullable<ModelQueryContext['plan']>,
): readonly ModelInspectionRecord[] {
  const known = planRecords.get(plan);
  if (known !== undefined) return known;
  const values: unknown[] = [
    ...['changes', 'tests', 'work_items', 'milestones', 'decisions', 'risks', 'questions'].flatMap(
      (key) => modelList(modelRecord(plan)?.[key]),
    ),
    ...(plan.story?.stages ?? []),
    ...(plan.problem.scenarios ?? []),
    ...plan.changes.flatMap((change) => modelList(change.requires)),
  ];
  const records = values.flatMap((value) => {
    const data = modelRecord(value);
    const id = modelText(data?.id);
    return data === null || id === null
      ? []
      : [{ id, data, kind: kindOf(id) ?? 'plan metadata', label: recordLabel(data, id) }];
  });
  const data = modelRecord(plan);
  const root =
    data === null ? [] : [{ id: plan.meta.id, data, kind: 'plan', label: plan.meta.title }];
  const complete = [...root, ...records];
  planRecords.set(plan, complete);
  return complete;
}
/** Authored facts and actual plan metadata, including removed ids; evidence stays on demand. */
export function modelInspectionRecords(
  context: ModelQueryContext,
): readonly ModelInspectionRecord[] {
  let known = contextRecords.get(context);
  if (known === undefined) {
    const values = [...context.beforeIndex.entities, ...context.afterIndex.entities]
      .filter((node) => node.kind !== 'evidence')
      .map((node) => ({
        id: node.id,
        kind: node.kind,
        data: node.data,
        label:
          context.afterIndex.get(node.id) === null
            ? context.beforeIndex.label(node.id)
            : context.afterIndex.label(node.id),
      }));
    known = new Map(
      [...values, ...(context.plan === null ? [] : metadataRecords(context.plan))].map((node) => [
        node.id,
        node,
      ]),
    );
    contextRecords.set(context, known);
  }
  return [...known.values()];
}
function sameData(left: unknown, right: unknown): boolean {
  if (left === right) return true;
  if (Array.isArray(left) && Array.isArray(right)) {
    return (
      left.length === right.length &&
      left.every((value, position) => sameData(value, right[position]))
    );
  }
  const a = modelRecord(left),
    b = modelRecord(right);
  return (
    a !== null &&
    b !== null &&
    Object.keys(a).length === Object.keys(b).length &&
    Object.keys(a).every((key) => Object.hasOwn(b, key) && sameData(a[key], b[key]))
  );
}
function statusOf(context: ModelQueryContext, id: string): EntityView['status'] {
  const before = context.beforeIndex.get(id),
    after = context.afterIndex.get(id);
  if (before === null) return after === null ? 'existing' : 'added';
  if (after === null) return 'removed';
  if (after.data.deprecated === true && before.data.deprecated !== true) return 'deprecated';
  return sameData(before.data, after.data) ? 'existing' : 'modified';
}
function metadataOf(context: ModelQueryContext, id: string): ModelInspectionRecord | undefined {
  return context.plan === null
    ? undefined
    : metadataRecords(context.plan).find((record) => record.id === id);
}
function referenceIndex(context: ModelQueryContext, index: ModelIndex, id: string): ModelIndex {
  if (index.get(id) !== null) return index;
  return context.afterIndex.get(id) === null ? context.beforeIndex : context.afterIndex;
}
function reference(context: ModelQueryContext, index: ModelIndex, id: string): EntityRef {
  const source = referenceIndex(context, index, id);
  const node = source.get(id);
  const metadata = metadataOf(context, id);
  const kind = node?.kind ?? metadata?.kind ?? kindOf(id) ?? 'unknown';
  return {
    id: node?.id ?? id,
    label: metadata?.label ?? source.label(id),
    glyph: modelKindPresentation(kind).glyph,
    status: metadata === undefined ? statusOf(context, id) : 'existing',
  };
}
/** Resolve model and plan metadata references through the same inspection identity rules. */
export function modelInspectionRef(
  context: ModelQueryContext,
  id: string,
  version: 'before' | 'after' = 'after',
): EntityRef {
  return reference(context, version === 'before' ? context.beforeIndex : context.afterIndex, id);
}
function group(
  context: ModelQueryContext,
  index: ModelIndex,
  label: string,
  ids: readonly string[],
  self: string,
): EntityGroup[] {
  const unique = [...new Set(ids)].filter((id) => id !== self);
  if (unique.length === 0) return [];
  return [{ label, refs: unique.map((id) => reference(context, index, id)) }];
}
function inlineRefs(parts: readonly Inline[]): readonly string[] {
  return parts.flatMap((part) => {
    if (part.kind === 'ref') return [part.id];
    return 'children' in part ? inlineRefs(part.children) : [];
  });
}
function recordedRefs(value: unknown, nested = false): readonly string[] {
  if (typeof value === 'string') {
    return kindOf(value) === null
      ? inlineRefs(parseInline(value, (id) => kindOf(id) !== null))
      : [value];
  }
  if (Array.isArray(value)) return value.flatMap((child) => recordedRefs(child, true));
  const record = modelRecord(value);
  if (record === null) return [];
  const declared = modelText(record.id);
  if (nested && declared !== null && kindOf(declared) !== null) return [declared];
  return Object.entries(record)
    .filter(([key]) => !['id', 'owner', 'evidence', 'cites', 'sources'].includes(key))
    .flatMap(([, child]) => recordedRefs(child, true));
}
interface AuthoredRelations {
  readonly incoming: ReadonlyMap<string, readonly string[]>;
  readonly metadata: ReadonlySet<string>;
}
const authoredRelations = new WeakMap<ModelQueryContext, WeakMap<ModelIndex, AuthoredRelations>>();
function relationsOf(context: ModelQueryContext, index: ModelIndex): AuthoredRelations {
  const records = index.entities
    .filter((node) => node.kind !== 'evidence')
    .map((node) => ({ id: node.id, data: node.data }));
  const metadata = context.plan === null ? [] : metadataRecords(context.plan);
  const pairs = [...records, ...metadata].flatMap((record) =>
    [...new Set(recordedRefs(record.data))]
      .filter((target) => target !== record.id)
      .map((target) => [target, record.id] as const),
  );
  const incoming = new Map<string, string[]>();
  for (const [target, source] of pairs) {
    incoming.set(target, [...(incoming.get(target) ?? []), source]);
  }
  return { incoming, metadata: new Set(metadata.map((record) => record.id)) };
}
function authoredIncoming(
  context: ModelQueryContext,
  index: ModelIndex,
  id: string,
): { readonly refs: readonly string[]; readonly mentions: readonly string[] } {
  let versions = authoredRelations.get(context);
  if (versions === undefined) {
    versions = new WeakMap();
    authoredRelations.set(context, versions);
  }
  let known = versions.get(index);
  if (known === undefined) {
    known = relationsOf(context, index);
    versions.set(index, known);
  }
  const refs = [...new Set(known.incoming.get(id))];
  return { refs, mentions: refs.filter((source) => known.metadata.has(source)) };
}
function edgeGroups(
  context: ModelQueryContext,
  index: ModelIndex,
  id: string,
): { readonly uses: readonly EntityGroup[]; readonly usedBy: readonly EntityGroup[] } {
  const outgoing = index
    .edges()
    .filter(
      (edge) =>
        [edge.from, edge.site, edge.handler, edge.entry].includes(id) ||
        (edge.kind === 'consume' && edge.via === id),
    );
  const incoming = index
    .edges()
    .filter((edge) => edge.to === id || (edge.via === id && edge.kind !== 'consume'));
  const grouped = (edges: readonly ModelEdge[], direction: 'out' | 'in'): readonly EntityGroup[] =>
    [...new Set(edges.map((edge) => edge.kind))].flatMap((kind) =>
      group(
        context,
        index,
        `${direction === 'out' ? 'Outgoing' : 'Incoming'} ${kind}`,
        edges
          .filter((edge) => edge.kind === kind)
          .flatMap((edge) =>
            direction === 'out'
              ? [edge.to, edge.via, edge.site, edge.handler, edge.entry].filter(
                  (value) => value !== null,
                )
              : [edge.from, edge.site, edge.handler, edge.entry].filter((value) => value !== null),
          ),
        id,
      ),
    );
  return { uses: grouped(outgoing, 'out'), usedBy: grouped(incoming, 'in') };
}
type PlanOperation = NonNullable<
  NonNullable<ModelQueryContext['plan']>['changes'][number]['ops']
>[number];
function operationTarget(op: PlanOperation): string {
  if ('modify' in op) return op.modify;
  if ('remove' in op) return op.remove;
  if ('deprecate' in op) return op.deprecate;
  return op.into !== undefined && kindOf(op.value.id) === null
    ? appendChild(op.into, op.value.id)
    : op.value.id;
}
function operationKind(op: PlanOperation): string {
  if ('add' in op) return 'added';
  if ('remove' in op) return 'removed';
  return 'deprecate' in op ? 'deprecated' : 'modified';
}
function directChanges(context: ModelQueryContext, id: string): readonly EntityChange[] {
  return (context.plan?.changes ?? []).flatMap((change) =>
    (change.ops ?? [])
      .filter((op) => operationTarget(op) === id)
      .map((op) => ({ changeId: change.id, kind: operationKind(op), summary: change.title })),
  );
}
function recordedCodeCite(cite: Readonly<Record<string, unknown>>): ModelCite | null {
  const repo = modelText(cite.repo),
    commit = modelText(cite.commit),
    path = modelText(cite.path);
  if (repo === null || commit === null || path === null) return null;
  const [from, to] = modelList(cite.lines);
  return {
    kind: 'code',
    repo,
    commit,
    path,
    ...(typeof from === 'number' && typeof to === 'number' ? { lines: [from, to] as const } : {}),
  };
}
function metadataCite(item: unknown): ModelCite | null {
  if (typeof item === 'string') {
    return kindOf(item) === 'evidence' ? { kind: 'evidence', id: item } : null;
  }
  const cite = modelRecord(item);
  if (cite === null) return null;
  if (cite.kind === 'evidence' && typeof cite.id === 'string') {
    return { kind: 'evidence', id: cite.id };
  }
  return cite.kind === 'code' ? recordedCodeCite(cite) : null;
}
function metadataCites(value: unknown): readonly ModelCite[] {
  return modelList(value).flatMap((item) => {
    const cite = metadataCite(item);
    return cite === null ? [] : [cite];
  });
}
function entityCites(
  index: ModelIndex,
  node: ModelEntity | null,
  raw: Readonly<Record<string, unknown>>,
): readonly ModelCite[] {
  if (node?.kind === 'evidence') return [{ kind: 'evidence', id: node.id }];
  return node === null ? metadataCites(raw.cites) : index.cites(node.id);
}
function codeSources(index: ModelIndex, cites: readonly ModelCite[]): EntityView['sources'] {
  let resolver = citations.get(index.model.evidence);
  if (resolver === undefined) {
    resolver = codeCitationResolver(index.model.evidence);
    citations.set(index.model.evidence, resolver);
  }
  return resolver(cites).map((cite) => {
    const span =
      cite.lines === undefined ? '' : `:${String(cite.lines[0])}–${String(cite.lines[1])}`;
    return { label: `${cite.repo} · ${cite.path}${span}`, href: permalinkOf(cite) };
  });
}
function repositoryFacts(index: ModelIndex, node: ModelEntity | null): readonly EntityFact[] {
  if (node?.kind !== 'evidence') return [];
  const repo = index.model.evidence.find(
    (candidate) =>
      candidate.discovery?.id === node.id ||
      candidate.records.some((record) => record.data.id === node.id),
  );
  return repo === undefined
    ? []
    : [
        { label: 'Repository', value: repo.repository.repo, href: null },
        { label: 'Commit', value: repo.repository.commit, href: null },
      ];
}
interface SelectedEntity {
  readonly index: ModelIndex;
  readonly node: ModelEntity | null;
  readonly metadata: ModelInspectionRecord | undefined;
  readonly raw: Readonly<Record<string, unknown>>;
  readonly identity: string;
  readonly kind: string;
}
function selectedEntity(
  context: ModelQueryContext,
  id: string,
  version: 'before' | 'after',
): SelectedEntity | null {
  const index = version === 'before' ? context.beforeIndex : context.afterIndex;
  const node = index.get(id);
  const metadata = metadataOf(context, id);
  const raw = node?.data ?? metadata?.data;
  if (raw === undefined) return null;
  return {
    index,
    node,
    metadata,
    raw,
    identity: node?.id ?? id,
    kind: node?.kind ?? metadata?.kind ?? 'unknown',
  };
}
function ownersOf(context: ModelQueryContext, selected: SelectedEntity): readonly EntityRef[] {
  const { index, node, identity } = selected;
  if (node === null) return [];
  return [index.owningTeam(identity), index.resourceOwner(identity)]
    .filter((id): id is string => id !== null && id !== identity)
    .map((id) => reference(context, index, id));
}
function placementGroups(
  context: ModelQueryContext,
  selected: SelectedEntity,
): readonly EntityGroup[] {
  const { node, index, identity } = selected;
  const place = node === null ? null : index.place(identity);
  const ids =
    place === null
      ? []
      : [place.workspace, place.domain, place.system, place.component].filter(
          (value) => value !== null,
        );
  return group(context, index, 'Placement', ids, identity);
}
function providerGroups(
  context: ModelQueryContext,
  selected: SelectedEntity,
): readonly EntityGroup[] {
  const { index, node, identity } = selected;
  const source = node?.kind === 'endpoint' && node.parent !== null ? index.get(node.parent) : node;
  if (source?.kind !== 'interface') return [];
  const ids = ['component', 'external', 'system'].flatMap((key) => {
    const id = modelText(source.data[key]);
    return id === null ? [] : [id];
  });
  return group(context, index, 'Declared provider', ids, identity);
}
function inspectionRead(context: ModelQueryContext, selected: SelectedEntity) {
  const read = readEntries(selected.raw);
  if (selected.kind !== 'plan' || context.plan === null) return read;
  return {
    ...read,
    text: read.text ?? context.plan.problem.summary,
    sections: [
      ...read.sections,
      ...(context.plan.story?.summary === undefined
        ? []
        : [{ label: 'Story', text: context.plan.story.summary }]),
    ],
  };
}
function inspectionView(context: ModelQueryContext, selected: SelectedEntity): EntityView {
  const { index, node, metadata, raw, identity, kind } = selected;
  const read = inspectionRead(context, selected);
  const edges = node === null ? { uses: [], usedBy: [] } : edgeGroups(context, index, identity);
  const cites = entityCites(index, node, raw);
  const evidence = [
    ...cites,
    ...metadataCites(raw.cites),
    ...metadataCites(raw.sources),
    ...metadataCites([raw.source]),
  ].flatMap((cite) => (cite.kind === 'evidence' ? [cite.id] : []));
  const incoming = authoredIncoming(context, index, identity);
  const children = index.entities
    .filter((record) => record.kind !== 'evidence' && record.parent === identity)
    .map((record) => record.id);
  return {
    id: identity,
    glyph: modelKindPresentation(kind).glyph,
    type:
      kind === 'system' && raw.mapped === false
        ? 'unmapped system'
        : modelKindPresentation(kind).word,
    name: metadata?.label ?? index.label(identity),
    status: metadata === undefined ? statusOf(context, identity) : 'existing',
    planLevel: metadata !== undefined,
    owner: ownersOf(context, selected),
    text: read.text,
    sections: read.sections,
    facts: [...read.facts, ...repositoryFacts(index, node)],
    image: read.image,
    sources: [
      ...new Map(
        [...codeSources(index, cites), ...read.sources].map((source) => [source.href, source]),
      ).values(),
    ],
    uses: [
      ...placementGroups(context, selected),
      ...providerGroups(context, selected),
      ...group(context, index, 'Contains', children, identity),
      ...group(context, index, 'Recorded references', recordedRefs(raw), identity),
      ...group(context, index, 'Evidence references', evidence, identity),
      ...edges.uses,
    ],
    usedBy: [
      ...edges.usedBy,
      ...group(context, index, 'Referenced by authored facts', incoming.refs, identity),
    ],
    changes: directChanges(context, identity),
    mentionedIn: incoming.mentions.map((source) => reference(context, index, source)),
    mentionedParts: [],
  };
}
/** Build the same serialisable inspection for a server response or supplied browser indexes. */
export function modelInspectionOf(
  context: ModelQueryContext,
  id: string,
  version: 'before' | 'after' = 'after',
): ModelInspection | null {
  const selected = selectedEntity(context, id, version);
  if (selected === null) return null;
  return {
    raw: selected.raw,
    href: selected.node === null ? null : selected.index.href(selected.identity),
    gaps: selected.node === null ? [] : selected.index.gaps(selected.identity),
    view: inspectionView(context, selected),
  };
}
