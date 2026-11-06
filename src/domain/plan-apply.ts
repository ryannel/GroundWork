// Plans edit a private clone of the same serialisable model; identity and placement stay explicit.
import { resolveAlias, rootId, type Alias } from '@/domain/ids';
import { CITATION_SHAPES } from '@/domain/model/citations.generated';
import type { ContractData } from '@/domain/model/contracts.generated';
import { mapSourceCitations } from '@/domain/model-citations';
import { resolveModelCitations, type CitationScope } from '@/domain/model-cite-resolution';
import {
  entitiesIn,
  modelList,
  modelRecord,
  type ModelEntity,
  type ModelGap,
  type WorkspaceModel,
} from '@/domain/workspace-model';

export type ModelOp = ContractData<'plan', 'op'>;
interface Addition {
  readonly collection: string;
  readonly parents: readonly ModelEntity['kind'][];
  readonly definition: string;
}
const ADDITIONS: Readonly<Record<string, Addition | undefined>> = {
  domain: { collection: 'domains', parents: ['workspace'], definition: 'DomainFile' },
  system: { collection: 'systems', parents: ['domain'], definition: 'SystemFile' },
  component: { collection: 'components', parents: ['system'], definition: 'Component' },
  library: { collection: 'libraries', parents: ['workspace'], definition: 'Library' },
  external: { collection: 'externals', parents: ['workspace'], definition: 'External' },
  team: { collection: 'teams', parents: ['workspace'], definition: 'Team' },
  actor: { collection: 'actors', parents: ['workspace'], definition: 'Actor' },
  area: { collection: 'areas', parents: ['workspace'], definition: 'Area' },
  interface: { collection: 'interfaces', parents: ['system'], definition: 'Interface' },
  endpoint: { collection: 'entries', parents: ['interface'], definition: 'Endpoint' },
  message: { collection: 'messages', parents: ['system'], definition: 'Message' },
  subscription: { collection: 'subscriptions', parents: ['system'], definition: 'Subscription' },
  job: { collection: 'jobs', parents: ['system'], definition: 'Job' },
  interaction: { collection: 'interactions', parents: ['system'], definition: 'Interaction' },
  operation: { collection: 'operations', parents: ['system'], definition: 'Operation' },
  schema: { collection: 'schemas', parents: ['system'], definition: 'Schema' },
  screen: { collection: 'screens', parents: ['system'], definition: 'Screen' },
  handler: { collection: 'handlers', parents: ['system'], definition: 'Handler' },
  relationship: { collection: 'relationships', parents: ['system'], definition: 'Relationship' },
  graph: { collection: 'graphs', parents: ['workspace'], definition: 'GraphFile' },
  subgraph: { collection: 'subgraphs', parents: ['graph'], definition: 'Subgraph' },
  flow: { collection: 'flows', parents: ['workspace'], definition: 'FlowFile' },
  journey: { collection: 'journeys', parents: ['workspace'], definition: 'JourneyFile' },
  programme: { collection: 'programmes', parents: ['workspace'], definition: 'ProgrammeFile' },
  concept: { collection: 'concepts', parents: ['domain'], definition: 'Concept' },
  keyTerm: { collection: 'terms', parents: ['workspace'], definition: 'KeyTerm' },
  field: { collection: 'fields', parents: ['schema'], definition: 'Field' },
  region: { collection: 'regions', parents: ['screen'], definition: 'Region' },
  failure: { collection: 'failures', parents: ['handler'], definition: 'Failure' },
  step: { collection: 'steps', parents: ['handler', 'step', 'flow'], definition: 'Step' },
};
const DEFINITIONS: Readonly<Record<string, string | undefined>> = {
  workspace: 'WorkspaceFile',
  stage: 'TargetStage',
  targetShift: 'TargetShift',
  domain: 'DomainFile',
  system: 'SystemFile',
  service: 'ServiceComponent',
  app: 'AppComponent',
  store: 'StoreComponent',
  topic: 'TopicComponent',
  library: 'Library',
  external: 'External',
  team: 'Team',
  actor: 'Actor',
  area: 'Area',
  interface: 'Interface',
  endpoint: 'Endpoint',
  message: 'Message',
  subscription: 'Subscription',
  job: 'Job',
  interaction: 'Interaction',
  operation: 'Operation',
  schema: 'Schema',
  screen: 'Screen',
  handler: 'Handler',
  relationship: 'Relationship',
  graph: 'GraphFile',
  subgraph: 'Subgraph',
  flow: 'FlowFile',
  journey: 'JourneyFile',
  programme: 'ProgrammeFile',
  concept: 'Concept',
  keyTerm: 'KeyTerm',
  field: 'Field',
  region: 'Region',
  failure: 'Failure',
  step: 'Step',
};
// Preserve every supplied own property for schema checking, including JSON keys such as __proto__.
function assign(
  target: Readonly<Record<string, unknown>>,
  values: Readonly<Record<string, unknown>>,
): void {
  Object.defineProperties(
    target,
    Object.fromEntries(
      Object.entries(values).map(([key, value]) => [
        key,
        { value, enumerable: true, configurable: true, writable: true },
      ]),
    ),
  );
}
function requiredEntity(id: string, model: WorkspaceModel): ModelEntity {
  const aliases: Readonly<Record<string, Alias>> = Object.fromEntries(
    Object.entries(model.aliases).flatMap(([key, alias]) =>
      alias === undefined ? [] : [[key, alias]],
    ),
  );
  const resolved = resolveAlias(id, aliases);
  const matches = entitiesIn(model).filter((node) => node.id === resolved.id);
  if (matches.length !== 1) {
    throw new Error(
      `${id}: expected exactly one declared model entity, found ${String(matches.length)}.`,
    );
  }
  const found = matches[0];
  if (found === undefined) throw new Error(`${id}: missing model entity.`);
  return found;
}
function uniqueIdentities(model: WorkspaceModel): void {
  const ids = new Set<string>();
  for (const node of entitiesIn(model)) {
    if (ids.has(node.id)) throw new Error(`Duplicate model id: ${node.id}`);
    ids.add(node.id);
  }
}
function authoredCites(definition: string, value: unknown, entity: string): void {
  mapSourceCitations(definition, value, entity, (cites) => {
    if (cites.length < (CITATION_SHAPES.AuthoredCites?.minimum ?? 0)) {
      throw new Error(`${entity}: an authored citation list is empty.`);
    }
    if (cites.some((cite) => typeof cite !== 'string')) {
      throw new Error(`${entity}: plan citations must use authored strings.`);
    }
    return cites;
  });
}
function resolvedValue(
  definition: string,
  value: unknown,
  parent: ModelEntity,
  model: WorkspaceModel,
  report: (gap: ModelGap) => void,
  homes?: CitationScope['homes'],
): unknown {
  authoredCites(definition, value, parent.id);
  const system = entitiesIn(model).find((node) => node.id === parent.place.system);
  const systems = model.domains
    .filter((domain) => parent.place.domain === null || domain.id === parent.place.domain)
    .flatMap((domain) => domain.systems)
    .filter((candidate) => system === undefined || candidate.id === system.id);
  const combined: Record<string, NonNullable<CitationScope['homes'][string]>> = {};
  for (const candidate of systems) {
    for (const [key, home] of Object.entries(candidate.homes ?? {})) {
      if (home !== undefined) combined[key] = [...(combined[key] ?? []), home];
    }
  }
  const scopeHomes = homes ?? combined;
  const handler = entitiesIn(model).find(
    (node) => node.kind === 'handler' && node.id === rootId(parent.id),
  )?.data;
  const result = resolveModelCitations(definition, value, {
    entity: parent.id,
    homes: scopeHomes,
    evidence: model.evidence,
    file: 'plan',
    ...(handler === undefined ? {} : { handler }),
  });
  for (const gap of result.problems) report(gap);
  return result.data;
}
function containerFor(parent: ModelEntity, kind: string): Readonly<Record<string, unknown>> {
  if (kind === 'area') return modelRecord(parent.data.landscape) ?? { areas: [] };
  if (kind === 'keyTerm' || kind === 'concept') return modelRecord(parent.data.language) ?? {};
  return parent.data;
}
function composedValue(kind: string, value: unknown): unknown {
  const data = modelRecord(value);
  if (data === null) throw new Error('An addition needs an object value.');
  if (kind === 'domain') return { ...data, systems: [], language: null, target: null };
  if (kind !== 'system') return value;
  return {
    ...data,
    components: data.components ?? [],
    interfaces: [],
    messages: [],
    subscriptions: [],
    jobs: [],
    interactions: [],
    operations: [],
    schemas: [],
    screens: [],
    handlers: [],
    narratives: null,
  };
}
function insertionPosition(
  values: readonly unknown[],
  after: string | undefined,
  model: WorkspaceModel,
): number {
  if (after === undefined) return values.length;
  const sibling = requiredEntity(after, model);
  const index = values.indexOf(sibling.data);
  if (index === -1) throw new Error(`${after}: is not a sibling in the destination collection.`);
  return index + 1;
}
function add(
  op: Extract<ModelOp, { readonly add: string }>,
  model: WorkspaceModel,
  report: (gap: ModelGap) => void,
): void {
  const specification = ADDITIONS[op.add];
  if (specification === undefined) throw new Error(`Unsupported addition: ${op.add}`);
  const parent = requiredEntity(op.into ?? model.id, model);
  if (!specification.parents.includes(parent.kind)) {
    throw new Error(`${op.add}: cannot add into ${parent.id}.`);
  }
  const container = containerFor(parent, op.add);
  const values = modelList(container[specification.collection]);
  const position = insertionPosition(values, op.after, model);
  const definition =
    op.add === 'step' && parent.kind === 'flow' ? 'FlowStep' : specification.definition;
  const homes =
    op.add === 'system'
      ? Object.fromEntries(
          Object.entries(op.value.homes ?? {}).flatMap(([key, home]) =>
            home === undefined ? [] : [[key, [home]]],
          ),
        )
      : undefined;
  const value = composedValue(
    op.add,
    resolvedValue(definition, op.value, parent, model, report, homes),
  );
  assign(container, {
    [specification.collection]: [...values.slice(0, position), value, ...values.slice(position)],
  });
  if (op.add === 'area') assign(parent.data, { landscape: container });
  if (op.add === 'keyTerm' || op.add === 'concept') {
    assign(parent.data, { language: container });
  }
}
interface ArrayLocation {
  readonly container: Readonly<Record<string, unknown>>;
  readonly key: string;
  readonly values: readonly unknown[];
}
function arrayLocation(
  value: unknown,
  target: Readonly<Record<string, unknown>>,
): ArrayLocation | null {
  const data = modelRecord(value);
  if (data === null) return null;
  for (const [key, child] of Object.entries(data)) {
    if (Array.isArray(child) && child.includes(target)) {
      return { container: data, key, values: child };
    }
    const children = Array.isArray(child) ? child : [child];
    for (const candidate of children) {
      const found = arrayLocation(candidate, target);
      if (found !== null) return found;
    }
  }
  return null;
}
function arrayPatch(
  entity: ModelEntity,
  definition: string,
  op: Extract<ModelOp, { readonly modify: string }>,
  model: WorkspaceModel,
  report: (gap: ModelGap) => void,
): Readonly<Record<string, unknown>> {
  const patch: Record<string, unknown> = {};
  for (const mode of ['append', 'drop'] as const) {
    for (const [key, value] of Object.entries(modelRecord(op[mode]) ?? {})) {
      const absentAppend = mode === 'append' && entity.data[key] === undefined;
      if (!absentAppend && !Array.isArray(entity.data[key])) {
        throw new TypeError(`${entity.id}.${key}: ${mode} requires an existing array.`);
      }
      const resolved = modelRecord(
        resolvedValue(definition, { [key]: value }, entity, model, report),
      );
      const selected = modelList(resolved?.[key]);
      const before = modelList(patch[key] ?? entity.data[key]);
      if (mode === 'append') patch[key] = [...before, ...selected];
      else {
        const keys = new Set(selected.map((item) => JSON.stringify(item)));
        patch[key] = before.filter((item) => !keys.has(JSON.stringify(item)));
      }
    }
  }
  return patch;
}
function modify(
  op: Extract<ModelOp, { readonly modify: string }>,
  model: WorkspaceModel,
  report: (gap: ModelGap) => void,
): void {
  const entity = requiredEntity(op.modify, model);
  const set = modelRecord(op.set) ?? {};
  if (set.id !== undefined) throw new Error(`${entity.id}: identity cannot be changed.`);
  const definition = DEFINITIONS[entity.kind];
  if (definition === undefined) throw new Error(`${entity.id}: unsupported modification.`);
  const patch: Record<string, unknown> = {
    ...modelRecord(resolvedValue(definition, set, entity, model, report)),
  };
  assign(
    patch,
    arrayPatch({ ...entity, data: { ...entity.data, ...patch } }, definition, op, model, report),
  );
  assign(entity.data, patch);
}

function deprecate(
  op: Extract<ModelOp, { readonly deprecate: string }>,
  model: WorkspaceModel,
): void {
  const entity = requiredEntity(op.deprecate, model);
  assign(entity.data, { deprecated: true });
  if (op.replaced_by === undefined) return;
  const replacement = requiredEntity(op.replaced_by, model);
  if (replacement.kind !== entity.kind) {
    throw new Error(`${entity.id}: replacement has a different kind.`);
  }
  assign(replacement.data, { supersedes: entity.id });
}
function applyOne(op: ModelOp, model: WorkspaceModel, report: (gap: ModelGap) => void): void {
  if ('add' in op) {
    add(op, model, report);
    return;
  }
  if ('modify' in op) {
    modify(op, model, report);
    return;
  }
  if ('deprecate' in op) {
    deprecate(op, model);
    return;
  }
  const entity = requiredEntity(op.remove, model);
  const location = arrayLocation(model, entity.data);
  if (location === null) throw new Error(`${entity.id}: cannot remove the workspace root.`);
  assign(location.container, {
    [location.key]: location.values.filter((value) => value !== entity.data),
  });
}
function replacedCitations(op: ModelOp, model: WorkspaceModel): ReadonlySet<string> {
  const replaced = new Set<string>();
  if (!('modify' in op)) return replaced;
  const entity = requiredEntity(op.modify, model);
  const definition = DEFINITIONS[entity.kind];
  if (definition === undefined) return replaced;
  mapSourceCitations(definition, op.set, entity.id, (values, context) => {
    replaced.add(`${context.entity}\n${context.localPath.join('/')}`);
    return values;
  });
  return replaced;
}
/** Apply validated authored ops without changing the input. Validate the resulting contract at the file boundary. */
export function apply(ops: readonly ModelOp[], model: WorkspaceModel): WorkspaceModel {
  const next = structuredClone(model);
  let problems: ModelGap[] = [...next.problems];
  const report = (gap: ModelGap): void => {
    problems.push(gap);
  };
  uniqueIdentities(next);
  for (const op of ops) {
    const replaced = replacedCitations(op, next);
    problems = problems.filter((gap) => !replaced.has(`${gap.id}\n${gap.property ?? ''}`));
    applyOne(op, next, report);
    uniqueIdentities(next);
  }
  const remaining = new Set(entitiesIn(next).map((entity) => entity.id));
  assign(next, { problems: problems.filter((gap) => remaining.has(gap.id)) });
  return next;
}
