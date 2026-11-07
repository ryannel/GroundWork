import type { EvidenceFamily } from '@/domain/evidence/evidence';
import { appendChild, failureId, kindOf, nestedId, type IdKind } from '@/domain/ids';
import type { ContractData, ContractDefinition } from '@/domain/model/contracts.generated';

// The system model: how the systems of a workspace work today. It sits beside the structure
// (domains/<d>/systems/<s>/system.yaml) as contracts.yaml and handlers.yaml per system, story.yaml, flows/ and journeys/,
// and is read in plan shape so the plan views can draw it.
import type {
  Concept,
  Flow,
  Graph,
  Handler,
  Interaction,
  Interface,
  Message,
  Operation,
  Schema,
  Screen,
  Service,
  Source,
  Stage,
  Store,
  Subgraph,
  UserJourney,
} from './plan/plan.generated';

/** Where a fact came from: a scan of the code, the demo seed, a person, or a document (a partner's). */
export type Origin = 'extracted' | 'seeded' | 'curated' | 'documented';

/** The lines of code a fact was read from. The permalink is derived, never stored. */
export interface CodeSource {
  /** org/name on GitHub, as system.yaml lists repos (acme/pricing); host/org/name elsewhere. */
  readonly repo: string;
  readonly path: string;
  readonly commit: string;
  readonly lines?: readonly [number, number];
  readonly symbol?: string;
  readonly label?: string;
  readonly note?: string;
}

/** Who said a fact and where it lives in the code. Kept per id, for top-level and nested facts alike. */
export interface Attribution {
  readonly origin: Origin;
  readonly sources: readonly CodeSource[];
}

/** What a system's contracts.yaml adds to one of its components. */
export interface ComponentDetail {
  readonly id: string;
  readonly kind?: Service['kind'];
  readonly summary?: string;
  readonly sources?: readonly Source[];
}

export interface SystemContracts {
  /** The workspace system id, without `sys:`. */
  readonly system: string;
  readonly components: readonly ComponentDetail[];
  readonly stores: readonly Store[];
  readonly interfaces: readonly Interface[];
  readonly schemas: readonly Schema[];
  readonly messages: readonly Message[];
  readonly screens: readonly Screen[];
  readonly graphs: readonly Graph[];
  readonly subgraphs: readonly Subgraph[];
  readonly operations: readonly Operation[];
  /** What runs when its endpoints are called or its messages arrive, from handlers.yaml beside the contracts. */
  readonly handlers: readonly Handler[];
}

export interface Story {
  readonly summary: string | null;
  readonly concepts: readonly Concept[];
  readonly stages: readonly Stage[];
}

/** A domain's language: the words its systems use and what each means. From domains/<domain>/language.yaml. */
export interface DomainLanguage {
  readonly domain: string;
  /** The domain told in its own words. */
  readonly summary: string | null;
  readonly concepts: readonly Concept[];
}

/** One step of the flow a domain is heading for: a thing of the business, and who should own it. */
export interface TargetStage {
  /** Unique within the domain's target.yaml. */
  readonly id: string;
  readonly name: string;
  /** The key term it is (term:…), when the business has agreed a word for it. */
  readonly term: string | null;
  /** The systems or components that should own it: sys:… or a component id. */
  readonly owners: readonly string[];
  /** Markdown; may cite [[id]]. */
  readonly summary: string | null;
  /** The stages it is made from, by id. */
  readonly from: readonly string[];
}

/** One place where today differs from the target, and which way it is moving. */
export interface TargetShift {
  readonly id: string;
  readonly name: string;
  /** What is true today. Markdown; may cite [[id]]. */
  readonly today: string;
  /** Where it is heading. Markdown; may cite [[id]]. */
  readonly target: string;
  /** Where the difference shows in today's model. */
  readonly cites: readonly string[];
}

/** Where a domain is heading, written by people. From domains/<domain>/target.yaml. */
export interface TargetArchitecture {
  readonly domain: string;
  readonly summary: string | null;
  readonly stages: readonly TargetStage[];
  readonly shifts: readonly TargetShift[];
}

/** How closely a scanned word or a system matches a key term. */
export type TermFit = 'same' | 'close' | 'renamed' | 'clash' | 'lives-in';

/** Where a key term shows up in the systems: a scanned word (con:…), or the system or domain it belongs to. */
export interface TermAnchor {
  readonly to: string;
  readonly fit: TermFit;
  readonly note: string | null;
}

/** A key term put to work: how it is used, in everyday life or at the company. */
export interface TermExample {
  readonly context: 'everyday' | 'company';
  readonly analogy: string | null;
  readonly sentence: string | null;
}

/** One word the business has agreed on, in its own words, with where it shows up in the systems. */
export interface KeyTerm {
  readonly id: string;
  readonly name: string;
  readonly group: string | null;
  /** Other words people use for the same thing. */
  readonly aliases: readonly string[];
  readonly means: string;
  readonly examples: readonly TermExample[];
  readonly relates: readonly { readonly to: string; readonly as: string }[];
  readonly anchors: readonly TermAnchor[];
}

/** The words the whole business agrees on, above any one domain. From language.yaml at the workspace root. */
export interface KeyTerms {
  readonly summary: string | null;
  /** The document the terms come from, and whether it is still open to change. */
  readonly source: {
    readonly title: string;
    readonly url: string | null;
    readonly status: string | null;
  } | null;
  readonly groups: readonly { readonly id: string; readonly name: string }[];
  readonly terms: readonly KeyTerm[];
}

/** The high-water mark of one repo: the commit the system model reflects. From scans/<repo>.yaml. */
export interface Scan {
  readonly repo: string;
  readonly branch: string;
  readonly head: string;
  readonly scannedAt: string;
  readonly scanner: string;
  /** Blob sha per file that produced facts. */
  readonly files: Readonly<Record<string, string>>;
  readonly facts: number;
  /** The last time tools/scan-status.ts asked the remote how far the branch had moved past `head`, if ever. */
  readonly checked: ScanCheck | null;
}

export interface ScanCheck {
  readonly at: string;
  readonly tip: string;
  /** Commits between `head` and `tip`, or null when they were not counted. */
  readonly behind: number | null;
  /** Of those commits, how many touch each folder a system lists, by folder; empty when not counted. */
  readonly folders: Readonly<Record<string, number>>;
}

export interface LegacyWorkspaceModel {
  readonly story: Story;
  /** One per domain that has a language.yaml, in domain order. */
  readonly languages: readonly DomainLanguage[];
  /** One per domain that has a target.yaml, in domain order. */
  readonly targets: readonly TargetArchitecture[];
  /** The business's agreed words, above the domains. Empty when the workspace has no language.yaml. */
  readonly keyTerms: KeyTerms;
  readonly flows: readonly Flow[];
  readonly journeys: readonly UserJourney[];
  readonly interactions: readonly Interaction[];
  readonly contracts: readonly SystemContracts[];
  readonly attribution: Readonly<Record<string, Attribution>>;
  readonly scans: readonly Scan[];
}

/** Authored citations become resolved values at the single file boundary. */
type ResolvedCitationValue<Value> =
  NonNullable<Value> extends AuthoredModel<'AuthoredCites'>
    ? readonly ModelCite[]
    : ResolvedCites<Value>;
export type ResolvedCites<Data> = Data extends object
  ? {
      readonly [Key in keyof Data]: Key extends 'cites'
        ? ResolvedCitationValue<Data[Key]>
        : ResolvedCites<Data[Key]>;
    }
  : Data;
export type AuthoredModel<Definition extends ContractDefinition<'workspace'>> = ContractData<
  'workspace',
  Definition
>;
export type ModelData<Definition extends ContractDefinition<'workspace'>> = ResolvedCites<
  AuthoredModel<Definition>
>;
export type ModelCite = ContractData<'workspace', 'Cite'>;
export type ModelHandler = ModelData<'Handler'>;
export type ModelComponent = ModelData<'Component'>;
export type ModelPlan = ContractData<'plan', 'document'>;

/** A system's identity and authored facets, joined without copying facts into a plan. */
export type ModelSystem = (ModelData<'SystemFile'> &
  ModelData<'ContractsFile'> &
  ModelData<'ScreensFile'>) & {
  readonly components: readonly ModelComponent[];
  readonly interfaces: readonly ModelData<'Interface'>[];
  readonly messages: readonly ModelData<'Message'>[];
  readonly subscriptions: readonly ModelData<'Subscription'>[];
  readonly jobs: readonly ModelData<'Job'>[];
  readonly interactions: readonly ModelData<'Interaction'>[];
  readonly operations: readonly ModelData<'Operation'>[];
  readonly schemas: readonly ModelData<'Schema'>[];
  readonly screens: readonly ModelData<'Screen'>[];
  readonly handlers: readonly ModelHandler[];
  readonly narratives: ModelData<'NarrativesFile'> | null;
};
export type ModelDomain = ModelData<'DomainFile'> & {
  readonly systems: readonly ModelSystem[];
  readonly language: ModelData<'DomainLanguageFile'> | null;
  // Target shifts cite model ids; they are anchors, not source citations.
  readonly target: AuthoredModel<'TargetFile'> | null;
};
export type ModelEvidenceRecord<Family extends EvidenceFamily = EvidenceFamily> = {
  readonly [Key in Family]: { readonly family: Key; readonly data: ContractData<'evidence', Key> };
}[Family];
export interface ModelRepository {
  readonly repository: ContractData<'evidence', 'EvidenceRepository'>;
  readonly records: readonly ModelEvidenceRecord[];
  readonly discovery: ContractData<'evidence', 'EvidenceDiscovery'> | null;
}
export interface ModelGap {
  readonly id: string;
  readonly kind: string;
  readonly message: string;
  readonly at?: string;
  readonly reference?: string;
  readonly property?: string;
}

/** The serialisable workspace, before or after a plan. File placement is independent of ownership. */
export type WorkspaceModel = ModelData<'WorkspaceFile'> & {
  readonly domains: readonly ModelDomain[];
  readonly libraries: readonly ModelData<'Library'>[];
  readonly externals: readonly ModelData<'External'>[];
  readonly graphs: readonly ModelData<'GraphFile'>[];
  readonly flows: readonly ModelData<'FlowFile'>[];
  readonly journeys: readonly ModelData<'JourneyFile'>[];
  readonly programmes: readonly ModelData<'ProgrammeFile'>[];
  readonly language: ModelData<'LanguageFile'> | null;
  readonly landscape: ModelData<'LandscapeFile'> | null;
  readonly aliases: AuthoredModel<'AliasesFile'>;
  readonly evidence: readonly ModelRepository[];
  readonly problems: readonly ModelGap[];
};

export interface ModelPlace {
  readonly workspace: string;
  readonly domain: string | null;
  readonly system: string | null;
  readonly component: string | null;
}
/** A reference to an existing value, with its declared identity and containing file's placement. */
export interface ModelEntity {
  readonly id: string;
  readonly kind: IdKind | 'workspace' | 'targetShift';
  readonly data: Readonly<Record<string, unknown>>;
  readonly parent: string | null;
  readonly place: ModelPlace;
}
function isModelRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
export function modelRecord(value: unknown): Readonly<Record<string, unknown>> | null {
  return isModelRecord(value) ? value : null;
}
export function modelList(value: unknown): readonly unknown[] {
  return Array.isArray(value) ? value : [];
}
export function modelText(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

function componentReference(
  kind: ModelEntity['kind'],
  data: Readonly<Record<string, unknown>>,
): string | null {
  if (kind === 'screen') return modelText(data.app);
  return kind === 'schema' ? modelText(data.store) : null;
}

function declaredEntity(
  value: unknown,
  parent: ModelEntity | null,
  place: ModelPlace,
  kind?: ModelEntity['kind'],
  id?: string,
): ModelEntity {
  const data = modelRecord(value);
  const identity = id ?? modelText(data?.id);
  if (data === null || identity === null) throw new Error('A model entity needs a declared id.');
  const category = kind ?? kindOf(identity);
  if (category === null) throw new Error(`Unknown model identity: ${identity}`);
  const component =
    modelText(data.component) ?? componentReference(category, data) ?? place.component;
  return {
    id: identity,
    kind: category,
    data,
    parent: parent?.id ?? null,
    place: { ...place, component },
  };
}
function children(
  parent: ModelEntity,
  key: string,
  kind?: ModelEntity['kind'],
): readonly ModelEntity[] {
  return modelList(parent.data[key]).map((value) =>
    declaredEntity(value, parent, parent.place, kind),
  );
}
function localChildren(
  parent: ModelEntity,
  key: string,
  kind: ModelEntity['kind'],
): readonly ModelEntity[] {
  return modelList(parent.data[key]).map((value) => {
    const id = modelText(modelRecord(value)?.id);
    if (id === null) throw new Error(`${parent.id}: ${key} needs a declared child id.`);
    return declaredEntity(value, parent, parent.place, kind, appendChild(parent.id, id));
  });
}
function fieldEntities(parent: ModelEntity): readonly ModelEntity[] {
  return ['fields', 'args']
    .flatMap((key) => localChildren(parent, key, 'field'))
    .flatMap((field) => [field, ...fieldEntities(field)]);
}
function stepEntities(
  parent: ModelEntity,
  handler: string,
  path: readonly string[],
): readonly ModelEntity[] {
  const direct = ['steps', 'then', 'else', 'try', 'catch', 'finally'].flatMap((key) =>
    modelList(parent.data[key]),
  );
  const lanes = modelList(parent.data.parallel).flatMap((lane) =>
    modelList(modelRecord(lane)?.steps),
  );
  const exhausted = modelList(modelRecord(parent.data.retry)?.exhausted);
  return [...direct, ...lanes, ...exhausted].flatMap((value) => {
    const id = modelText(modelRecord(value)?.id);
    if (id === null) throw new Error(`${parent.id}: a step needs a declared id.`);
    const step = declaredEntity(
      value,
      parent,
      parent.place,
      'step',
      nestedId(handler, [...path, id]),
    );
    return [step, ...stepEntities(step, handler, [...path, id])];
  });
}
function nestedEntities(entity: ModelEntity): readonly ModelEntity[] {
  if (entity.kind === 'interface') return children(entity, 'entries', 'endpoint');
  if (entity.kind === 'schema') return fieldEntities(entity);
  if (entity.kind === 'screen') return localChildren(entity, 'regions', 'region');
  if (entity.kind === 'graph') return children(entity, 'subgraphs', 'subgraph');
  if (entity.kind === 'flow') return localChildren(entity, 'steps', 'step');
  if (entity.kind !== 'handler') return [];
  const failures = modelList(entity.data.failures).map((value) => {
    const id = modelText(modelRecord(value)?.id);
    if (id === null) throw new Error(`${entity.id}: a failure needs a declared id.`);
    return declaredEntity(value, entity, entity.place, 'failure', failureId(entity.id, id));
  });
  return [...stepEntities(entity, entity.id, []), ...failures];
}
function systemEntities(system: ModelSystem, domain: ModelEntity): readonly ModelEntity[] {
  const place = { ...domain.place, system: system.id };
  const root = declaredEntity(system, domain, place, 'system');
  const components = system.components.map((component) =>
    declaredEntity(component, root, { ...place, component: component.id }),
  );
  const facets = [
    'interfaces',
    'messages',
    'subscriptions',
    'jobs',
    'interactions',
    'operations',
    'schemas',
    'screens',
    'handlers',
    'relationships',
  ];
  const records = facets.flatMap((key) => children(root, key));
  return [root, ...components, ...records.flatMap((record) => [record, ...nestedEntities(record)])];
}
function domainEntities(domain: ModelDomain, workspace: ModelEntity): readonly ModelEntity[] {
  const root = declaredEntity(
    domain,
    workspace,
    { ...workspace.place, domain: domain.id },
    'domain',
  );
  const concepts = modelList(domain.language?.concepts).map((value) =>
    declaredEntity(value, root, root.place, 'concept'),
  );
  const target = modelRecord(domain.target);
  const targetRoot = { ...root, data: target ?? {} };
  const targets = [
    ...localChildren(targetRoot, 'stages', 'stage'),
    ...localChildren(targetRoot, 'shifts', 'targetShift'),
  ];
  return [
    root,
    ...concepts,
    ...targets,
    ...domain.systems.flatMap((system) => systemEntities(system, root)),
  ];
}
const evidenceEntities = new WeakMap<
  WorkspaceModel['evidence'],
  Map<string, readonly ModelEntity[]>
>();

function evidenceEntitiesOf(model: WorkspaceModel, root: ModelEntity): readonly ModelEntity[] {
  const repositories = model.evidence;
  const kept = evidenceEntities.get(repositories) ?? new Map<string, readonly ModelEntity[]>();
  const known = kept.get(root.id);
  if (known !== undefined) return known;
  const evidence = repositories.flatMap((repo) => {
    const evidenceRecords = repo.records.map((value) =>
      declaredEntity(value.data, root, root.place, 'evidence'),
    );
    return repo.discovery?.id === undefined
      ? evidenceRecords
      : [...evidenceRecords, declaredEntity(repo.discovery, root, root.place, 'evidence')];
  });
  kept.set(root.id, evidence);
  evidenceEntities.set(repositories, kept);
  return evidence;
}

/** Walk declared identities once; children use their frozen ids, never their name or position. */
export function entitiesIn(model: WorkspaceModel): readonly ModelEntity[] {
  const place = { workspace: model.id, domain: null, system: null, component: null };
  const root = declaredEntity(model, null, place, 'workspace');
  const collections = [
    'teams',
    'actors',
    'libraries',
    'externals',
    'graphs',
    'flows',
    'journeys',
    'programmes',
  ];
  const records = collections.flatMap((key) => children(root, key));
  const terms = modelList(model.language?.terms).map((term) =>
    declaredEntity(term, root, place, 'keyTerm'),
  );
  const areas = modelList(model.landscape?.areas).map((area) =>
    declaredEntity(area, root, place, 'area'),
  );
  return [
    root,
    ...terms,
    ...areas,
    ...evidenceEntitiesOf(model, root),
    ...records.flatMap((record) => [record, ...nestedEntities(record)]),
    ...model.domains.flatMap((domain) => domainEntities(domain, root)),
  ];
}
