import { realpath } from 'node:fs/promises';
import path from 'node:path';
import { parseArgs } from 'node:util';

import { indexOf, type ModelIndex } from '@/application/model-index';
import { stringsIn } from '@/domain/evidence/evidence';
import { hasPrefix } from '@/domain/ids';
import { codeCitationResolver } from '@/domain/model-cite-resolution';
import { modelList, type ModelRepository } from '@/domain/workspace-model';
import { modelValidator } from '@/infrastructure/model-schema';
import { readModel } from '@/infrastructure/read-model';
import {
  readRepositoryPass,
  passArtifactDigest,
} from '@/infrastructure/scan/repository-pass-files';
import { selectedWorkspace } from '@/infrastructure/workspace-folders';

import { modelYaml } from './migrate-model/files';
import { acceptedScan } from './scan-model/accepted';
import { citedAnalysis } from './scan-model/analysis';
import { routeContracts } from './scan-model/contracts';
import { appendEvidence, evidenceDirectory, publishScan } from './scan-model/output';
import { refreshedFiles } from './scan-model/refresh';
import { scanSource, sourceKey, stepSpanOf } from './scan-model/source';

const SCANNED_KINDS = new Set([
  'handler',
  'step',
  'failure',
  'endpoint',
  'job',
  'subscription',
  'schema',
  'operation',
]);
const ENGLISH = (left: string, right: string): number => left.localeCompare(right, 'en');

function required(value: string | undefined): string {
  if (value === undefined || value === '') {
    throw new Error(
      'Usage: scan:model --workspace <id> --repo <org/name> --commit <sha> --clone-root <folder> --out <new-workspace>',
    );
  }
  return value;
}

function sourceOptions(args: readonly string[]) {
  const { values } = parseArgs({
    args: [...args],
    options: {
      workspace: { type: 'string' },
      repo: { type: 'string' },
      commit: { type: 'string' },
      'clone-root': { type: 'string' },
      out: { type: 'string' },
      accept: { type: 'string' },
      analysis: { type: 'string' },
      'source-pass': { type: 'string' },
    },
  });
  const repo = required(values.repo);
  const commit = required(values.commit);
  if (!/^[\w-][\w.-]*\/[\w-][\w.-]*$/u.test(repo) || !/^[a-f\d]{40,64}$/u.test(commit)) {
    throw new Error('Use an organisation/repository and full commit ID.');
  }
  return {
    workspace: required(values.workspace),
    repo,
    commit,
    repository: path.resolve(required(values['clone-root']), repo),
    out: path.resolve(required(values.out)),
    accept: values.accept,
    analysis: values.analysis,
    sourcePass: values['source-pass'],
  };
}

type ScanOptions = ReturnType<typeof sourceOptions>;
type Review = Awaited<ReturnType<typeof acceptedScan>>;

async function checkedSourcePass(options: ScanOptions, tree: string) {
  if (options.sourcePass === undefined) return null;
  const { plan, state } = await readRepositoryPass(options.sourcePass);
  if (plan.repo !== options.repo || plan.commit !== options.commit || plan.tree !== tree) {
    throw new Error('The source pass belongs to a different pinned tree.');
  }
  const digest = await passArtifactDigest(options.sourcePass, 'repository.json');
  if (state.status !== 'source_complete' || state.reportDigest !== digest) {
    throw new Error('The retained source pass is incomplete or has changed.');
  }
  return { digest, completedShards: state.completed.length };
}

function repositoryFacts(previous: ModelRepository) {
  const files = new Map(
    previous.records.flatMap(({ family, data }) =>
      family === 'files' ? [[data.path, data] as const] : [],
    ),
  );
  const sources = previous.records.flatMap(({ family, data }) =>
    family === 'sources' ? [data] : [],
  );
  const hosts = previous.records.flatMap(({ family, data }) =>
    family === 'hosts' ? [data.id] : [],
  );
  const [host] = hosts;
  if (host === undefined || hosts.length !== 1) {
    throw new Error('A repository source scan needs one unambiguous recorded source host.');
  }
  return { files, sources, host };
}

function observe(options: ScanOptions, index: ModelIndex, previous: ModelRepository) {
  const facts = repositoryFacts(previous);
  const locations = codeCitationResolver(index.model.evidence);
  const cited = index.entities
    .filter(({ kind }) => SCANNED_KINDS.has(kind))
    .map((entity) => ({
      id: entity.id,
      sources: modelList(entity.data.cites).length === 0 ? [] : locations(index.cites(entity.id)),
    }));
  const scan = scanSource({
    ...options,
    ...facts,
    references: cited.flatMap(({ sources }) => sources),
  });
  const additions = new Map(
    cited.map(({ id, sources }) => {
      const evidence = new Set(
        sources.flatMap((source) => {
          const record = scan.evidence.get(sourceKey(source));
          return record === undefined ? [] : [record.id];
        }),
      );
      return [id, [...evidence].toSorted(ENGLISH)] as const;
    }),
  );
  const observations = new Map([...scan.evidence.values()].map((source) => [source.id, source]));
  return { scan, additions, observations, files: facts.files, host: facts.host };
}

function citedIds(index: ModelIndex, review: Review): readonly string[] {
  const operationDocuments = index.entities.flatMap((entity) =>
    entity.kind === 'operation' ? [entity.data.document] : [],
  );
  const reviewCites = [
    ...[...review.handlers.values()].flatMap(({ observed }) => [...stringsIn(observed)]),
    ...[...review.contracts.values()].flatMap(({ cites }) => cites),
  ];
  return [
    ...index.model.problems.map(({ reference }) => reference),
    ...operationDocuments,
    ...reviewCites,
  ].filter((reference) => hasPrefix(reference, 'ev'));
}

async function evidencePlan(
  options: ScanOptions,
  index: ModelIndex,
  previous: ModelRepository,
  review: Review,
) {
  const observed = observe(options, index, previous);
  const evidenceIds = new Set(
    index.model.evidence.flatMap(({ records }) => records.map(({ data }) => data.id)),
  );
  const fresh = [...observed.observations.values()]
    .filter(({ id }) => !evidenceIds.has(id))
    .toSorted((a, b) => ENGLISH(a.id, b.id));
  const check = await modelValidator('evidence', 'Source');
  for (const source of fresh) {
    const id = source.id;
    if (!check(source)) {
      throw new Error(`Invalid source evidence ${id}: ${JSON.stringify(check.errors)}`);
    }
    evidenceIds.add(id);
  }
  const promoted = await citedAnalysis({
    receipt: options.analysis,
    repo: options.repo,
    repository: options.repository,
    commit: options.commit,
    requested: citedIds(index, review),
    present: evidenceIds,
    files: observed.files,
    hosts: new Set([observed.host]),
  });
  const sourceSpans = new Map(
    [...observed.observations].map(([id, source]) => [id, stepSpanOf(source)]),
  );
  for (const { family, value } of promoted) {
    evidenceIds.add(value.id);
    if (family === 'sources' && check(value)) {
      sourceSpans.set(value.id, stepSpanOf(value));
    }
  }
  return { ...observed, fresh, promoted, evidenceIds, sourceSpans };
}

async function evidenceWrites(
  folder: string,
  repo: string,
  entries: readonly { readonly family: string; readonly value: unknown }[],
) {
  const directory = await evidenceDirectory(folder, repo);
  const groups = new Map<string, unknown[]>();
  for (const { family, value } of entries) {
    const rows = groups.get(family) ?? [];
    rows.push(value);
    groups.set(family, rows);
  }
  const files = await Promise.all(
    [...groups].map(async ([family, rows]) => {
      const file = path.join(directory, `${family}.jsonl`);
      return [file, await appendEvidence(folder, file, rows)] as const;
    }),
  );
  return new Map(files);
}

function checkReviewTargets(review: Review, seen: ReadonlySet<string>): void {
  const missing = [...review.handlers.keys(), ...review.contracts.keys()].filter(
    (id) => !seen.has(id),
  );
  if (missing.length > 0) throw new Error(`Unknown scan review targets: ${missing.join(', ')}.`);
}

async function nativeScan(args: readonly string[]): Promise<void> {
  const options = sourceOptions(args);
  const selected = await selectedWorkspace(options.workspace);
  const folder = await realpath(selected.folder);
  const parent = await realpath(path.dirname(options.out));
  const out = path.join(parent, path.basename(options.out));
  if (out === folder || out.startsWith(`${folder}${path.sep}`)) {
    throw new Error('Use a new output workspace outside the registered workspace.');
  }
  const model = await readModel(selected.id);
  if (model === null) throw new Error('The workspace needs a consolidated model.');
  const previous = model.evidence.find(({ repository }) => repository.repo === options.repo);
  if (previous?.repository.commit !== options.commit) {
    throw new Error('The canonical workspace must already record this repository and source pin.');
  }
  const index = indexOf(model);
  const review = await acceptedScan(options.accept, options.repo, options.commit);
  const plan = await evidencePlan(options, index, previous, review);
  const sourcePass = await checkedSourcePass(options, plan.scan.tree);
  const updates = await refreshedFiles(folder, {
    additions: plan.additions,
    accepted: review,
    observedContracts: routeContracts(index, previous),
    sourceSpans: plan.sourceSpans,
    evidenceIds: plan.evidenceIds,
    schemaIds: new Set(index.entities.filter(({ kind }) => kind === 'schema').map(({ id }) => id)),
    aliases: model.aliases,
  });
  checkReviewTargets(review, new Set(updates.flatMap(({ seen }) => seen)));
  const retired = Object.fromEntries(updates.flatMap((update) => Object.entries(update.retired)));
  const writes = await evidenceWrites(folder, options.repo, [
    ...plan.fresh.map((value) => ({ family: 'sources', value })),
    ...plan.promoted,
  ]);
  for (const update of updates.filter(({ refreshed }) => refreshed > 0)) {
    writes.set(update.file, update.text);
  }
  const retiredSteps = Object.keys(retired);
  if (retiredSteps.length > 0) {
    writes.set('aliases.yaml', modelYaml({ ...model.aliases, ...retired }));
  }
  await publishScan({ folder, out, before: model, writes });
  const { tree, trackedFiles, selectedFiles, checkedFiles, checkedBlobs, unavailable } = plan.scan;
  const receipt = {
    workspace: selected.id,
    repo: options.repo,
    commit: options.commit,
    tree,
    trackedFiles,
    selectedFiles,
    checkedFiles,
    checkedBlobs,
    unavailable,
    sourcePass,
    refreshed: updates.reduce((count, update) => count + update.refreshed, 0),
    updatedFiles: writes.size,
    newEvidence: plan.fresh.length,
    promotedAnalysis: plan.promoted.length,
    ambiguousStepMatches: updates.flatMap((update) => update.ambiguities),
    retiredSteps,
  };
  process.stdout.write(`${JSON.stringify(receipt, null, 2)}\n`);
}

if (process.argv[1] === import.meta.filename) await nativeScan(process.argv.slice(2));
