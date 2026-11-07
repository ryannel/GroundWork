import { createHash, timingSafeEqual } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { modelList, modelRecord } from '@/domain/workspace-model';
import { moduleUses } from '@/infrastructure/scan/module-uses';

export interface Candidate {
  readonly file: string;
  readonly category: string;
  readonly hits: readonly { readonly line: number; readonly text: string }[];
}
export interface Disposition {
  readonly file: string;
  readonly sourceSha256: string | null;
  readonly role: 'consumer' | 'producer' | 'retirement' | 'support';
  readonly status?: 'adapter' | 'migrated' | 'deleted';
  readonly reason: string;
  readonly stage?: 9 | 10;
  readonly evidence: readonly {
    readonly file: string;
    readonly line: number;
    readonly text: string;
  }[];
  readonly proofs: readonly { readonly file: string; readonly sha256: string }[];
}
export interface ConsumerRow extends Candidate {
  readonly original: Candidate | null;
  readonly present: boolean;
  readonly sourceSha256: string | null;
  readonly role: string;
  readonly status: 'adapter' | 'migrated' | 'deleted' | 'pending' | 'reference';
  readonly reason: string;
  readonly stage?: 9 | 10;
  readonly reachable: boolean;
  readonly factBindings: readonly string[];
  readonly legacyDependency: boolean;
  readonly legacyPath: readonly string[];
  readonly activeLegacyPath: readonly string[];
  readonly legacyUses: readonly { readonly line: number; readonly text: string }[];
  readonly disposition?: Disposition;
}
export async function readInventorySource(file: string): Promise<string | null> {
  try {
    return await readFile(file, 'utf8');
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return null;
    throw error;
  }
}
export function usesCanonicalModel(text: string): boolean {
  return /@\/(?:application\/(?:model-[\w-]+|plans-index)|infrastructure\/(?:read-model|model-[\w-]+|canonical-model)|domain\/workspace-model)/u.test(
    text,
  );
}
export const sourceHash = (text: string): string => createHash('sha256').update(text).digest('hex');

function structuralRole(candidate: Candidate): string | null {
  const { file, category } = candidate;
  if (category === 'documentation' || /^(?:AGENTS\.md|\.github\/)/u.test(file)) {
    return 'documentation';
  }
  if (category === 'fixture or test' || /\.test\.[cm]?[jt]sx?$/u.test(file)) {
    return 'fixture or test';
  }
  if (category === 'skill') return 'skill';
  if (category === 'quality configuration' || file === 'package.json') return 'configuration';
  if (category === 'package script') return 'command';
  if (file.startsWith('schema/')) return 'schema';
  if (file.startsWith('workspaces/')) return 'example';
  return null;
}
function modulePath(file: string, specifier: string): string | null {
  if (specifier.startsWith('@/')) return path.posix.normalize(`src/${specifier.slice(2)}`);
  if (specifier.startsWith('.')) return path.posix.join(path.posix.dirname(file), specifier);
  return null;
}
function importTarget(
  file: string,
  specifier: string,
  files: ReadonlyMap<string, string>,
): string | undefined {
  const base = modulePath(file, specifier);
  if (base === null) return undefined;
  return [
    base,
    `${base}.ts`,
    `${base}.tsx`,
    `${base}.js`,
    `${base}/index.ts`,
    `${base}/index.tsx`,
  ].find((candidate) => files.has(candidate));
}
function importedFiles(
  file: string,
  inspection: ReturnType<typeof moduleUses>,
  files: ReadonlyMap<string, string>,
): readonly string[] {
  return inspection.imports
    .filter((item) => item.runtime)
    .flatMap(({ specifier }) => {
      const target = importTarget(file, specifier, files);
      return target === undefined ? [] : [target];
    });
}
type Inspection = ReturnType<typeof moduleUses>;
type Imported = Inspection['imports'][number];
interface Dependencies {
  readonly files: ReadonlyMap<string, string>;
  readonly inspections: ReadonlyMap<string, Inspection>;
}
function modelImport(file: string, item: Imported, context: Dependencies): Imported {
  const target = importTarget(file, item.specifier, context.files);
  const literals =
    target === undefined ? [] : (context.inspections.get(target)?.literalExports ?? []);
  if (item.symbols.length === 0 || literals.length === 0) return item;
  const retained = item.symbols
    .map((symbol, position) => ({ symbol, name: item.names[position] }))
    .filter(({ symbol }) => !literals.includes(symbol));
  return {
    ...item,
    runtime: item.runtime && retained.length > 0,
    symbols: retained.map(({ symbol }) => symbol),
    names: retained.flatMap(({ name }) => name ?? []),
  };
}
function modelImports(file: string, inspection: Inspection, context: Dependencies): Inspection {
  return {
    ...inspection,
    imports: inspection.imports.map((item) => modelImport(file, item, context)),
  };
}
function exportedFrom(
  file: string,
  symbol: string,
  inspection: Inspection,
  context: Dependencies,
): { readonly target: string; readonly imported: string } | null {
  const matches = inspection.imports
    .filter((item) => item.runtime)
    .flatMap((item) =>
      item.reexports
        .filter((binding) => binding.exposed === symbol)
        .map((binding) => ({ specifier: item.specifier, imported: binding.imported })),
    );
  const selected = matches[0];
  if (selected === undefined || matches.length !== 1) return null;
  const target = importTarget(file, selected.specifier, context.files);
  return target === undefined ? null : { target, imported: selected.imported };
}
function invokedTools(
  files: ReadonlyMap<string, string>,
  known: ReadonlyMap<string, readonly string[]>,
): readonly string[] {
  return [...files]
    .filter(([file]) => file === 'package.json' || file.startsWith('.agents/skills/'))
    .flatMap(([, text]) =>
      [...text.matchAll(/tools\/[\w./-]+\.[cm]?[jt]s/gu)]
        .map((match) => match[0])
        .filter((file) => known.has(file)),
    );
}
function sourceGraph(files: ReadonlyMap<string, string>): {
  readonly graph: ReadonlyMap<string, readonly string[]>;
  readonly inspections: ReadonlyMap<string, ReturnType<typeof moduleUses>>;
} {
  const inspections = new Map(
    [...files]
      .filter(([file]) => /\.[cm]?[jt]sx?$/u.test(file) && !file.includes('.test.'))
      .map(([file, text]) => [file, moduleUses(file, text)]),
  );
  const graph = new Map(
    [...inspections].map(([file, inspection]) => [file, importedFiles(file, inspection, files)]),
  );
  return { graph, inspections };
}
interface EntryPoints {
  readonly app: readonly string[];
  readonly commands: readonly string[];
}
function entryPoints(
  files: ReadonlyMap<string, string>,
  graph: ReadonlyMap<string, readonly string[]>,
): EntryPoints {
  const known = [...graph.keys()];
  const app = known.filter((file) =>
    /^(?:src\/app\/(?:.*\/)?(?:page|route|layout|template|default|loading|error|not-found)\.tsx?|src\/(?:proxy|middleware)\.ts)$/u.test(
      file,
    ),
  );
  const tools = known.filter(
    (file) => file.startsWith('tools/') && /process\.argv|parseArgs\(/u.test(files.get(file) ?? ''),
  );
  return { app, commands: [...new Set([...tools, ...invokedTools(files, graph)])] };
}
function liveFiles(
  roots: EntryPoints,
  graph: ReadonlyMap<string, readonly string[]>,
): ReadonlySet<string> {
  const reachable = new Set<string>();
  const visit = (file: string): void => {
    if (reachable.has(file)) return;
    reachable.add(file);
    for (const dependency of graph.get(file) ?? []) visit(dependency);
  };
  for (const root of [...roots.app, ...roots.commands]) visit(root);
  return reachable;
}
const LEGACY_BOUNDARIES = new Set([
  'src/application/plan/derive.ts',
  'src/application/legacy-view.ts',
  'src/application/workspace-model.ts',
  'src/infrastructure/workspace-model.ts',
  'src/domain/workspace.ts',
]);
const FACT_CARRIERS = new Set([
  'Model',
  'Core',
  'Workspace',
  'WorkspaceModel',
  'Domain',
  'System',
  'Component',
  '*',
]);
function legacyImport(file: string, item: Imported): boolean {
  const target = modulePath(file, item.specifier);
  return (
    target !== null && (LEGACY_BOUNDARIES.has(target) || LEGACY_BOUNDARIES.has(`${target}.ts`))
  );
}
function legacyUses(file: string, inspection: Inspection | undefined): ConsumerRow['legacyUses'] {
  if (inspection === undefined) return [];
  const imported = inspection.imports.filter((item) => legacyImport(file, item));
  const runtime = imported
    .filter((item) => item.runtime)
    .flatMap<{ readonly line: number; readonly text: string }>((item) =>
      item.names.length === 0
        ? [item]
        : inspection.uses.filter((use) => item.names.includes(use.name)),
    );
  const types = new Set(
    imported.flatMap((item) =>
      item.typeNames.filter((_, position) => FACT_CARRIERS.has(item.typeSymbols[position] ?? '')),
    ),
  );
  // An erased annotation is not a model read; a value consumed through that actual legacy carrier is.
  return [...runtime, ...inspection.typedUses.filter((use) => types.has(use.typeName))];
}
type Slice = NonNullable<Inspection['slices']>[number];
interface Request {
  readonly file: string;
  readonly binding: string;
}
interface FactState {
  readonly edges: readonly Request[];
  readonly terminal: boolean;
}
const ALL = '*';
const EVALUATION = '';
const request = (file: string, binding = ALL): Request => ({ file, binding });
const requestKey = ({ file, binding }: Request): string => `${file}\0${binding}`;
function describeRequest({ file, binding }: Request): string {
  if (binding === ALL) return file;
  return `${file}#${binding === EVALUATION ? '(evaluation)' : binding}`;
}
function resolvedTarget(
  file: string,
  specifier: string,
  context: Dependencies,
): string | undefined {
  const target = importTarget(file, specifier, context.files);
  if (target !== undefined) return target;
  const base = modulePath(file, specifier);
  if (base === null) return undefined;
  return [base, `${base}.ts`].find((candidate) => LEGACY_BOUNDARIES.has(candidate));
}
function importedSteps(
  file: string,
  items: readonly Imported[],
  context: Dependencies,
  used: ReadonlySet<string> | null,
): readonly Request[] {
  return items
    .filter((item) => item.runtime)
    .flatMap((item) => {
      const target = resolvedTarget(file, item.specifier, context);
      if (target === undefined) return [];
      if (item.symbols.length === 0) return [request(target)];
      const symbols = item.symbols.filter((_, at) => {
        const local = item.names[at];
        return used === null || (local !== undefined && used.has(local));
      });
      return [request(target, EVALUATION), ...symbols.map((symbol) => request(target, symbol))];
    });
}
function typedFact(file: string, inspection: Inspection, uses: Inspection['typedUses']): boolean {
  const carriers = new Set(
    inspection.imports
      .filter((item) => legacyImport(file, item))
      .flatMap((item) =>
        item.typeNames.filter((_, at) => FACT_CARRIERS.has(item.typeSymbols[at] ?? '')),
      ),
  );
  return uses.some((use) => carriers.has(use.typeName));
}
function sliceFact(
  file: string,
  selected: readonly Slice[],
  inspection: Inspection,
  context: Dependencies,
): FactState {
  const local = new Map(inspection.slices?.map((slice) => [slice.name, slice]));
  const visited = new Set<Slice>();
  const used = new Set<string>();
  const pending = [...selected];
  for (let next = pending.pop(); next !== undefined; next = pending.pop()) {
    if (visited.has(next)) continue;
    visited.add(next);
    for (const use of next.uses) {
      used.add(use.name);
      const referenced = local.get(use.name);
      if (referenced !== undefined) pending.push(referenced);
    }
  }
  const staticImports = inspection.imports.filter((item) => !item.deferred);
  const slices = [...visited];
  return {
    terminal: typedFact(
      file,
      inspection,
      slices.flatMap((slice) => slice.typedUses),
    ),
    edges: [
      ...importedSteps(file, staticImports, context, used),
      ...importedSteps(
        file,
        slices.flatMap((slice) => slice.loads),
        context,
        null,
      ),
    ],
  };
}
function barrelFact(
  { file, binding }: Request,
  inspection: Inspection,
  context: Dependencies,
): FactState {
  const selected = exportedFrom(file, binding, inspection, context);
  const used = selected === null && binding !== EVALUATION ? null : new Set<string>();
  return {
    terminal: false,
    edges: [
      ...importedSteps(file, inspection.imports, context, used),
      ...(selected === null ? [] : [request(selected.target, selected.imported)]),
    ],
  };
}
function requestedSlices(at: Request, inspection: Inspection, context: Dependencies): FactState {
  const { file, binding } = at;
  const slices = inspection.slices ?? [];
  const local = slices.filter((slice) => slice.exported === binding);
  const selected = exportedFrom(file, binding, inspection, context);
  const known = binding === EVALUATION || local.length > 0 || selected !== null;
  const state = sliceFact(
    file,
    known ? [...slices.filter((slice) => slice.eager), ...local] : slices,
    inspection,
    context,
  );
  const exports = inspection.imports.filter((item) => item.reexports.length > 0);
  return {
    ...state,
    edges: [
      ...state.edges,
      ...(known ? [] : importedSteps(file, exports, context, null)),
      ...(selected === null ? [] : [request(selected.target, selected.imported)]),
    ],
  };
}
function factState(at: Request, context: Dependencies): FactState {
  const { file, binding } = at;
  const inspection = context.inspections.get(file);
  if (
    LEGACY_BOUNDARIES.has(file) &&
    binding !== EVALUATION &&
    inspection?.literalExports.includes(binding) !== true
  ) {
    return { terminal: true, edges: [] };
  }
  if (inspection === undefined) return { terminal: false, edges: [] };
  if (inspection.namedBarrel) return barrelFact(at, inspection, context);
  if (inspection.slices === null) {
    return {
      terminal: typedFact(file, inspection, inspection.typedUses),
      edges: importedSteps(file, inspection.imports, context, null),
    };
  }
  return requestedSlices(at, inspection, context);
}
function factGraph(initial: readonly Request[], context: Dependencies) {
  const reverse = new Map<string, string[]>();
  const forward = new Map<string, readonly Request[]>();
  const queued = new Set(initial.map(requestKey));
  const pending = [...new Map(initial.map((at) => [requestKey(at), at])).values()];
  const paths = new Map<string, readonly string[]>();
  const terminals: string[] = [];
  for (const current of pending) {
    const key = requestKey(current);
    const state = factState(current, context);
    forward.set(key, state.edges);
    if (state.terminal) {
      paths.set(key, [describeRequest(current)]);
      terminals.push(key);
    }
    for (const edge of state.edges) {
      const to = requestKey(edge);
      const incoming = reverse.get(to) ?? [];
      incoming.push(key);
      reverse.set(to, incoming);
      if (queued.has(to)) continue;
      queued.add(to);
      pending.push(edge);
    }
  }
  return { forward, reverse, paths, terminals };
}
type FactGraph = ReturnType<typeof factGraph>;
/** Breadth-first from all terminal legacy reads gives the shortest trace for each binding. */
function shortestFactPaths({
  reverse,
  paths,
  terminals,
}: FactGraph): ReadonlyMap<string, readonly string[]> {
  for (const found of terminals) {
    const route = paths.get(found) ?? [];
    for (const from of reverse.get(found) ?? []) {
      if (paths.has(from)) continue;
      const at = from.indexOf('\0');
      paths.set(from, [describeRequest(request(from.slice(0, at), from.slice(at + 1))), ...route]);
      terminals.push(from);
    }
  }
  return paths;
}
interface ActiveFacts {
  readonly bindings: ReadonlyMap<string, ReadonlySet<string>>;
  readonly legacyPaths: ReadonlyMap<string, readonly string[]>;
}
function activeFacts(
  roots: readonly Request[],
  forward: FactGraph['forward'],
  legacy: ReadonlyMap<string, readonly string[]>,
): ActiveFacts {
  const bindings = new Map<string, Set<string>>();
  const legacyPaths = new Map<string, readonly string[]>();
  const visited = new Map(roots.map((at) => [requestKey(at), [describeRequest(at)]]));
  const pending = [...roots];
  for (const at of pending) {
    const key = requestKey(at);
    const prefix = visited.get(key) ?? [];
    const suffix = legacy.get(key);
    const known = bindings.get(at.file) ?? new Set<string>();
    known.add(at.binding);
    bindings.set(at.file, known);
    if (suffix !== undefined) {
      const trace = [...prefix, ...suffix.slice(1)];
      const prior = legacyPaths.get(at.file);
      if (prior === undefined || trace.length < prior.length) legacyPaths.set(at.file, trace);
    }
    for (const next of forward.get(key) ?? []) {
      const nextKey = requestKey(next);
      if (visited.has(nextKey)) continue;
      visited.set(nextKey, [...prefix, describeRequest(next)]);
      pending.push(next);
    }
  }
  return { bindings, legacyPaths };
}
function factReachability(roots: EntryPoints, context: Dependencies) {
  const live = [
    ...roots.app.map((file) => request(file)),
    ...roots.commands.map((file) => request(file, EVALUATION)),
  ];
  const potential = [...context.inspections.keys()].map((file) => request(file));
  const graph = factGraph([...potential, ...live], context);
  const paths = shortestFactPaths(graph);
  const legacyPaths = new Map(
    potential.flatMap((at) => {
      const trace = paths.get(requestKey(at));
      return trace === undefined ? [] : [[at.file, trace] as const];
    }),
  );
  return { legacyPaths, active: activeFacts(live, graph.forward, paths) };
}
function referenceProblem(
  disposition: Disposition,
  files: ReadonlyMap<string, string>,
): string | null {
  if (
    disposition.reason.trim() === '' ||
    disposition.evidence.length === 0 ||
    disposition.proofs.length === 0
  ) {
    return 'A reviewed classification needs a reason, exact evidence and proof references.';
  }
  const proof = disposition.proofs.find(
    (item) =>
      files.get(item.file) === undefined || sourceHash(files.get(item.file) ?? '') !== item.sha256,
  );
  if (proof !== undefined) return `Missing or stale proof: ${proof.file}`;
  const evidence = disposition.evidence.find(
    (item) => files.get(item.file)?.split('\n')[item.line - 1]?.trim() !== item.text.trim(),
  );
  return evidence === undefined
    ? null
    : `Missing or stale evidence: ${evidence.file}:${String(evidence.line)}`;
}
function classificationProblem(
  disposition: Disposition,
  present: boolean,
  activeModelConsumer: boolean,
): string | null {
  if (disposition.role === 'retirement' && activeModelConsumer) {
    return 'A live runtime model dependency still reaches this proposed retirement.';
  }
  if (disposition.role === 'producer' && disposition.stage === undefined) {
    return 'A producer needs its explicit PR9 or PR10 proof assignment.';
  }
  if (disposition.role === 'retirement' && disposition.stage !== 10) {
    return 'Retirement needs its explicit PR10 proof assignment.';
  }
  if (disposition.status === 'deleted' && present) return 'The claimed deleted file still exists.';
  if (disposition.status === 'migrated' && !present) return 'The claimed migrated file is missing.';
  return null;
}
function proofProblem(
  disposition: Disposition,
  text: string | undefined,
  files: ReadonlyMap<string, string>,
  activeModelConsumer: boolean,
): string | null {
  const expected = Buffer.from(JSON.stringify(disposition.sourceSha256));
  const actual = Buffer.from(JSON.stringify(text === undefined ? null : sourceHash(text)));
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
    return 'The reviewed source hash is stale.';
  }
  return (
    referenceProblem(disposition, files) ??
    classificationProblem(disposition, text !== undefined, activeModelConsumer)
  );
}
function reviewedStatus(disposition: Disposition): ConsumerRow['status'] {
  if (disposition.role === 'consumer') return disposition.status ?? 'adapter';
  return disposition.role === 'support' ? 'reference' : 'pending';
}
interface ReviewContext extends Dependencies {
  readonly reachable: ReadonlySet<string>;
  readonly legacyPaths: ReadonlyMap<string, readonly string[]>;
  readonly active: ActiveFacts;
  readonly entryFiles: ReadonlySet<string>;
  readonly report: (issue: string) => void;
}
function reviewedRow(
  base: ConsumerRow,
  disposition: Disposition | undefined,
  context: ReviewContext,
): ConsumerRow {
  if (disposition === undefined) return base;
  const problem = proofProblem(
    disposition,
    context.files.get(base.file),
    context.files,
    base.activeLegacyPath.length > 0,
  );
  if (problem !== null) {
    context.report(`${base.file}: ${problem}`);
    return { ...base, reason: problem };
  }
  const unprovedBinding =
    base.legacyDependency && base.factBindings.length === 0 && !context.entryFiles.has(base.file);
  if (base.activeLegacyPath.length > 0 || (unprovedBinding && disposition.role !== 'retirement')) {
    return {
      ...base,
      reason: 'The current source still uses a legacy model boundary.',
      disposition,
    };
  }
  return {
    ...base,
    role: disposition.role,
    status: reviewedStatus(disposition),
    reason: disposition.reason,
    disposition,
    ...(disposition.stage === undefined ? {} : { stage: disposition.stage }),
  };
}
function structuralStage(file: string, role: string): 9 | 10 | undefined {
  if (role === 'skill') return 9;
  if (role === 'schema' && /legacy-plan|knowledge|scan-discovery|scan-interpretation/u.test(file)) {
    return 10;
  }
  return undefined;
}
function currentUses(file: string, context: Dependencies): ConsumerRow['legacyUses'] {
  const inspection = context.inspections.get(file);
  return legacyUses(
    file,
    inspection === undefined ? undefined : modelImports(file, inspection, context),
  );
}
function inventoryRow(
  candidate: Candidate,
  original: Candidate | null,
  disposition: Disposition | undefined,
  context: ReviewContext,
): ConsumerRow {
  const text = context.files.get(candidate.file);
  const base: ConsumerRow = {
    ...candidate,
    original,
    present: text !== undefined,
    sourceSha256: text === undefined ? null : sourceHash(text),
    reachable: context.reachable.has(candidate.file),
    factBindings: [...(context.active.bindings.get(candidate.file) ?? [])]
      .filter((binding) => binding !== EVALUATION)
      .toSorted((a, b) => a.localeCompare(b)),
    activeLegacyPath: context.active.legacyPaths.get(candidate.file) ?? [],
    legacyDependency: context.legacyPaths.has(candidate.file),
    legacyPath: context.legacyPaths.get(candidate.file) ?? [],
    legacyUses: currentUses(candidate.file, context),
    role: 'consumer',
    status: 'adapter',
    reason: 'No reviewed runtime responsibility and replacement proof.',
  };
  const structural = structuralRole(candidate);
  if (structural === null) return reviewedRow(base, disposition, context);
  const stage = structuralStage(candidate.file, structural);
  return {
    ...base,
    role: structural,
    status: stage === undefined ? 'reference' : 'pending',
    reason: 'Recorded separately from runtime model consumers.',
    ...(stage === undefined ? {} : { stage }),
  };
}
function activeEntryHit(file: string, trace: readonly string[], context: Dependencies) {
  const inspection = context.inspections.get(file);
  const target = trace[1]?.split('#')[0];
  const edge = inspection?.imports.find(
    (item) => target !== undefined && importTarget(file, item.specifier, context.files) === target,
  );
  const direct = currentUses(file, context)[0];
  if (edge !== undefined) return { line: edge.line, text: edge.text };
  if (direct !== undefined) return direct;
  return { line: 1, text: context.files.get(file)?.split('\n')[0]?.trim() ?? '' };
}
function activeEntryCandidates(
  entryFiles: ReadonlySet<string>,
  context: Dependencies,
  active: ActiveFacts,
): readonly Candidate[] {
  return [...entryFiles].flatMap((file) => {
    const trace = active.legacyPaths.get(file);
    if (trace === undefined || !context.files.has(file)) return [];
    return [
      {
        file,
        category: file.startsWith('tools/') ? 'tool' : 'route',
        hits: [activeEntryHit(file, trace, context)],
      },
    ];
  });
}
/** Preserve every original candidate; only reviewed current proof can clear a runtime adapter. */
export function consumerInventory(
  original: readonly Candidate[],
  current: readonly Candidate[],
  dispositions: readonly Disposition[],
  files: ReadonlyMap<string, string>,
): {
  readonly candidates: readonly ConsumerRow[];
  readonly consumers: readonly ConsumerRow[];
  readonly pending: readonly ConsumerRow[];
  readonly issues: readonly string[];
} {
  const originalBy = new Map(original.map((row) => [row.file, row]));
  const currentBy = new Map(current.map((row) => [row.file, row]));
  const reviewed = new Map(dispositions.map((row) => [row.file, row]));
  if (
    originalBy.size !== original.length ||
    currentBy.size !== current.length ||
    reviewed.size !== dispositions.length
  ) {
    throw new Error('Repeated consumer inventory file identity.');
  }
  const { graph, inspections } = sourceGraph(files);
  const roots = entryPoints(files, graph);
  const entryFiles = new Set([...roots.app, ...roots.commands]);
  const reachable = liveFiles(roots, graph);
  const { legacyPaths, active } = factReachability(roots, { files, inspections });
  for (const entry of activeEntryCandidates(entryFiles, { files, inspections }, active)) {
    if (!currentBy.has(entry.file) && !originalBy.has(entry.file)) currentBy.set(entry.file, entry);
  }
  const issues: string[] = [];
  for (const row of dispositions) {
    if (!originalBy.has(row.file) && !currentBy.has(row.file)) {
      issues.push(`Unknown reviewed candidate: ${row.file}`);
    }
  }
  const context = {
    files,
    reachable,
    legacyPaths,
    active,
    entryFiles,
    inspections,
    report: (issue: string) => {
      issues.push(issue);
    },
  };
  const candidates = [...new Set([...originalBy.keys(), ...currentBy.keys()])]
    .toSorted((a, b) => a.localeCompare(b))
    .map((file) => {
      const candidate = currentBy.get(file) ?? originalBy.get(file);
      if (candidate === undefined) throw new Error('Missing inventory candidate.');
      return inventoryRow(candidate, originalBy.get(file) ?? null, reviewed.get(file), context);
    });
  return {
    candidates,
    consumers: candidates.filter((row) => row.role === 'consumer'),
    pending: candidates.filter((row) => row.status === 'pending'),
    issues,
  };
}

function record(value: unknown): Readonly<Record<string, unknown>> {
  const result = modelRecord(value);
  if (result === null) throw new Error('Inventory metadata requires an object.');
  return result;
}
function listed(value: unknown): readonly unknown[] {
  if (!Array.isArray(value)) throw new Error('Inventory metadata requires an array.');
  return modelList(value);
}
function textField(value: Readonly<Record<string, unknown>>, key: string): string {
  const text = value[key];
  if (typeof text !== 'string') throw new Error(`Inventory metadata requires ${key}.`);
  return text;
}
function numberField(value: Readonly<Record<string, unknown>>, key: string): number {
  const number = value[key];
  if (typeof number !== 'number' || !Number.isInteger(number) || number < 1) {
    throw new Error(`Inventory metadata requires a positive ${key}.`);
  }
  return number;
}
export function candidateRows(value: unknown): readonly Candidate[] {
  return listed(value).map((item) => {
    const row = record(item);
    return {
      ...row,
      file: textField(row, 'file'),
      category: textField(row, 'category'),
      hits: listed(row.hits).map((hit) => {
        const at = record(hit);
        return { line: numberField(at, 'line'), text: textField(at, 'text') };
      }),
    };
  });
}
function dispositionOf(value: unknown): Disposition {
  const row = record(value);
  const roles: readonly Disposition['role'][] = ['consumer', 'producer', 'retirement', 'support'];
  const role = roles.find((candidate) => candidate === row.role);
  const statuses: readonly Disposition['status'][] = ['adapter', 'migrated', 'deleted'];
  const status = statuses.find((candidate) => candidate === row.status);
  if (role === undefined || (row.status !== undefined && status === undefined)) {
    throw new Error('Unknown reviewed inventory role or status.');
  }
  const sourceSha256 = row.sourceSha256;
  if (typeof sourceSha256 !== 'string' && sourceSha256 !== null) {
    throw new Error('A review must bind the complete current source hash or its absence.');
  }
  const stage = row.stage;
  if (stage !== undefined && stage !== 9 && stage !== 10) throw new Error('Unknown rebuild stage.');
  return {
    file: textField(row, 'file'),
    sourceSha256,
    role,
    reason: textField(row, 'reason'),
    ...(status === undefined ? {} : { status }),
    ...(stage === undefined ? {} : { stage }),
    evidence: listed(row.evidence).map((item) => {
      const at = record(item);
      return {
        file: textField(at, 'file'),
        line: numberField(at, 'line'),
        text: textField(at, 'text'),
      };
    }),
    proofs: listed(row.proofs).map((item) => {
      const proof = record(item);
      const file = textField(proof, 'file');
      if (file.endsWith('.gz')) {
        throw new Error(
          'Inventory proofs must be text receipts; pin compressed bytes inside a text receipt.',
        );
      }
      return { file, sha256: textField(proof, 'sha256') };
    }),
  };
}
export function inventoryReview(value: unknown): {
  readonly original: { readonly file: string; readonly sha256: string; readonly rows: number };
  readonly dispositions: readonly Disposition[];
} {
  const root = record(value);
  if (root.format !== 1) throw new Error('Unknown inventory review format.');
  const original = record(root.original);
  return {
    original: {
      file: textField(original, 'file'),
      sha256: textField(original, 'sha256'),
      rows: numberField(original, 'rows'),
    },
    dispositions: listed(root.dispositions).map(dispositionOf),
  };
}
