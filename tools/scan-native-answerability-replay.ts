import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { isDeepStrictEqual } from 'node:util';

import type { ScanDocument } from '@/domain/scan/scan.generated';
import { scanValidator } from '@/infrastructure/scan/scan-format';

import { answerabilityProbe, type Probe } from './scan-answerability-probe';
import { answerabilityRequest } from './scan-answerability-request';
import { bindingReviewDocument, bindingReviewPages } from './scan-bindings-pages';
import {
  verifyAcceptedRoster,
  defaultResult,
  priorChecks,
  priorPages,
  replayArguments,
  replayManifest,
  type PriorPages,
} from './scan-native-replay-input';
import { exactReplayIdentity, semanticEdgeIdMigration } from './scan-native-replay-migration';
import { semanticGraph } from './scan-semantic-query';
import { springArchiveReasonProof } from './scan-spring-review-native';

const PIN = {
  repo: 'volvo-cars/cds-ecom-customer-service',
  commit: '09623ab3a1f39845d8fc02abc3d591b53a3b5fea',
};
const CORE_SCOPE = 'repository-0004';
const FROZEN = [
  ['repository-0001', 'Q08-force-archive'],
  ['repository-0003', 'Q16-consent-guards'],
  [CORE_SCOPE, 'Q07-equal-write'],
  [CORE_SCOPE, 'Q09-restore-order'],
  [CORE_SCOPE, 'Q15-postprocess-order'],
  [CORE_SCOPE, 'Q20-scheduler-call'],
  ['repository-0005', 'Q18-delete-id'],
] as const;
const MUTATIONS = [
  'reaching_value',
  'assigned_value',
  'condition',
  'left',
  'right',
  'consequent',
  'otherwise',
  'receiver',
] as const;
const LIMITS = { maxTotalRecords: 2048, maxTotalBytes: 16_777_216 };
interface ReplayInput {
  readonly document: ScanDocument;
  readonly probe: Probe;
  readonly prior: PriorPages;
  readonly scope: string;
  readonly sourceCapture: string;
  readonly migrateEdgeIds: boolean;
}

async function json(file: string): Promise<unknown> {
  return JSON.parse(await readFile(file, 'utf8'));
}
async function writeJson(file: string, value: unknown): Promise<void> {
  await writeFile(file, `${JSON.stringify(value, null, 2)}\n`, { flag: 'wx' });
}

/** Discover an owner slice independently of the assertions; proofs see only fresh bounded pages. */
function selection(document: ScanDocument, probe: Probe): readonly string[] {
  const graph = semanticGraph(document);
  const sources = new Set(
    document.sources
      .filter((source) => source.path === probe.sourcePath)
      .map((source) => source.id),
  );
  const owners = graph.nodes.filter(
    (node) =>
      node.nodeKind === 'function' && node.name === probe.functionName && sources.has(node.source),
  );
  if (owners.length !== 1 || owners[0] === undefined) {
    throw new Error(
      `${probe.id}: expected one current native owner, found ${String(owners.length)}.`,
    );
  }
  const owner = owners[0];
  const nodes = graph.nodes.filter((node) => node.id === owner.id || node.owner === owner.owner);
  const ids = new Set(nodes.map((node) => node.id));
  const edges = graph.edges.filter((edge) => ids.has(edge.from) && ids.has(edge.to));
  return [
    ...new Set([
      ...nodes.map((node) => node.id),
      ...edges.map((edge) => edge.id),
      ...nodes.map((node) => node.source),
      ...edges.map((edge) => edge.source),
    ]),
  ];
}

function replay(input: ReplayInput) {
  const ids = selection(input.document, input.probe);
  const initial = bindingReviewPages(input.document, ids, LIMITS);
  const migration = input.migrateEdgeIds
    ? semanticEdgeIdMigration(
        input.prior.pages.flatMap((page) => page.records),
        initial.flatMap((page) => page.records),
      )
    : null;
  if (migration !== null && !migration.verified) {
    throw new Error(`${input.probe.id}: ${migration.reason ?? 'Unverified edge-ID migration.'}`);
  }
  const mappedIds = new Map(migration?.mapping.map((entry) => [entry.old_id, entry.new_id]));
  const pages =
    migration === null
      ? initial
      : bindingReviewPages(
          input.document,
          input.prior.pages.flatMap((page) =>
            page.records.map((record) => mappedIds.get(record.id) ?? record.id),
          ),
          LIMITS,
        );
  const bounded = bindingReviewDocument(input.document.id, pages);
  const result = answerabilityProbe(semanticGraph(bounded), input.probe);
  const records = pages.reduce((count, page) => count + page.records.length, 0);
  const identical = exactReplayIdentity(
    input.prior.pages.flatMap((page) => page.records),
    pages.flatMap((page) => page.records),
  );
  const receipt = {
    probe: input.probe.id,
    scope: input.scope,
    records,
    pages: pages.length,
    allChecksSupported: result.status === 'supported-local-clauses',
    boundedOnly: true,
    allRecordIdsAndValuesIdenticalToAcceptedCapture: identical,
    identityExact: identical,
    semanticEquivalence: identical || migration?.verified === true,
    migrationVerified: migration?.verified === true,
    migration,
    sourceCapture: input.sourceCapture,
    complete: records === ids.length,
    bytes: Buffer.byteLength(JSON.stringify(pages)),
    limits: LIMITS,
  };
  return { receipt, result, pages, bounded };
}

function defaultProof(document: ScanDocument) {
  const graph = semanticGraph(document);
  const owners = graph.nodes.filter(
    (node) => node.nodeKind === 'function' && node.name === 'archiveCustomer',
  );
  const owner = owners.length === 1 ? owners[0]?.owner : undefined;
  if (owner === undefined) {
    throw new Error('Q08: missing or ambiguous bounded archiveCustomer owner.');
  }
  const mutations = MUTATIONS.map((relation) => ({
    relation,
    rejected: !springArchiveReasonProof(
      semanticGraph({
        ...document,
        semantic: (document.semantic ?? []).filter(
          (record) => record.kind !== 'semantic_edge' || record.relation !== relation,
        ),
      }),
      owner,
    ),
  }));
  return {
    supported: springArchiveReasonProof(graph, owner),
    owner,
    records: (document.semantic?.length ?? 0) + document.sources.length,
    mutations,
    boundedOnly: true,
  };
}

async function replayScope(input: {
  readonly scope: string;
  readonly document: ScanDocument;
  readonly baseline: string;
  readonly specifications: string;
  readonly output: string;
  readonly sourceCapture: string;
  readonly migrateEdgeIds: boolean;
}) {
  const probes = answerabilityRequest(
    await json(path.join(input.specifications, `${input.scope}-probes.json`)),
  );
  const selected = FROZEN.filter(([scope]) => scope === input.scope).map(([, id]) => id);
  if (
    !isDeepStrictEqual(
      probes.map((probe) => probe.id).toSorted((a, b) => a.localeCompare(b)),
      selected.toSorted((a, b) => a.localeCompare(b)),
    )
  ) {
    throw new Error(`${input.scope}: frozen probe denominator changed.`);
  }
  const receipts: ReturnType<typeof replay>['receipt'][] = [];
  await mkdir(path.join(input.output, input.scope));
  for (const probe of probes) {
    const previous = await json(path.join(input.baseline, input.scope, `${probe.id}.json`));
    if (!isDeepStrictEqual(priorChecks(previous), probe.checks)) {
      throw new Error(`${probe.id}: frozen native assertions changed.`);
    }
    const prior = priorPages(previous);
    const result = replay({ ...input, probe, prior });
    await writeJson(path.join(input.output, input.scope, `${probe.id}.json`), {
      receipt: result.receipt,
      result: result.result,
      pages: result.pages,
    });
    receipts.push(result.receipt);
    if (probe.id === 'Q08-force-archive') {
      await writeJson(
        path.join(input.output, 'Q08-default-review.json'),
        defaultProof(result.bounded),
      );
    }
  }
  return receipts;
}

async function trialDocument(
  sourceCapture: string,
  manifest: ReturnType<typeof replayManifest>,
  scope: string,
): Promise<ScanDocument> {
  const trials = manifest.trials.filter(
    (trial) => trial.trial === 'first' && trial.scope === scope,
  );
  const trial = trials.length === 1 ? trials[0] : undefined;
  if (!trial) throw new Error(`Missing or duplicate first trial for ${scope}.`);
  const root = path.resolve(path.dirname(sourceCapture));
  const file = path.resolve(root, trial.document);
  if (!file.startsWith(`${root}${path.sep}`)) throw new Error('Trial path escapes capture.');
  const parse = await scanValidator();
  const document = parse(await json(file));
  if (
    !document.sources.every(
      (source) => source.repo === manifest.repo && source.commit === manifest.commit,
    )
  ) {
    throw new Error('Native source is outside frozen pin.');
  }
  return document;
}

async function run(args: readonly string[]): Promise<void> {
  const {
    sourceCapture,
    baseline,
    specifications,
    output,
    semanticEdgeIdMigration: migrateEdgeIds,
  } = replayArguments(args);
  const manifest = replayManifest(await json(sourceCapture), PIN);
  verifyAcceptedRoster(
    await json(path.join(baseline, 'accepted-native-replay.json')),
    FROZEN.map(([scope, probe]) => ({ scope, probe })),
  );
  await mkdir(output);
  const receipts: ReturnType<typeof replay>['receipt'][] = [];
  for (const scope of new Set(FROZEN.map(([entryScope]) => entryScope))) {
    const document = await trialDocument(sourceCapture, manifest, scope);
    receipts.push(
      ...(await replayScope({
        scope,
        document,
        baseline,
        specifications,
        output,
        sourceCapture,
        migrateEdgeIds,
      })),
    );
  }
  const q08Result = defaultResult(await json(path.join(output, 'Q08-default-review.json')));
  const allSupported = receipts.every((receipt) => {
    const identity = receipt.identityExact || (migrateEdgeIds && receipt.migrationVerified);
    return [
      receipt.complete,
      receipt.allChecksSupported,
      identity,
      receipt.semanticEquivalence,
    ].every(Boolean);
  });
  const receipt = {
    format: 'independent-native-replay/v1',
    sourceCapture,
    baseline,
    specifications,
    migrationMode: migrateEdgeIds ? 'explicit_semantic_edge_id_migration' : 'strict_identity',
    identityExact: receipts.every((entry) => entry.identityExact),
    semanticEquivalence: receipts.every((entry) => entry.semanticEquivalence),
    migrationVerified: migrateEdgeIds && receipts.every((entry) => entry.migrationVerified),
    probes: receipts,
    allSupported,
    q08DefaultSupported: q08Result.supported,
    q08DefaultMutations: q08Result.mutations.filter((mutation) => mutation.rejected).length,
  };
  await writeJson(path.join(output, 'accepted-native-replay.json'), receipt);
  console.log(JSON.stringify(receipt));
  if (!allSupported || !q08Result.supported || receipt.q08DefaultMutations !== MUTATIONS.length) {
    process.exitCode = 1;
  }
}

if (process.argv[1] === import.meta.filename) {
  await run(process.argv.slice(2)).catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
