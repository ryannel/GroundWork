import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { buildScanExplorer } from '@/application/scan-explorer/build-index';
import { currentCallers } from '@/application/scan-explorer/current-callers';
import {
  currentDataInspection,
  currentEntryFlow,
  currentServiceOverview,
} from '@/application/scan-explorer/current-scan';
import {
  currentProvidersFromCanonical,
  currentTargetsFromCanonical,
} from '@/application/scan-explorer/current-targets';
import { callers, entryFlow } from '@/application/scan-explorer/queries';
import type { ScanDocument } from '@/domain/scan/scan.generated';
import type { CurrentScanInput, CurrentView } from '@/domain/scan-explorer/current-contracts';
import { scanValidator } from '@/infrastructure/scan/scan-format';
import { sourceDigest } from '@/infrastructure/scan/source-index';
import {
  parseEntryArtifact,
  type EntryArtifact,
} from '@/infrastructure/scan/spring-entry-artifact-format';
import { currentQueryPublication } from '@/infrastructure/scan-explorer/current-publication';
import { retainedExplorerReader } from '@/infrastructure/scan-explorer/retained-capture';
import { declaredSpringRuntime } from '@/infrastructure/scan-explorer/runtime-declaration';
import { uniqueVisualRecords } from '@/infrastructure/scan-explorer/visual-selection';

import { readinessObject, readinessString } from './scan-readiness-value';

const ROOT = 'reports/customer-service-scan-readiness-001';
const RETAINED = 'docs/scan-trials/volvo-native-rescan/captures';

async function json(filename: string): Promise<unknown> {
  return JSON.parse(await readFile(filename, 'utf8'));
}

async function save(folder: string, name: string, value: unknown): Promise<void> {
  await writeFile(path.join(folder, name), `${JSON.stringify(value, null, 2)}\n`);
}

function nativeRecords(documents: readonly ScanDocument[]): CurrentScanInput['records'] {
  return uniqueVisualRecords(
    documents.flatMap((document) => [
      ...document.sources,
      ...document.contracts,
      ...document.gaps,
      ...document.summaries,
      ...(document.semantic ?? []),
      ...(document.framework ?? []),
      ...(document.bindings ?? []),
    ]),
  );
}

async function currentInput(root: string, repository: string): Promise<CurrentScanInput> {
  const directory = path.join(root, 'source-final');
  const report = readinessObject(await json(path.join(directory, 'repository.json')));
  const parse = await scanValidator();
  const metadata = parse(await json(path.join(root, 'catalogue-final/metadata.json')));
  const documents = [
    metadata,
    ...(await Promise.all(
      ['http-query-final', 'schedule-query-final'].map(async (name) =>
        currentQueryPublication(path.join(root, name)),
      ),
    )),
  ];
  const binding = declaredSpringRuntime({
    repository,
    repo: readinessString(report.repo),
    commit: readinessString(report.commit),
    applicationPath:
      'customer-service-api/src/main/java/com/volvocars/ecom/customerservice/api/App.java',
    logicalId: 'svc:cds-ecom-customer-service',
    label: 'Customer Service',
  });
  return {
    snapshot: sourceDigest(JSON.stringify({ documents, binding })),
    records: nativeRecords(documents),
    sources: [
      ...new Map(
        documents.flatMap((document) => document.sources).map((source) => [source.id, source]),
      ).values(),
    ],
    binding,
    coverage: [
      'Published current HTTP and schedule query closures only; source revision pinned by the source report',
      'Repository inventory does not establish complete behaviour or callers',
      'No extra repository scans or network observation',
    ],
  };
}

async function retainedIndex(): Promise<ReturnType<typeof buildScanExplorer>> {
  const names = [
    'cce-admin-ui-complete-r4',
    'cds-ecom-customer-service-complete-r1',
    'cds-ecom-customer-crm-synchronizer-complete-r1',
  ];
  const readers = await Promise.all(
    names.map(async (name) => ({
      name,
      reader: await retainedExplorerReader({
        bundlePath: path.join(RETAINED, name, 'bundle.json.gz'),
        snapshotPath: path.join(RETAINED, name, 'snapshot.json'),
      }),
    })),
  );
  return buildScanExplorer(
    readers.map(({ name, reader }) => ({
      reader,
      scope: name,
      completeness: 'partial',
      limitations: [
        'Retained source capture; deployed topology and complete workspace caller discovery remain unverified',
      ],
    })),
  );
}

/** Replay existing published evidence only; this command never invokes a scanner or fetch. */
async function main(): Promise<void> {
  const root = process.argv[2] ?? ROOT;
  const output = process.argv[3] ?? 'reports/service-explorer-readiness-001/projection';
  const repository =
    process.argv[4] ?? '/Users/RNEL/.cache/groundwork/clones/volvo-cars/cds-ecom-customer-service';
  const [input, index, catalogueBytes] = await Promise.all([
    currentInput(root, repository),
    retainedIndex(),
    json(path.join(root, 'catalogue-final/catalogue.json')),
  ]);
  const { http, schedule } = queryPlans(catalogueBytes);
  const overview = currentServiceOverview(input, { limit: 200, maxBytes: 524_288 });
  const flow = currentEntryFlow(input, {
    rootSourceIds: http.plan.root_source_ids,
    limit: 500,
    maxBytes: 524_288,
  });
  const data = currentDataInspection(input, {
    sourceIds: http.plan.field_source_ids,
    limit: 200,
    maxBytes: 524_288,
  });
  const reverse = callers(index, { component: 'svc:cds-ecom-customer-service', limit: 200 });
  const positive = callers(index, { component: 'app:cce-admin-next-server', limit: 200 });
  await mkdir(output, { recursive: true });
  await Promise.all([
    save(output, 'current.input-manifest.json', {
      snapshot: input.snapshot,
      binding: input.binding,
      sourceReport: path.join(root, 'source-final/repository.json'),
      projection: 'Node-side disposable read model; browser consumes bounded views only',
    }),
    save(output, 'current.overview.json', overview),
    save(output, 'current.http-flow.json', flow),
    save(output, 'current.data.json', data),
    save(output, 'current.callers.json', proofCurrentCallers(input, index)),
    save(output, 'retained.customer-callers.json', reverse),
    save(output, 'retained.admin-callers.json', positive),
    save(output, 'retained.entry-flow.json', nativeFlow(index)),
    save(
      output,
      'current.schedule-flow.json',
      schedule === undefined
        ? { status: 'unresolved', reason: 'No selected schedule plan' }
        : currentEntryFlow(input, {
            rootSourceIds: schedule.plan.root_source_ids,
            limit: 500,
            maxBytes: 524_288,
          }),
    ),
    save(
      output,
      'receipt.json',
      proofReceipt({ input, overview, flow, data }, { reverse, positive }),
    ),
  ]);
  process.stdout.write(`Explorer projection proof: ${output}\n`);
}

function proofReceipt(
  current: {
    readonly input: CurrentScanInput;
    readonly overview: CurrentView;
    readonly flow: CurrentView;
    readonly data: CurrentView;
  },
  retained: {
    readonly reverse: ReturnType<typeof callers>;
    readonly positive: ReturnType<typeof callers>;
  },
): unknown {
  const { input, overview, flow, data } = current;
  const { reverse, positive } = retained;
  return {
    format: 'scan-explorer-proof/v1',
    currentSnapshot: input.snapshot,
    repo: input.binding.repo,
    commit: input.binding.commit,
    runtimeDeclarations: input.binding.declarations,
    modulePaths: input.binding.modulePaths,
    sourceDocuments:
      'Validated public bounded HTTP and schedule query closures; original source publications remain authoritative',
    current: {
      overview: overview.items.length,
      httpFlow: flow.items.length,
      data: data.items.length,
    },
    reverse: {
      customer: reverse.total,
      customerConfirmed: reverse.items.filter((item) => item.status === 'confirmed').length,
      adminConfirmed: positive.items.filter((item) => item.status === 'confirmed').length,
    },
    customerCallerGap:
      'CRM config binds customer-service to http://cds-ecom-customer-api-service:8080/. Provider DNS-to-runtime declaration is absent from retained main capture; exact method/path remain candidates.',
    currentSourceIntegration:
      'Current source facts query directly; retained canonical runtime identity can join only through exact pinned source anchors',
    newRepositoryScans: 0,
    networkObservations: 0,
    deployment: 'not_verified',
    exhaustive: false,
  };
}

function nativeFlow(index: ReturnType<typeof buildScanExplorer>): ReturnType<typeof entryFlow> {
  const entry = index.entries[0];
  if (entry === undefined) throw new Error('Retained native flow entry missing');
  return entryFlow(index, {
    format: 'groundwork-query/v3',
    snapshot: entry.snapshot,
    entry: entry.record.entry,
    query: 'trace',
    value: null,
    context: [],
    outcome: null,
    changed: [],
    representation: 'source',
    candidates: 'exclude',
    maxNodes: 32,
    maxRecords: 64,
  });
}

function proofCurrentCallers(
  input: CurrentScanInput,
  index: ReturnType<typeof buildScanExplorer>,
): ReturnType<typeof currentCallers> {
  return currentCallers(
    [
      {
        ...input,
        targets: currentTargetsFromCanonical(input, index),
        providers: currentProvidersFromCanonical(input, index),
      },
    ],
    { component: input.binding.component.logicalId, limit: 100 },
    index,
  );
}

function queryPlans(catalogueBytes: unknown): {
  readonly http: EntryArtifact['plans'][number];
  readonly schedule: EntryArtifact['plans'][number] | undefined;
} {
  const catalogue = parseEntryArtifact(catalogueBytes);
  const http = catalogue.plans.find((item) => item.plan.entry_id.includes('audit-logs/{version}'));
  const schedule = catalogue.plans.find((item) => item.plan.entry_id.includes('schedule'));
  if (http === undefined) throw new Error('Current HTTP proof plan missing');
  return { http, schedule };
}

await main();
