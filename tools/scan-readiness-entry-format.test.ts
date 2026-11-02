import { describe, expect, it, vi } from 'vitest';

import {
  entryCapturePin,
  parseEntryArtifact,
} from '@/infrastructure/scan/spring-entry-artifact-format';

vi.mock(import('server-only'), () => ({}));

function fixture() {
  const source = 'core/src/main/java/Timer.java';
  const scope = {
    format: 'scan-scope/v1',
    workspace: 'fixture',
    id: 'repository-0001',
    repo: 'fixture/repo',
    commit: 'a'.repeat(40),
    ref: 'HEAD',
    files: [{ path: source, language: 'java', environment: 'unknown' }],
    questions: [
      {
        id: 'q',
        profile: 'endpoint',
        path: source,
        symbol: 'tick',
        checks: [{ kind: 'investigation', text: 'Retain source evidence.' }],
      },
    ],
  };
  const entry = {
    id: 'entry:schedule',
    kind: 'schedule',
    binding_id: 'schedule',
    declaration_source_id: 'method',
    executable_source_id: 'method',
    root_source_ids: ['method'],
    completeness: 'partial',
  };
  const plan = {
    entry_id: entry.id,
    root_source_ids: ['method'],
    owner_source_ids: ['method'],
    field_source_ids: [],
    call_binding_ids: [],
    boundary_binding_ids: [],
    frontiers: [],
    limits: {
      maxOwners: 32,
      maxCalls: 256,
      maxFields: 64,
      maxDepth: 8,
      maxSyntaxNodes: 4096,
      maxFrontiers: 64,
    },
    selected_syntax_nodes: 1,
    omitted_frontiers: 0,
    completeness: 'partial',
    execution: 'source_reachability_runtime_unverified',
  };
  return {
    format: 'spring-entry-catalogue/v1',
    capture: '/capture/repository.json',
    captureDigest: 'capture',
    metadataChecksum: 'metadata',
    analysisFingerprint: 'analysis',
    planChecksum: 'plan',
    sourcePolicy: { maxSourceBytes: 1_048_576 },
    scopes: [{ file: '/capture/repository-0001/scope.json', digest: 'scope', scope }],
    catalogue: {
      entries: [entry],
      boundaries: [],
      quarantined_paths: [],
      completeness: 'partial',
      gaps: ['Runtime activation remains unverified.'],
    },
    plans: [{ binding_id: 'schedule', plan }],
    source_locations: [{ source_id: 'method', path: source, scope_id: scope.id }],
  };
}

describe('closed entry catalogue artifact format', () => {
  it('retains typed source entries, native plans, original scopes and explicit source policy', () => {
    const artifact = parseEntryArtifact(fixture());
    expect(artifact.catalogue.entries[0]?.kind).toBe('schedule');
    expect(artifact.scopes[0]?.scope.repo).toBe('fixture/repo');
    expect(artifact.sourcePolicy.maxSourceBytes).toBe(1_048_576);
  });

  it('rejects runtime and actor assertions in the source declaration catalogue', () => {
    const input = fixture();
    expect(() =>
      parseEntryArtifact({ ...input, catalogue: { ...input.catalogue, active: true } }),
    ).toThrow(/unrecognized_keys|invalid_value|too_small|repository-relative|Source byte limit/u);
    expect(() =>
      parseEntryArtifact({
        ...input,
        catalogue: {
          ...input.catalogue,
          entries: [{ ...input.catalogue.entries[0], actor: 'Administrator' }],
        },
      }),
    ).toThrow(/unrecognized_keys|invalid_value|too_small|repository-relative|Source byte limit/u);
    expect(() =>
      parseEntryArtifact({
        ...input,
        plans: [
          { ...input.plans[0], plan: { ...input.plans[0]?.plan, execution: 'runtime_verified' } },
        ],
      }),
    ).toThrow(/unrecognized_keys|invalid_value|too_small|repository-relative|Source byte limit/u);
  });

  it('rejects unsafe scope paths, unknown entry kinds and source budget violations', () => {
    const input = fixture();
    expect(() =>
      parseEntryArtifact({
        ...input,
        catalogue: {
          ...input.catalogue,
          entries: [{ ...input.catalogue.entries[0], kind: 'guessed_entry' }],
        },
      }),
    ).toThrow(/unrecognized_keys|invalid_value|too_small|repository-relative|Source byte limit/u);
    expect(() => parseEntryArtifact({ ...input, sourcePolicy: { maxSourceBytes: 0 } })).toThrow(
      /unrecognized_keys|invalid_value|too_small|repository-relative|Source byte limit/u,
    );
    expect(() =>
      parseEntryArtifact({
        ...input,
        scopes: [
          {
            ...input.scopes[0],
            scope: {
              ...input.scopes[0]?.scope,
              files: [{ path: '../outside.java', language: 'java', environment: 'unknown' }],
            },
          },
        ],
      }),
    ).toThrow(/unrecognized_keys|invalid_value|too_small|repository-relative|Source byte limit/u);
  });

  it('normalises legacy source policy and preserves explicit captured byte limits', () => {
    const source = { format: 'scan-repository/v1', repo: 'fixture/repo', commit: 'a'.repeat(40) };
    expect(entryCapturePin(source).maxSourceBytes).toBe(1_048_576);
    expect(
      entryCapturePin({ ...source, sourcePolicy: { maxSourceBytes: 512, shardSize: 40 } })
        .maxSourceBytes,
    ).toBe(512);
    expect(() =>
      entryCapturePin({ ...source, sourcePolicy: { maxSourceBytes: 33_554_433 } }),
    ).toThrow(/unrecognized_keys|invalid_value|too_small|repository-relative|Source byte limit/u);
  });
});
