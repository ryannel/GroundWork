import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { scanRecords, type ScanRecord } from '@/domain/scan/scan-records';
import type { ScanDocument } from '@/domain/scan/scan.generated';
import { scanValidator } from '@/infrastructure/scan/scan-format';
import { readScanScope } from '@/infrastructure/scan/scan-scope';
import { scopedProvenance } from '@/infrastructure/scan/scoped-source-provenance';
import { sourceDigest } from '@/infrastructure/scan/source-index';

import { bindingReviewPages } from './scan-bindings-pages';
import { readinessObject } from './scan-readiness-value';
import { auditScanSources } from './scan-source-audit';

interface Probe {
  readonly id: string;
  readonly check: (records: readonly ScanRecord[]) => boolean;
}
const pythonProbes: readonly Probe[] = [
  {
    id: 'fastapi-health-implementation',
    check: (records) =>
      records.some(
        (record) =>
          record.kind === 'source_framework_binding' &&
          record.framework === 'fastapi' &&
          record.name === 'GET /healthcheck' &&
          record.target_source !== null,
      ),
  },
  {
    id: 'fastapi-explicit-mount-frontier',
    check: (records) =>
      records.some(
        (record) =>
          record.kind === 'source_framework_binding' &&
          record.name === 'add_route' &&
          record.status === 'partial',
      ),
  },
  {
    id: 'graphene-molytope-resolver',
    check: (records) =>
      records.some(
        (record) =>
          record.kind === 'source_framework_binding' &&
          record.framework === 'graphene' &&
          record.name === 'molytope_query' &&
          record.target_source !== null,
      ),
  },
  {
    id: 'graphene-configuration-source-dto',
    check: (records) =>
      records.some(
        (record) =>
          record.kind === 'contract' &&
          record.shape.kind === 'object' &&
          record.shape.spelling === 'MolytopeConfiguration' &&
          record.shape.fields.some(
            (field) => field.name === 'configuration' && field.shape.kind === 'array',
          ),
      ),
  },
];
const rustProbes: readonly Probe[] = [
  {
    id: 'apollo-plugin-source-entry',
    check: (records) =>
      records.some(
        (record) =>
          record.kind === 'source_framework_binding' &&
          record.framework === 'apollo-router' &&
          record.name === 'supergraph_service' &&
          record.status === 'partial',
      ),
  },
  {
    id: 'serde-optional-source-field',
    check: (records) =>
      records.some(
        (record) =>
          record.kind === 'contract' &&
          record.shape.kind === 'object' &&
          record.shape.spelling === 'Conf' &&
          record.shape.fields.some(
            (field) =>
              field.name === 'client_registry_name_header_key' &&
              field.presence === 'optional' &&
              field.nullable,
          ),
      ),
  },
];
function queryRecords(document: ScanDocument): readonly ScanRecord[] {
  const selected = scanRecords(document).filter(
    (record) => record.kind === 'source_framework_binding' || record.kind === 'contract',
  );
  const sourceIds = new Set(
    selected.flatMap((record) => {
      if (record.kind === 'contract') return record.support;
      return [
        record.source,
        ...record.support,
        ...(record.target_source === null ? [] : [record.target_source]),
      ];
    }),
  );
  return [...selected, ...document.sources.filter((source) => sourceIds.has(source.id))];
}
async function verifyBaseline(file: string): Promise<Readonly<Record<string, unknown>>> {
  const directory = path.dirname(file);
  const scope = await readScanScope(path.join(directory, 'scope.json'));
  const baseline = readinessObject(
    JSON.parse(await readFile(path.join(directory, 'baseline.json'), 'utf8')),
  );
  const current = scopedProvenance(scope, { authority: scope.workspace });
  if (Object.entries(current).some(([key, value]) => baseline[key] !== value)) {
    throw new Error('Polyglot source proof has stale parser or analysis fingerprints');
  }
  if (baseline.repo !== scope.repo || baseline.commit !== scope.commit) {
    throw new Error('Polyglot baseline pin mismatch');
  }
  return baseline;
}
async function proof(input: {
  readonly file: string;
  readonly probes: readonly Probe[];
  readonly cloneRoot: string;
  readonly output: string;
}) {
  const validate = await scanValidator();
  const baseline = await verifyBaseline(input.file);
  const bytes = await readFile(input.file, 'utf8');
  const document = validate(JSON.parse(bytes));
  const selected = queryRecords(document);
  const pages = bindingReviewPages(
    document,
    selected.map((record) => record.id),
  );
  const records = pages.flatMap((page) => page.records);
  const checks = input.probes.map((probe) => ({
    id: probe.id,
    passed: probe.check(records),
    rejectsMissingEvidence: !probe.check([]),
  }));
  if (checks.some((check) => !check.passed || !check.rejectsMissingEvidence)) {
    throw new Error('Frozen polyglot source probe failed');
  }
  await writeFile(path.join(input.output, 'pages.json'), `${JSON.stringify(pages, null, 2)}\n`, {
    flag: 'wx',
  });
  const sourcePins = auditScanSources(document, input.cloneRoot);
  return {
    baseline,
    document: document.id,
    sha256: sourceDigest(bytes),
    checks,
    sourcePins,
    selectedRecords: selected.length,
    pages: pages.length,
    frameworkBindings: document.framework?.length ?? 0,
    contracts: document.contracts.length,
    semanticRecords: document.semantic?.length ?? 0,
    qualification:
      'Selected pinned-source declarations and bounded API delivery only. Framework runtime/wire behaviour, unselected files and broad question completeness remain unresolved.',
  };
}
/** Independent fixed source expectations, not an accepted count inferred from successful parsing. */
export async function scanPolyglotProof(args: readonly string[]): Promise<void> {
  const [pythonDocument, rustDocument, cloneRoot, output] = args;
  if (
    pythonDocument === undefined ||
    rustDocument === undefined ||
    cloneRoot === undefined ||
    output === undefined
  ) {
    throw new Error(
      'Usage: scan-polyglot-proof <python-document> <rust-document> <clone-root> <NEW-output>',
    );
  }
  await mkdir(output);
  const pythonOutput = path.join(output, 'python');
  const rustOutput = path.join(output, 'rust');
  await mkdir(pythonOutput);
  await mkdir(rustOutput);
  const python = await proof({
    file: pythonDocument,
    probes: pythonProbes,
    cloneRoot,
    output: pythonOutput,
  });
  const rust = await proof({
    file: rustDocument,
    probes: rustProbes,
    cloneRoot,
    output: rustOutput,
  });
  await writeFile(
    path.join(output, 'receipt.json'),
    `${JSON.stringify({ format: 'polyglot-source-proof/v1', status: 'bounded_source_probes_passed', python, rust }, null, 2)}\n`,
    { flag: 'wx' },
  );
}
if (process.argv[1] === import.meta.filename) await scanPolyglotProof(process.argv.slice(2));
