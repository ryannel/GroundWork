import 'server-only';

import { readFileSync, readdirSync } from 'node:fs';

import type { CurrentProvenance } from './freshness-status';
import type { ScanScope } from './scan-scope';
import { sourceByteLimit } from './source-budget';
import { parserIdentity } from './source-cache';
import { sourceDigest } from './source-index';
import type { SourceInput } from './source-index-types';

export interface ScopedProvenanceOptions {
  readonly authority: string;
  readonly java?: string;
  readonly go?: string;
  readonly ruleVersion?: string;
  readonly parserVersion?: string;
  readonly maxSourceBytes?: number;
}
interface Fingerprint {
  readonly provenance: CurrentProvenance;
  readonly parsers: ReadonlyMap<SourceInput['language'], string>;
}
function scriptDigest(files: readonly string[]): string {
  return sourceDigest(
    files.map((file) => readFileSync(new URL(file, import.meta.url), 'utf8')).join('\0'),
  );
}
function ruleDigest(version: string | undefined): string {
  const scannerFiles = readdirSync(new URL('.', import.meta.url))
    .filter((file) => file.endsWith('.ts') && !file.includes('.test.') && !file.includes('fixture'))
    .toSorted((left, right) => left.localeCompare(right))
    .map((file) => `./${file}`);
  const domainFiles = readdirSync(new URL('../../domain/scan/', import.meta.url))
    .filter(
      (file) => file.endsWith('.ts') && !file.includes('.test.') && !file.endsWith('.generated.ts'),
    )
    .toSorted((left, right) => left.localeCompare(right))
    .map((file) => `../../domain/scan/${file}`);
  return sourceDigest(
    JSON.stringify([
      version ?? '',
      scriptDigest([
        ...scannerFiles,
        './canonical-data-fixture.ts',
        ...domainFiles,
        '../../../schema/scan.schema.json',
        '../../../tools/scan-spring-inputs.ts',
        '../../../tools/scan-spring-resources.ts',
        '../../../tools/scan-repository-inventory.ts',
        '../../../tools/scan-repository-generated.ts',
        '../../../tools/scan-repository-generated-config.ts',
        '../../../tools/scan-repository-fixtures.ts',
        '../../../tools/scan-binding-evidence.ts',
        '../../../tools/scan-spring.ts',
        '../../../package-lock.json',
      ]),
    ]),
  );
}
function parserDigest(input: SourceInput, version: string | undefined): string {
  const adapters: Readonly<Record<SourceInput['language'], readonly string[]>> = {
    typescript: [
      './typescript-index.ts',
      './typescript-fields.ts',
      './typescript-binding.ts',
      './typescript-semantic-fields.ts',
    ],
    javascript: [
      './typescript-index.ts',
      './typescript-fields.ts',
      './typescript-binding.ts',
      './typescript-semantic-fields.ts',
    ],
    csharp: ['./csharp-runtime.ts'],
    python: ['./python-rust-runtime.ts'],
    rust: ['./python-rust-runtime.ts'],
    java: ['./java-runtime.ts'],
    go: ['./java-runtime.ts'],
  };
  const scripts = ['./source-index.ts', ...adapters[input.language]];
  return sourceDigest(
    JSON.stringify([
      version ?? '',
      parserIdentity(input),
      scriptDigest(scripts),
      'compiler-fields/v2',
    ]),
  );
}
function parserDigests(
  files: ScanScope['files'],
  options: ScopedProvenanceOptions,
): ReadonlyMap<SourceInput['language'], string> {
  const fingerprints = new Map<SourceInput['language'], string>();
  for (const file of files) {
    if (!fingerprints.has(file.language)) {
      fingerprints.set(
        file.language,
        parserDigest(
          {
            path: file.path,
            content: '',
            language: file.language,
            ...(options.java === undefined ? {} : { java: options.java }),
            ...(options.go === undefined ? {} : { go: options.go }),
          },
          options.parserVersion,
        ),
      );
    }
  }
  return fingerprints;
}

export function scopedFingerprint(scope: ScanScope, options: ScopedProvenanceOptions): Fingerprint {
  const parsers = parserDigests(scope.files, options);
  return {
    parsers,
    provenance: provenanceWith(scope, options, { parsers, rules: ruleDigest(options.ruleVersion) }),
  };
}

function provenanceWith(
  scope: ScanScope,
  options: ScopedProvenanceOptions,
  analysis: {
    readonly parsers: ReadonlyMap<SourceInput['language'], string>;
    readonly rules: string;
  },
): CurrentProvenance {
  return {
    environmentDigest: sourceDigest(JSON.stringify(scope.files.map((file) => file.environment))),
    configDigest: sourceDigest(
      JSON.stringify({
        authority: options.authority,
        maxSourceBytes: sourceByteLimit(options.maxSourceBytes),
        files: scope.files,
        questions: scope.questions,
      }),
    ),
    toolchainDigest: sourceDigest(
      JSON.stringify(scope.files.map((file) => analysis.parsers.get(file.language))),
    ),
    ruleDigest: analysis.rules,
  };
}

/** Recomputes current rule/schema/tool provenance without reading application source blobs. */
export function scopedProvenance(
  scope: ScanScope,
  options: ScopedProvenanceOptions,
): CurrentProvenance {
  return scopedFingerprint(scope, options).provenance;
}

/** Re-read analysis bytes once for this checkpoint; no cache survives the call. */
export function scopedProvenances(
  scopes: readonly ScanScope[],
  options: ScopedProvenanceOptions,
): readonly CurrentProvenance[] {
  if (scopes.length === 0) return [];
  const parsers = parserDigests(
    scopes.flatMap((scope) => scope.files),
    options,
  );
  const rules = ruleDigest(options.ruleVersion);
  return scopes.map((scope) => provenanceWith(scope, options, { parsers, rules }));
}
