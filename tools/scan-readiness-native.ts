import path from 'node:path';
import { isDeepStrictEqual } from 'node:util';

import { scanRecords } from '@/domain/scan/scan-records';
import type { ScanDocument } from '@/domain/scan/scan.generated';
import {
  passArtifactDigest,
  repositoryPassJson,
} from '@/infrastructure/scan/repository-pass-files';
import { scanValidator } from '@/infrastructure/scan/scan-format';

import { answerabilityProbe, type Probe } from './scan-answerability-probe';
import { answerabilityRequest } from './scan-answerability-request';
import { bindingReviewDocument, bindingReviewPages } from './scan-bindings-pages';
import { readinessArray, readinessObject, readinessString } from './scan-readiness-value';
import { semanticGraph } from './scan-semantic-query';
import { springArchiveReasonProof } from './scan-spring-review-native';

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
const SPEC_HASHES: Readonly<Record<string, string>> = {
  'repository-0001': 'db4088b196a35638219ecea300b4b14472eb7695f6b70ced321f9bb8ee5d710d',
  'repository-0003': '02678b0fe028b153ca423627ae6f00d6d5cedee8887c205b72b0896970285541',
  [CORE_SCOPE]: '4db173f7a68da0d765c9a25415a1d062116c9a0b6ea6cfc073d0a2aab96bced3',
  'repository-0005': 'aa0dc4f8c6eba5a0ed65d11900e48f2ecee5ef075ffdac22fb77b2122184c8f3',
};
function ownerIds(document: ScanDocument, probe: Probe): readonly string[] {
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
  if (owners.length !== 1 || !owners[0]) {
    throw new Error('Frozen native owner is missing or ambiguous.');
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
function verifyPages(value: unknown, document: ScanDocument, expected: readonly string[]): void {
  const pages = readinessArray(value).map(readinessObject);
  const actual: string[] = [];
  const known = new Map(scanRecords(document).map((record) => [record.id, record]));
  const snapshot = bindingReviewPages(document, expected, {
    maxTotalRecords: 2048,
    maxTotalBytes: 16_777_216,
  })[0]?.snapshot;
  for (const page of pages) {
    const records = readinessArray(page.records).map(readinessObject);
    if (
      records.length > 4 ||
      Buffer.byteLength(JSON.stringify(page)) > 65_536 ||
      page.snapshot !== snapshot
    ) {
      throw new Error('Native evidence page is oversized or belongs to another snapshot.');
    }
    for (const record of records) {
      const id = readinessString(record.id);
      actual.push(id);
      if (!isDeepStrictEqual(record, known.get(id))) {
        throw new Error('Native page record differs from current source evidence.');
      }
    }
  }
  if (
    actual.length !== expected.length ||
    new Set(actual).size !== actual.length ||
    expected.some((id) => !actual.includes(id))
  ) {
    throw new Error('Native evidence omitted or duplicated owner records.');
  }
}
async function specification(scope: string, id: string): Promise<Probe> {
  const directory = 'reports/customer-service-pipeline-001/answerability';
  const file = `${scope}-probes.json`;
  if ((await passArtifactDigest(directory, file)) !== SPEC_HASHES[scope]) {
    throw new Error('Frozen native specification changed.');
  }
  const probes = answerabilityRequest(await repositoryPassJson(path.join(directory, file)));
  const probe = probes.find((candidate) => candidate.id === id);
  if (!probe || probe.checks.length === 0) throw new Error('Frozen native probe is missing.');
  return probe;
}
async function sourceDocument(source: string, scope: string): Promise<ScanDocument> {
  const report = readinessObject(await repositoryPassJson(source));
  const trials = readinessArray(report.trials)
    .map(readinessObject)
    .filter((trial) => trial.scope === scope && trial.trial === 'first');
  if (trials.length !== 1 || !trials[0]) {
    throw new Error('Current source shard is missing or duplicated.');
  }
  const relative = readinessString(trials[0].document);
  await passArtifactDigest(path.dirname(source), relative);
  const parse = await scanValidator();
  return parse(await repositoryPassJson(path.resolve(path.dirname(source), relative)));
}
function q08Default(document: ScanDocument): void {
  const owner = semanticGraph(document).nodes.find(
    (node) => node.nodeKind === 'function' && node.name === 'archiveCustomer',
  )?.owner;
  if (owner === undefined || !springArchiveReasonProof(semanticGraph(document), owner)) {
    throw new Error('Q08 native default is unsupported.');
  }
  for (const relation of [
    'reaching_value',
    'assigned_value',
    'condition',
    'left',
    'right',
    'consequent',
    'otherwise',
    'receiver',
  ] as const) {
    const changed = {
      ...document,
      semantic: (document.semantic ?? []).filter(
        (record) => record.kind !== 'semantic_edge' || record.relation !== relation,
      ),
    };
    if (springArchiveReasonProof(semanticGraph(changed), owner)) {
      throw new Error('A frozen Q08 native mutation was not rejected.');
    }
  }
}
function nativeRows(
  native: Readonly<Record<string, unknown>>,
  source: string,
): readonly Readonly<Record<string, unknown>>[] {
  const probes = readinessArray(native.probes).map(readinessObject);
  if (
    ![
      native.allSupported === true,
      native.q08DefaultSupported === true,
      native.q08DefaultMutations === 8,
      path.resolve(readinessString(native.sourceCapture)) === path.resolve(source),
      probes.length === 7,
      new Set(probes.map((probe) => probe.probe)).size === 7,
    ].every(Boolean)
  ) {
    throw new Error('Native replay summary is incomplete or has another source pin.');
  }
  return probes;
}
export async function verifyReadinessNative(
  native: Readonly<Record<string, unknown>>,
  filename: string,
  source: string,
): Promise<void> {
  const probes = nativeRows(native, source);
  const documents = new Map<string, ScanDocument>();
  for (const [scope, id] of FROZEN) {
    if (
      !probes.some((probe) =>
        [
          probe.probe === id,
          probe.scope === scope,
          probe.complete === true,
          probe.allChecksSupported === true,
          probe.semanticEquivalence === true,
        ].every(Boolean),
      )
    ) {
      throw new Error('Frozen native probe is missing or unsupported.');
    }
    const document = documents.get(scope) ?? (await sourceDocument(source, scope));
    documents.set(scope, document);
    const probe = await specification(scope, id);
    const result = readinessObject(
      await repositoryPassJson(path.join(path.dirname(filename), scope, `${id}.json`)),
    );
    const ids = ownerIds(document, probe);
    verifyPages(result.pages, document, ids);
    const bounded = bindingReviewDocument(
      document.id,
      bindingReviewPages(document, ids, { maxTotalRecords: 2048, maxTotalBytes: 16_777_216 }),
    );
    if (answerabilityProbe(semanticGraph(bounded), probe).status !== 'supported-local-clauses') {
      throw new Error('Current native source no longer proves a frozen probe.');
    }
    if (id === 'Q08-force-archive') q08Default(bounded);
  }
}
