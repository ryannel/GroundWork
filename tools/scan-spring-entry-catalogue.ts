import { mkdir, readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

import { parseScanScope, type ScanScope } from '@/infrastructure/scan/scan-scope';
import { sourceDigest } from '@/infrastructure/scan/source-index';
import { entryCapturePin } from '@/infrastructure/scan/spring-entry-artifact-format';
import { createSpringEntryPlanner } from '@/infrastructure/scan/spring-entry-planner';
import { springFrameworkDocument } from '@/infrastructure/scan/spring-framework-document';

import {
  entryAnalysisFingerprint,
  entryArgument,
  entryPlanningChecksum,
  jsonFile,
  writeEntryJson,
} from './scan-entry-artifacts';
import { entryCliDigest } from './scan-entry-fingerprint';
import { springBindingInputs } from './scan-spring-inputs';

export interface CatalogueOptions {
  readonly capture: string;
  readonly cloneRoot: string;
  readonly cache: string;
  readonly output: string;
  readonly maxSourceBytes?: number;
}

/** Persist metadata and query roots, with no all-method native graph projection. */
export async function buildSpringEntryCatalogue(options: CatalogueOptions): Promise<void> {
  const started = performance.now();
  const capture = path.resolve(options.capture);
  const directory = path.dirname(capture);
  const { pin, scopes } = await prepareCatalogueCapture(capture, options.maxSourceBytes);
  const analysisFingerprint = await catalogueAnalysis(scopes, pin.maxSourceBytes);
  const inputs = await springBindingInputs({
    ...options,
    capture: directory,
    maxSourceBytes: pin.maxSourceBytes,
  });
  const metadata = await springFrameworkDocument(inputs);
  const planner = plannerFor(inputs, metadata);
  const scopeForPath = new Map(
    scopes.flatMap(({ scope }) => scope.files.map((file) => [file.path, scope.id] as const)),
  );
  const planning = {
    catalogue: planner.catalogue,
    plans: planner.catalogue.entries.map((entry) => ({
      binding_id: entry.binding_id,
      plan: planner.plan(entry.id),
    })),
    source_locations: planner.source_locations.map((location) => ({
      ...location,
      scope_id: scopeForPath.get(location.path) ?? '',
    })),
  };
  const artifact = {
    format: 'spring-entry-catalogue/v1',
    capture,
    captureDigest: sourceDigest(await readFile(capture, 'utf8')),
    metadataChecksum: sourceDigest(JSON.stringify(metadata)),
    analysisFingerprint,
    planChecksum: entryPlanningChecksum(planning),
    scopes,
    sourcePolicy: { maxSourceBytes: pin.maxSourceBytes },
    ...planning,
  };
  if ((await catalogueAnalysis(scopes, pin.maxSourceBytes)) !== analysisFingerprint) {
    throw new Error('Analysis changed during catalogue construction; start a new catalogue.');
  }
  await mkdir(options.output);
  await writeEntryJson(path.join(options.output, 'metadata.json'), metadata);
  await writeEntryJson(path.join(options.output, 'catalogue.json'), artifact);
  await writeEntryJson(path.join(options.output, 'receipt.json'), {
    format: 'spring-entry-catalogue-receipt/v1',
    sourceCapture: capture,
    sourceSelection: 'production Java declarations only',
    entryCount: planner.catalogue.entries.length,
    boundaries: planner.catalogue.boundaries.length,
    metadataNativeRecords: (metadata.semantic ?? []).length,
    sourcePolicy: artifact.sourcePolicy,
    statistics: inputs.statistics,
    resourceStatistics: inputs.resourceStatistics,
    completeness: 'partial',
    elapsedMs: performance.now() - started,
  });
}

async function catalogueAnalysis(
  scopes: readonly { readonly scope: ScanScope }[],
  maxSourceBytes: number,
): Promise<string> {
  return entryAnalysisFingerprint(
    scopes.map((entry) => entry.scope),
    await entryCliDigest(),
    maxSourceBytes,
  );
}

async function prepareCatalogueCapture(capture: string, maxSourceBytes?: number) {
  const pin = entryCapturePin(await jsonFile(capture));
  if (maxSourceBytes !== undefined && maxSourceBytes !== pin.maxSourceBytes) {
    throw new Error('Catalogue source policy conflicts with its capture.');
  }
  const scopes = await catalogueScopes(path.dirname(capture));
  if (scopes.some(({ scope }) => scope.repo !== pin.repo || scope.commit !== pin.commit)) {
    throw new Error('Entry scopes must match the source capture pin.');
  }
  return { pin, scopes };
}

function plannerFor(
  inputs: Awaited<ReturnType<typeof springBindingInputs>>,
  metadata: Awaited<ReturnType<typeof springFrameworkDocument>>,
) {
  const bindings = metadata.bindings ?? [];
  return createSpringEntryPlanner({
    units: inputs.units,
    indexes: inputs.indexes,
    routes: (metadata.framework ?? []).filter((record) => record.kind === 'route_binding'),
    bindings,
    calls: bindings.filter((record) => record.kind === 'java_call_binding'),
    values: bindings.filter((record) => record.kind === 'java_value_binding'),
  });
}

async function catalogueScopes(directory: string): Promise<
  readonly {
    readonly file: string;
    readonly scope: ScanScope;
    readonly digest: string;
  }[]
> {
  const entries = await readdir(directory);
  const names = entries
    .filter((name) => /^repository-\d+$/u.test(name))
    .toSorted((left, right) => left.localeCompare(right));
  return Promise.all(
    names.map(async (name) => {
      const file = path.join(directory, name, 'scope.json');
      const scope = parseScanScope(await jsonFile(file));
      return { file, scope, digest: sourceDigest(JSON.stringify(scope)) };
    }),
  );
}

function argumentsOf(args: readonly string[]): CatalogueOptions {
  if (args.length !== 4) {
    throw new Error(
      'Usage: scan-spring-entry-catalogue <repository.json> <clone-root> <cache> <NEW-output>',
    );
  }
  return {
    capture: entryArgument(args, 0),
    cloneRoot: entryArgument(args, 1),
    cache: entryArgument(args, 2),
    output: entryArgument(args, 3),
  };
}

if (process.argv[1] === import.meta.filename) {
  await buildSpringEntryCatalogue(argumentsOf(process.argv.slice(2)));
}
