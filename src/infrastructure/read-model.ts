import 'server-only';

import path from 'node:path';

import { parse } from 'yaml';

import { EVIDENCE_FAMILIES, type EvidenceFamily } from '@/domain/evidence/evidence';
import { resolveModelCitations, type CitationScope } from '@/domain/model-cite-resolution';
import type {
  AuthoredModel,
  ModelData,
  ModelDomain,
  ModelGap,
  ModelEvidenceRecord,
  ModelRepository,
  ModelSystem,
  WorkspaceModel,
} from '@/domain/workspace-model';
import { listFolder, pathIn, readText, readTextIfAny } from '@/infrastructure/disk';

import { modelValidator, resolvedModelValidator } from './model-schema';
import { workspaceFolder } from './workspace-folders';
import { untilEdited } from './workspace-memo';

type Definition =
  | 'WorkspaceFile'
  | 'DomainFile'
  | 'SystemFile'
  | 'ContractsFile'
  | 'ScreensFile'
  | 'HandlersFile'
  | 'NarrativesFile'
  | 'DomainLanguageFile'
  | 'TargetFile'
  | 'LibrariesFile'
  | 'ExternalsFile'
  | 'AliasesFile'
  | 'LanguageFile'
  | 'LandscapeFile'
  | 'GraphFile'
  | 'FlowFile'
  | 'JourneyFile'
  | 'ProgrammeFile';
interface Reading {
  readonly workspace: string;
  readonly evidence: readonly ModelRepository[];
  readonly report: (problems: readonly ModelGap[]) => void;
  readonly folder: string;
}
const remembered = untilEdited<WorkspaceModel | null>(() => '', { evidence: true });

async function folders(folder: string): Promise<readonly string[]> {
  const entries = await listFolder(folder);
  return entries
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith('.'))
    .map((entry) => entry.name)
    .toSorted((a, b) => a.localeCompare(b, 'en'));
}
async function yamlFiles(folder: string): Promise<readonly string[]> {
  const entries = await listFolder(folder);
  return entries
    .filter((entry) => entry.isFile() && /\.ya?ml$/u.test(entry.name))
    .map((entry) => entry.name)
    .toSorted((a, b) => a.localeCompare(b, 'en'));
}
async function readFolders<Data>(
  folder: string,
  read: (child: string) => Promise<Data>,
): Promise<readonly Data[]> {
  const names = await folders(folder);
  return Promise.all(names.map(async (name) => read(pathIn(folder, name))));
}
async function authored<Def extends Definition>(
  file: string,
  definition: Def,
): Promise<AuthoredModel<Def> | null> {
  const text = await readTextIfAny(file);
  if (text === null) return null;
  const value: unknown = parse(text);
  const check = await modelValidator('workspace', definition);
  if (check(value)) return value;
  throw new Error(
    `${file}: ${JSON.stringify(check.errors?.map((error) => ({ path: error.instancePath, message: error.message })))}`,
  );
}
async function required<Def extends Definition>(
  file: string,
  definition: Def,
): Promise<AuthoredModel<Def>> {
  const value = await authored(file, definition);
  if (value === null) throw new Error(`${file}: required ${definition} file is missing.`);
  return value;
}
async function resolved<Def extends Definition>(
  definition: Def,
  value: AuthoredModel<Def>,
  scope: CitationScope,
  reading: Reading,
): Promise<ModelData<Def>> {
  const result = resolveModelCitations(definition, value, scope);
  const check = await resolvedModelValidator(definition);
  if (!check(result.data)) {
    throw new Error(
      `${scope.file}: resolved model failed ${definition}: ${JSON.stringify(check.errors)}`,
    );
  }
  reading.report(result.problems);
  return result.data;
}
async function optional<Def extends Definition>(
  file: string,
  definition: Def,
  scope: CitationScope,
  reading: Reading,
): Promise<ModelData<Def> | null> {
  const value = await authored(file, definition);
  return value === null
    ? null
    : resolved(definition, value, { ...scope, file: path.relative(reading.folder, file) }, reading);
}
function homesOf(systems: readonly ModelSystem[]): CitationScope['homes'] {
  const homes: Record<string, ModelData<'CodeHome'>[]> = {};
  for (const system of systems) {
    for (const [key, home] of Object.entries(system.homes ?? {})) {
      if (home !== undefined) homes[key] = [...(homes[key] ?? []), home];
    }
  }
  return homes;
}
function scopeOf(
  reading: Reading,
  homes: CitationScope['homes'],
  file: string,
  entity = reading.workspace,
): CitationScope {
  return { entity, homes, file: path.relative(reading.folder, file), evidence: reading.evidence };
}
function contractCollections(
  contracts: ModelData<'ContractsFile'>,
): Required<
  Pick<
    ModelData<'ContractsFile'>,
    'interfaces' | 'messages' | 'subscriptions' | 'jobs' | 'interactions' | 'operations' | 'schemas'
  >
> {
  return {
    interfaces: contracts.interfaces ?? [],
    messages: contracts.messages ?? [],
    subscriptions: contracts.subscriptions ?? [],
    jobs: contracts.jobs ?? [],
    interactions: contracts.interactions ?? [],
    operations: contracts.operations ?? [],
    schemas: contracts.schemas ?? [],
  };
}
async function readSystem(folder: string, reading: Reading): Promise<ModelSystem> {
  const file = pathIn(folder, 'system.yaml');
  const identity = await required(file, 'SystemFile');
  const homes = Object.fromEntries(
    Object.entries(identity.homes ?? {}).flatMap(([key, home]) =>
      home === undefined ? [] : [[key, [home]]],
    ),
  );
  const scope = scopeOf(reading, homes, file, identity.id);
  const system = await resolved('SystemFile', identity, scope, reading);
  const contracts: ModelData<'ContractsFile'> =
    (await optional(pathIn(folder, 'contracts.yaml'), 'ContractsFile', scope, reading)) ?? {};
  const screens = await optional(pathIn(folder, 'screens.yaml'), 'ScreensFile', scope, reading);
  const handlerFolder = pathIn(folder, 'handlers');
  const handlerFiles = await yamlFiles(handlerFolder);
  const handlers = await Promise.all(
    handlerFiles.map(
      async (name) =>
        (await optional(pathIn(handlerFolder, name), 'HandlersFile', scope, reading)) ?? [],
    ),
  );
  const narratives = await optional(
    pathIn(folder, 'narratives.yaml'),
    'NarrativesFile',
    scope,
    reading,
  );
  return {
    ...system,
    ...contracts,
    components: system.components ?? [],
    ...contractCollections(contracts),
    screens: screens?.screens ?? [],
    handlers: handlers.flat(),
    narratives,
  };
}
async function readDomain(folder: string, reading: Reading): Promise<ModelDomain> {
  const file = pathIn(folder, 'domain.yaml');
  const identity = await required(file, 'DomainFile');
  const systemsFolder = pathIn(folder, 'systems');
  const systems = await readFolders(systemsFolder, async (child) => readSystem(child, reading));
  const scope = scopeOf(reading, homesOf(systems), file, identity.id);
  const domain = await resolved('DomainFile', identity, scope, reading);
  const language = await optional(
    pathIn(folder, 'language.yaml'),
    'DomainLanguageFile',
    scope,
    reading,
  );
  const target = await authored(pathIn(folder, 'target.yaml'), 'TargetFile');
  return { ...domain, systems, language, target };
}
async function collection<Def extends Definition>(
  folder: string,
  definition: Def,
  scope: CitationScope,
  reading: Reading,
): Promise<readonly ModelData<Def>[]> {
  const files = await yamlFiles(folder);
  const values = await Promise.all(
    files.map(async (name) => optional(pathIn(folder, name), definition, scope, reading)),
  );
  return values.flatMap((value) => (value === null ? [] : [value]));
}
async function evidenceRecord<Family extends EvidenceFamily>(
  family: Family,
  value: unknown,
  file: string,
): Promise<ModelEvidenceRecord<Family>>;
async function evidenceRecord(
  family: EvidenceFamily,
  value: unknown,
  file: string,
): Promise<{ readonly family: EvidenceFamily; readonly data: unknown }> {
  const check = await modelValidator('evidence', family);
  if (!check(value)) throw new Error(`${file}: ${JSON.stringify(check.errors)}`);
  return { family, data: value };
}

async function evidenceFamily(
  folder: string,
  family: EvidenceFamily,
): Promise<readonly ModelEvidenceRecord[]> {
  const yaml = await readTextIfAny(pathIn(folder, `${family}.yaml`));
  const jsonl = await readTextIfAny(pathIn(folder, `${family}.jsonl`));
  const yamlValue: unknown = yaml === null ? null : parse(yaml);
  const values: readonly unknown[] = [
    ...(yaml === null ? [] : [yamlValue]),
    ...(jsonl === null
      ? []
      : jsonl
          .split('\n')
          .filter((line) => line.trim() !== '')
          .map((line): unknown => JSON.parse(line))),
  ];
  return Promise.all(
    values.map(async (value) => evidenceRecord(family, value, pathIn(folder, family))),
  );
}
async function readEvidenceRepository(folder: string): Promise<ModelRepository> {
  const file = pathIn(folder, 'repository.json');
  const value: unknown = JSON.parse(await readText(file));
  const check = await modelValidator('evidence', 'EvidenceRepository');
  if (!check(value)) throw new Error(`${file}: ${JSON.stringify(check.errors)}`);
  const records = await Promise.all(
    EVIDENCE_FAMILIES.map(async (family) => evidenceFamily(folder, family)),
  );
  const discoveryFile = pathIn(folder, 'discovery.json');
  const discoveryText = await readTextIfAny(discoveryFile);
  const discovery: unknown = discoveryText === null ? null : JSON.parse(discoveryText);
  const discoveryCheck = await modelValidator('evidence', 'EvidenceDiscovery');
  if (discovery !== null && !discoveryCheck(discovery)) {
    throw new Error(`${discoveryFile}: ${JSON.stringify(discoveryCheck.errors)}`);
  }
  return {
    repository: value,
    records: records.flat(),
    discovery: discoveryCheck(discovery) ? discovery : null,
  };
}
async function evidenceFolders(folder: string): Promise<readonly string[]> {
  if ((await readTextIfAny(pathIn(folder, 'repository.json'))) !== null) return [folder];
  const files = await listFolder(folder);
  const familyFiles = new Set(
    EVIDENCE_FAMILIES.flatMap((family) => [`${family}.yaml`, `${family}.jsonl`]),
  );
  if (files.some((entry) => entry.isFile() && familyFiles.has(entry.name))) {
    throw new Error(`${folder}: evidence records need repository.json with their repository pin.`);
  }
  const found = await readFolders(folder, evidenceFolders);
  return found.flat();
}

function uniqueEvidence(evidence: readonly ModelRepository[]): void {
  const repos = new Set<string>();
  const ids = new Set<string>();
  for (const record of evidence) {
    if (repos.has(record.repository.repo)) {
      throw new Error(`Duplicate evidence repository: ${record.repository.repo}`);
    }
    repos.add(record.repository.repo);
    const identities = [
      ...record.records.map((item) => item.data.id),
      ...(record.discovery?.id === undefined ? [] : [record.discovery.id]),
    ];
    for (const id of identities) {
      if (ids.has(id)) throw new Error(`Duplicate evidence id: ${id}`);
      ids.add(id);
    }
  }
}
async function readFolder(folder: string, id: string): Promise<WorkspaceModel> {
  const repositories = await evidenceFolders(pathIn(folder, 'evidence'));
  const evidence = await Promise.all(repositories.map(readEvidenceRepository));
  uniqueEvidence(evidence);
  const problems: ModelGap[] = [];
  const reading: Reading = {
    workspace: id,
    folder,
    evidence,
    report: (items) => {
      problems.push(...items);
    },
  };
  const workspaceFile = pathIn(folder, 'workspace.yaml');
  const workspace = await required(workspaceFile, 'WorkspaceFile');
  const domainFolder = pathIn(folder, 'domains');
  const domains = await readFolders(domainFolder, async (child) => readDomain(child, reading));
  const scope = scopeOf(
    reading,
    homesOf(domains.flatMap((domain) => domain.systems)),
    workspaceFile,
  );
  const identity = await resolved('WorkspaceFile', workspace, scope, reading);
  const libraries = await optional(
    pathIn(folder, 'libraries.yaml'),
    'LibrariesFile',
    scope,
    reading,
  );
  const externals = await optional(
    pathIn(folder, 'externals.yaml'),
    'ExternalsFile',
    scope,
    reading,
  );
  const aliases = await authored(pathIn(folder, 'aliases.yaml'), 'AliasesFile');
  const language = await optional(pathIn(folder, 'language.yaml'), 'LanguageFile', scope, reading);
  const landscape = await optional(
    pathIn(folder, 'landscape.yaml'),
    'LandscapeFile',
    scope,
    reading,
  );
  const graphs = await collection(pathIn(folder, 'graphs'), 'GraphFile', scope, reading);
  const flows = await collection(pathIn(folder, 'flows'), 'FlowFile', scope, reading);
  const journeys = await collection(pathIn(folder, 'journeys'), 'JourneyFile', scope, reading);
  const programmes = await collection(
    pathIn(folder, 'programmes'),
    'ProgrammeFile',
    scope,
    reading,
  );
  return {
    ...identity,
    domains,
    libraries: libraries?.libraries ?? [],
    externals: externals?.externals ?? [],
    aliases: aliases ?? {},
    language,
    landscape,
    graphs,
    flows,
    journeys,
    programmes,
    evidence,
    problems: problems.toSorted((a, b) =>
      `${a.id}/${a.at ?? ''}`.localeCompare(`${b.id}/${b.at ?? ''}`, 'en'),
    ),
  };
}
/** Read one registered workspace, retaining gaps and the same immutable value until its files change. */
export async function readModel(id: string, root?: string): Promise<WorkspaceModel | null> {
  return remembered(root, id, async () => {
    const folder = await workspaceFolder(id, root);
    return folder === null ? null : readFolder(folder, id);
  });
}

const frozenModels = untilEdited<WorkspaceModel>(() => '', { evidence: true });

/** Read frozen canonical inputs through the same boundary without changing workspace registration. */
export async function readModelFolder(folder: string, id: string): Promise<WorkspaceModel> {
  return frozenModels(folder, id, async () => readFolder(folder, id));
}
