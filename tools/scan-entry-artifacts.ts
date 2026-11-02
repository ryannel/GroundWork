import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { repositoryPassJson } from '@/infrastructure/scan/repository-pass-files';
import { parseScanScope, type ScanScope } from '@/infrastructure/scan/scan-scope';
import { scopedProvenance } from '@/infrastructure/scan/scoped-source-provenance';
import { sourceDigest } from '@/infrastructure/scan/source-index';
import {
  parseEntryArtifact,
  entryCapturePin,
  type EntryArtifact,
} from '@/infrastructure/scan/spring-entry-artifact-format';

export async function jsonFile(file: string): Promise<unknown> {
  return repositoryPassJson(file);
}
export async function writeEntryJson(file: string, value: unknown): Promise<void> {
  await writeFile(file, `${JSON.stringify(value, null, 2)}\n`, { flag: 'wx' });
}

function canonicalValue(input: unknown): unknown {
  if (Array.isArray(input)) return input.map((value: unknown) => canonicalValue(value));
  if (typeof input !== 'object' || input === null) return input;
  return Object.fromEntries(
    Object.entries(input)
      .toSorted(([left], [right]) => left.localeCompare(right))
      .map(([key, value]: readonly [string, unknown]) => [key, canonicalValue(value)]),
  );
}
export function entryPlanningChecksum(input: {
  readonly catalogue: unknown;
  readonly plans: unknown;
  readonly source_locations: unknown;
}): string {
  return sourceDigest(
    JSON.stringify(canonicalValue([input.catalogue, input.plans, input.source_locations])),
  );
}

/** Includes CLI/projection code as well as parser, schema and extraction provenance. */
export function entryAnalysisFingerprint(
  scopes: readonly ScanScope[],
  cliDigest: string,
  maxSourceBytes?: number,
): string {
  return sourceDigest(
    JSON.stringify([
      cliDigest,
      scopes.map((scope) => ({
        scope: scope.id,
        provenance: scopedProvenance(scope, {
          authority: scope.workspace,
          ...(maxSourceBytes === undefined ? {} : { maxSourceBytes }),
        }),
      })),
    ]),
  );
}

export async function readEntryArtifact(directory: string): Promise<EntryArtifact> {
  const artifact = parseEntryArtifact(await jsonFile(path.join(directory, 'catalogue.json')));
  if (artifact.planChecksum !== entryPlanningChecksum(artifact)) {
    throw new Error('Entry catalogue planning checksum changed.');
  }
  return artifact;
}

/** Guard before application blobs are read: original scopes, source capture and current analysis must agree. */
export async function verifyEntryArtifact(
  artifact: EntryArtifact,
  cliDigest: string,
): Promise<readonly ScanScope[]> {
  const capture = await jsonFile(artifact.capture);
  if (sourceDigest(await readFile(artifact.capture, 'utf8')) !== artifact.captureDigest) {
    throw new Error('Entry catalogue source capture changed; rebuild the catalogue.');
  }
  const scopes: ScanScope[] = [];
  const pin = entryCapturePin(capture);
  if (pin.maxSourceBytes !== artifact.sourcePolicy.maxSourceBytes) {
    throw new Error('Entry catalogue source policy conflicts with its capture.');
  }
  for (const stored of artifact.scopes) {
    const scope = parseScanScope(await jsonFile(stored.file));
    if (scope.repo !== pin.repo || scope.commit !== pin.commit) {
      throw new Error('Entry scope is outside the source capture pin.');
    }
    if (
      sourceDigest(JSON.stringify(scope)) !== stored.digest ||
      sourceDigest(JSON.stringify(parseScanScope(stored.scope))) !== stored.digest
    ) {
      throw new Error('Entry catalogue source scope changed; rebuild the catalogue.');
    }
    scopes.push(scope);
  }
  if (
    entryAnalysisFingerprint(scopes, cliDigest, artifact.sourcePolicy.maxSourceBytes) !==
    artifact.analysisFingerprint
  ) {
    throw new Error('Entry catalogue analysis fingerprint is stale; rebuild the catalogue.');
  }
  return scopes;
}

export function entryArgument(args: readonly string[], position: number): string {
  const value = args[position];
  if (value === undefined || value === '') throw new Error('Missing entry command argument.');
  return value;
}
