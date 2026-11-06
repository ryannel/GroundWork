import path from 'node:path';

import { buildId, hasPrefix, idToToken, localId, parseId } from '@/domain/ids';
import type { ContractDefinition } from '@/domain/model/contracts.generated';
import { modelList, modelRecord, modelText } from '@/domain/workspace-model';

import { migrateCatalogues } from './catalogues';
import { convertCitations, migrationCitations, type MigrationCitations } from './citations';
import { detailIndex, identityRecord, migrateComponent } from './components';
import { migrateContracts, migrateScreens, subscriptionOf } from './contracts';
import { reconcileEdges } from './edges';
import { rewriteDocument, type MigrationFile } from './files';
import { migrateOperation } from './graphql';
import {
  migrationIdentities,
  migrationJobIdentities,
  type MigrationIdentities,
} from './identities';
import { migratePlan } from './plans';
import { fingerprint, type MigrationReview } from './review';
import { migrateFailures, migrateSteps, slug, type StepContext } from './steps';

type Node = Readonly<Record<string, unknown>>;
export type MigrationFragment =
  | {
      readonly family: 'workspace';
      readonly definition: Extract<ContractDefinition<'workspace'>, `${string}File`>;
      readonly value: unknown;
    }
  | { readonly family: 'plan'; readonly definition: 'document'; readonly value: unknown }
  | { readonly family: null; readonly value: unknown };
export interface MigratedWorkspace {
  readonly files: ReadonlyMap<string, MigrationFragment>;
  readonly identities: MigrationIdentities;
  readonly documents: ReadonlyMap<string, readonly Node[]>;
}
interface SystemInput {
  readonly folder: string;
  readonly source: Node;
  readonly contracts: Node;
  readonly handlers: readonly Node[];
  readonly citations: MigrationCitations;
}
function object(value: unknown, at: string): Node {
  const node = modelRecord(value);
  if (node === null) throw new Error(`${at}: expected an object.`);
  return node;
}
function nodes(value: unknown): readonly Node[] {
  return modelList(value).map((item) => object(item, 'collection'));
}
function pick(value: Node, keys: readonly string[]): Node {
  return Object.fromEntries(Object.entries(value).filter(([key]) => keys.includes(key)));
}
function declaredId(value: unknown, prefix: string): string {
  const text = modelText(value);
  if (text === null) throw new Error(`Missing ${prefix} identity.`);
  return buildId(prefix, localId(text));
}
function contextualFile(file: MigrationFile, identities: MigrationIdentities): MigrationFile {
  const value = rewriteDocument(file.value, identities.replacements);
  const node = modelRecord(value);
  if (node === null) return { ...file, value };
  if (file.path.endsWith('/domain.yaml')) {
    return { ...file, value: { ...node, id: declaredId(modelRecord(file.value)?.id, 'dom') } };
  }
  if (file.path.endsWith('/system.yaml')) {
    return { ...file, value: { ...node, id: declaredId(modelRecord(file.value)?.id, 'sys') } };
  }
  if (file.path !== 'landscape.yaml') return { ...file, value };
  const areas = nodes(node.areas).map((area) => ({ ...area, id: declaredId(area.id, 'area') }));
  const relationships = nodes(node.relationships).map((relation) => ({
    ...relation,
    from: declaredId(relation.from, 'area'),
    to: declaredId(relation.to, 'area'),
  }));
  const details = nodes(node.details).map((detail) => ({
    ...detail,
    area: declaredId(detail.area, 'area'),
  }));
  return { ...file, value: { ...node, format: 2, areas, relationships, details } };
}
function systemInputs(
  files: readonly MigrationFile[],
  review: MigrationReview,
): readonly SystemInput[] {
  const byPath = new Map(files.map((file) => [file.path, file.value]));
  return files
    .filter((file) => file.path.endsWith('/system.yaml'))
    .map((file) => {
      const folder = path.posix.dirname(file.path);
      const source = object(file.value, file.path);
      const contracts = modelRecord(byPath.get(`${folder}/contracts.yaml`)) ?? {};
      const handlers = nodes(modelRecord(byPath.get(`${folder}/handlers.yaml`))?.handlers);
      const citations = migrationCitations(
        modelList(source.repos),
        review,
        modelText(source.id) ?? '',
      );
      return { folder, source, contracts, handlers, citations };
    });
}
function interfaceGroups(
  systems: readonly SystemInput[],
  identities: MigrationIdentities,
): ReadonlyMap<string, readonly Node[]> {
  const folders = new Map(systems.map((system) => [system.source.id, system.folder]));
  const placements = new Map(
    [...identities.placements].map(([id, system]) => [
      identities.replacements.get(id) ?? id,
      folders.get(system),
    ]),
  );
  const grouped = new Map<string, readonly Node[]>();
  for (const system of systems) {
    for (const contract of nodes(system.contracts.interfaces)) {
      const provider = modelText(contract.service) ?? modelText(contract.component);
      const mapped = provider !== null && ['svc', 'app'].includes(parseId(provider)?.prefix ?? '');
      const folder = mapped ? (placements.get(provider) ?? system.folder) : system.folder;
      grouped.set(folder, [...(grouped.get(folder) ?? []), contract]);
    }
  }
  return grouped;
}
function migrateHandler(
  handler: Node,
  system: SystemInput,
  review: MigrationReview,
): { readonly handler: Node; readonly subscription: Node | null; readonly job: Node | null } {
  const id = modelText(handler.id) ?? '';
  const cites = system.citations.convert(handler);
  const subscription = subscriptionOf(handler, cites);
  const on = modelText(handler.on) ?? '';
  const job = hasPrefix(on, 'job')
    ? {
        id: buildId('job', localId(id)),
        component: handler.component,
        name: localId(on),
        trigger: localId(on),
        ...(cites.length === 0 ? {} : { cites }),
      }
    : null;
  const context: StepContext = {
    path: id,
    review,
    cites,
    assigned: null,
    cite: (value, inherited) => system.citations.convert(value, inherited),
  };
  const failures = migrateFailures(modelList(handler.fails ?? handler.failures), context);
  return {
    handler: {
      ...pick(handler, ['id', 'component', 'summary']),
      on: subscription?.id ?? job?.id ?? on,
      steps: migrateSteps(modelList(handler.steps), context),
      ...(failures.length === 0 ? {} : { failures }),
      ...(cites.length === 0 ? {} : { cites }),
    },
    subscription,
    job,
  };
}
function uniqueRecords(values: readonly Node[]): readonly Node[] {
  const records = new Map<unknown, Node>();
  for (const value of values) {
    const previous = records.get(value.id);
    if (previous === undefined) {
      records.set(value.id, value);
      continue;
    }
    const cites = [...new Set([...modelList(previous.cites), ...modelList(value.cites)])];
    const original = Object.fromEntries(
      Object.entries(previous).filter(([key]) => key !== 'cites'),
    );
    const current = Object.fromEntries(Object.entries(value).filter(([key]) => key !== 'cites'));
    if (fingerprint(original) !== fingerprint(current)) {
      throw new Error(`Conflicting declarations: ${String(value.id)}`);
    }
    records.set(value.id, { ...previous, ...(cites.length === 0 ? {} : { cites }) });
  }
  return [...records.values()];
}
function handlerFiles(
  handlers: readonly Node[],
  folder: string,
): ReadonlyMap<string, readonly Node[]> {
  const groups = new Map<string, readonly Node[]>();
  for (const handler of handlers) {
    const file = `${folder}/handlers/${idToToken(modelText(handler.component) ?? '')}.yaml`;
    groups.set(file, [...(groups.get(file) ?? []), handler]);
  }
  return groups;
}
function systemComponents(
  system: SystemInput,
  details: ReadonlyMap<string, readonly Node[]>,
  identities: MigrationIdentities,
  review: MigrationReview,
): {
  readonly components: readonly Node[];
  readonly externals: readonly Node[];
  readonly libraries: readonly Node[];
  readonly unmapped: readonly Node[];
} {
  const components: Node[] = [];
  const externals: Node[] = [];
  const libraries: Node[] = [];
  const unmapped: Node[] = [];
  const retired = new Map([...identities.replacements].map(([before, after]) => [after, before]));
  for (const component of nodes(system.source.components)) {
    const id = modelText(component.id) ?? '';
    const old = retired.get(id) ?? id;
    const descriptions = details.get(id) ?? [];
    const kind = identities.externalKinds.get(old);
    if (kind === 'external') {
      externals.push(identityRecord(component, descriptions, system.citations));
    } else if (kind === 'system') {
      const record = identityRecord(component, descriptions, system.citations);
      unmapped.push({
        id,
        name: record.name,
        mapped: false,
        ...(record.summary === undefined ? {} : { purpose: record.summary }),
        ...(record.cites === undefined ? {} : { cites: record.cites }),
      });
    } else if (component.type === 'library') {
      libraries.push(identityRecord(component, descriptions, system.citations));
    } else {
      components.push(migrateComponent(component, descriptions, system.citations, review));
    }
  }
  return { components, externals, libraries, unmapped };
}
function operationsOf(
  system: SystemInput,
  review: MigrationReview,
  recordDocument: (repo: string, record: Node) => void,
): readonly Node[] {
  return nodes(system.contracts.operations).map((value) => {
    const migrated = migrateOperation(value, review);
    if (migrated.record !== null && migrated.repo !== null) {
      recordDocument(migrated.repo, migrated.record);
    }
    const cites = system.citations.convert(value);
    return { ...migrated.operation, ...(cites.length === 0 ? {} : { cites }) };
  });
}
function nativeSystem(
  system: SystemInput,
  interfaces: readonly Node[],
  details: ReadonlyMap<string, readonly Node[]>,
  identities: MigrationIdentities,
  review: MigrationReview,
  recordDocument: (repo: string, record: Node) => void,
): {
  readonly system: Node;
  readonly contracts: Node;
  readonly handlers: readonly Node[];
  readonly screens: readonly Node[];
  readonly externals: readonly Node[];
  readonly libraries: readonly Node[];
  readonly unmapped: readonly Node[];
} {
  const components = systemComponents(system, details, identities, review);
  const handlers = system.handlers.map((handler) => migrateHandler(handler, system, review));
  const operations = operationsOf(system, review, recordDocument);
  const contracts = migrateContracts(
    { ...system.contracts, interfaces, operations: [] },
    { citations: system.citations, review },
  );
  const screens = migrateScreens(modelList(system.contracts.screens), system.citations);
  const native = {
    ...pick(system.source, ['id', 'name', 'purpose', 'team', 'runs_on', 'mapped']),
    components: components.components,
    homes: system.citations.homes(),
  };
  return {
    ...components,
    system: native,
    contracts: {
      ...contracts,
      operations,
      jobs: uniqueRecords([
        ...nodes(contracts.jobs),
        ...handlers.flatMap((value) => (value.job === null ? [] : [value.job])),
      ]),
      subscriptions: uniqueRecords([
        ...nodes(contracts.subscriptions),
        ...handlers.flatMap((value) => (value.subscription === null ? [] : [value.subscription])),
      ]),
    },
    handlers: handlers.map((value) => value.handler),
    screens,
  };
}
function nativeFlow(value: unknown, citations: MigrationCitations): unknown {
  const flow = modelRecord(convertCitations(value, citations));
  if (flow === null) return value;
  const steps = nodes(flow.steps).map((step) => {
    const projected = { ...step, id: parseId(step.id)?.path.at(-1) ?? step.id };
    if (parseId(step.via) !== null) return projected;
    return {
      ...Object.fromEntries(Object.entries(projected).filter(([key]) => key !== 'via')),
      transport: step.via,
    };
  });
  return { ...flow, steps };
}
function landscapeBacks(value: unknown, sources: ReadonlyMap<string, readonly unknown[]>): unknown {
  if (Array.isArray(value)) return value.map((item) => landscapeBacks(item, sources));
  const node = modelRecord(value);
  if (node === null) return value;
  const converted = Object.fromEntries(
    Object.entries(node).map(([key, item]) => [
      key === 'evidence' && node.from !== undefined && node.to !== undefined ? 'backs' : key,
      landscapeBacks(item, sources),
    ]),
  );
  if (node.evidence === undefined || node.from === undefined || node.to === undefined) {
    return converted;
  }
  const cites = modelList(node.evidence).flatMap((id) =>
    typeof id === 'string' ? (sources.get(id) ?? []) : [],
  );
  return { ...converted, ...(cites.length === 0 ? {} : { cites: [...new Set(cites)] }) };
}
function nativeLandscape(
  value: unknown,
  citations: MigrationCitations,
  sources: ReadonlyMap<string, readonly unknown[]>,
): unknown {
  const node = modelRecord(convertCitations(landscapeBacks(value, sources), citations));
  if (node === null) return value;
  return {
    ...node,
    areas: nodes(node.areas).map((area) =>
      Object.fromEntries(Object.entries(area).filter(([key]) => key !== 'evidence_count')),
    ),
  };
}
function auxiliary(
  file: MigrationFile,
  citations: MigrationCitations,
  sources: ReadonlyMap<string, readonly unknown[]>,
): MigrationFragment {
  if (file.path.startsWith('flows/')) {
    return {
      family: 'workspace',
      definition: 'FlowFile',
      value: nativeFlow(file.value, citations),
    };
  }
  if (file.path.startsWith('programmes/') && file.path.endsWith('/programme.yaml')) {
    const node = object(convertCitations(file.value, citations), file.path);
    return {
      family: 'workspace',
      definition: 'ProgrammeFile',
      value: { ...node, id: declaredId(node.id, 'prog') },
    };
  }
  if (file.path.endsWith('/domain.yaml')) {
    return {
      family: 'workspace',
      definition: 'DomainFile',
      value: convertCitations(file.value, citations),
    };
  }
  if (file.path === 'landscape.yaml') {
    return {
      family: 'workspace',
      definition: 'LandscapeFile',
      value: nativeLandscape(file.value, citations, sources),
    };
  }
  if (file.path === 'language.yaml') {
    return {
      family: 'workspace',
      definition: 'LanguageFile',
      value: convertCitations(file.value, citations),
    };
  }
  if (file.path.endsWith('/language.yaml')) {
    return {
      family: 'workspace',
      definition: 'DomainLanguageFile',
      value: convertCitations(file.value, citations),
    };
  }
  if (file.path.endsWith('/target.yaml')) {
    return {
      family: 'workspace',
      definition: 'TargetFile',
      value: (() => {
        const target = object(convertCitations(file.value, citations), file.path);
        return {
          ...target,
          stages: nodes(target.stages).map((stage) => ({
            ...stage,
            id: localId(modelText(stage.id) ?? ''),
          })),
        };
      })(),
    };
  }
  return { family: null, value: file.value };
}
function auxiliaryFiles(
  files: readonly MigrationFile[],
  systems: readonly SystemInput[],
  existing: ReadonlyMap<string, MigrationFragment>,
  citations: MigrationCitations,
  sources: ReadonlyMap<string, readonly unknown[]>,
  review: MigrationReview,
): ReadonlyMap<string, MigrationFragment> {
  const placements = new Map(
    systems.flatMap((system) =>
      nodes(system.source.components).flatMap((component) => {
        const id = modelText(component.id);
        return id === null ? [] : [[id, modelText(system.source.id) ?? ''] as const];
      }),
    ),
  );
  const output = new Map<string, MigrationFragment>();
  const remaining = files.filter(
    (file) =>
      !existing.has(file.path) && !/\/(?:handlers|contracts|system)\.yaml$/u.test(file.path),
  );
  for (const file of remaining) {
    if (/^plans\/.*(?:plan|revisions\/[^/]+)\.yaml$/u.test(file.path)) {
      output.set(file.path, {
        family: 'plan',
        definition: 'document',
        value: migratePlan(file.value, { path: file.path, review, citations, placements }),
      });
    } else {
      const fragment = auxiliary(file, citations, sources);
      output.set(file.path, fragment);
      if (file.path.startsWith('programmes/') && file.path.endsWith('/programme.yaml')) {
        const id = modelText(modelRecord(fragment.value)?.id) ?? '';
        output.set(`programmes/${localId(id)}.yaml`, fragment);
      }
    }
  }
  return output;
}
function finishWorkspace(
  existing: ReadonlyMap<string, MigrationFragment>,
  systems: readonly SystemInput[],
  files: readonly MigrationFile[],
  identities: MigrationIdentities,
): ReadonlyMap<string, MigrationFragment> {
  const output = new Map(existing);
  const aliases: Record<string, { readonly to: string | null; readonly reason: string }> =
    Object.fromEntries(
      [...identities.replacements].map(([before, after]) => [
        before,
        { to: after, reason: 'Canonical model identity.' },
      ]),
    );
  for (const [before, alternatives] of identities.ambiguous) {
    aliases[before] = {
      to: null,
      reason: `Ambiguous legacy id; use ${alternatives.join(' or ')}.`,
    };
  }
  const jobs = migrationJobIdentities(files);
  for (const [file, fragment] of output) {
    output.set(file, { ...fragment, value: rewriteDocument(fragment.value, jobs.replacements) });
  }
  for (const system of systems) {
    const file = `${system.folder}/system.yaml`;
    const fragment = output.get(file);
    if (fragment !== undefined) {
      output.set(file, {
        ...fragment,
        value: { ...object(fragment.value, file), homes: system.citations.homes() },
      });
    }
  }
  output.set('aliases.yaml', {
    family: 'workspace',
    definition: 'AliasesFile',
    value: { ...aliases, ...jobs.aliases },
  });
  return output;
}
export function migrateWorkspace(
  input: readonly MigrationFile[],
  review: MigrationReview,
): MigratedWorkspace {
  const identities = migrationIdentities(input, review);
  const files = input.map((file) => contextualFile(file, identities));
  const systems = systemInputs(files, review);
  const details = detailIndex(files.filter((file) => file.path.endsWith('/contracts.yaml')));
  const interfaces = interfaceGroups(systems, identities);
  const output = new Map<string, MigrationFragment>();
  const documents = new Map<string, readonly Node[]>();
  const nativeSystems = new Map<string, ReturnType<typeof nativeSystem>>();
  const externals: Node[] = [];
  const libraries: Node[] = [];
  for (const system of systems) {
    const native = nativeSystem(
      system,
      interfaces.get(system.folder) ?? [],
      details,
      identities,
      review,
      (repo, record) => {
        documents.set(repo, [...(documents.get(repo) ?? []), record]);
      },
    );
    nativeSystems.set(system.folder, native);
    output.set(`${system.folder}/system.yaml`, {
      family: 'workspace',
      definition: 'SystemFile',
      value: native.system,
    });
    output.set(`${system.folder}/contracts.yaml`, {
      family: 'workspace',
      definition: 'ContractsFile',
      value: native.contracts,
    });
    output.set(`${system.folder}/screens.yaml`, {
      family: 'workspace',
      definition: 'ScreensFile',
      value: { screens: native.screens },
    });
    for (const [file, handlers] of handlerFiles(native.handlers, system.folder)) {
      output.set(file, { family: 'workspace', definition: 'HandlersFile', value: handlers });
    }
    for (const unmapped of native.unmapped) {
      output.set(
        `${path.posix.dirname(system.folder)}/${slug(localId(modelText(unmapped.id) ?? ''))}/system.yaml`,
        {
          family: 'workspace',
          definition: 'SystemFile',
          value: { ...unmapped, homes: system.citations.homes() },
        },
      );
    }
    externals.push(...native.externals);
    libraries.push(...native.libraries);
  }
  for (const [folder, value] of reconcileEdges(systems, nativeSystems, review)) {
    output.set(`${folder}/system.yaml`, { family: 'workspace', definition: 'SystemFile', value });
  }
  const globalCitations = migrationCitations([], review, 'workspace');
  const sources = new Map<string, readonly unknown[]>();
  function gather(value: unknown): void {
    if (Array.isArray(value)) {
      for (const item of value) gather(item);
      return;
    }
    const node = modelRecord(value);
    if (node === null) return;
    if (typeof node.id === 'string' && modelList(node.cites).length > 0) {
      sources.set(node.id, modelList(node.cites));
    }
    for (const item of Object.values(node)) gather(item);
  }
  for (const fragment of output.values()) gather(fragment.value);

  for (const [file, fragment] of auxiliaryFiles(
    files,
    systems,
    output,
    globalCitations,
    sources,
    review,
  )) {
    output.set(file, fragment);
  }
  const contracts = new Map(
    [...output].flatMap(([file, fragment]) => {
      const value = modelRecord(fragment.value);
      return fragment.family === 'workspace' &&
        fragment.definition === 'ContractsFile' &&
        value !== null
        ? [[file, value] as const]
        : [];
    }),
  );
  for (const file of migrateCatalogues(files, systems, contracts, review)) {
    output.set(file.path, { family: 'workspace', definition: file.definition, value: file.value });
  }
  const workspace = object(
    files.find((file) => file.path === 'workspace.yaml')?.value,
    'workspace.yaml',
  );
  output.set('workspace.yaml', {
    family: 'workspace',
    definition: 'WorkspaceFile',
    value: {
      ...pick(workspace, ['id', 'name', 'description', 'private', 'teams', 'actors']),
      format: 2,
    },
  });
  output.set('externals.yaml', {
    family: 'workspace',
    definition: 'ExternalsFile',
    value: { externals: uniqueRecords(externals) },
  });
  output.set('libraries.yaml', {
    family: 'workspace',
    definition: 'LibrariesFile',
    value: { libraries: uniqueRecords(libraries) },
  });
  return { files: finishWorkspace(output, systems, files, identities), identities, documents };
}
