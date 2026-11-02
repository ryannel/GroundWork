import { describe, expect, it } from 'vitest';

import { planFreshnessInvalidation, type FreshnessFact } from './freshness-plan';

const fact = (
  id: string,
  paths: readonly string[],
  overrides: Partial<FreshnessFact> = {},
): FreshnessFact => ({
  id,
  paths,
  scope: 'app',
  closureComplete: true,
  dependsOn: [],
  negativeSearches: [],
  ...overrides,
});

describe('freshness invalidation', () => {
  it('parses changed blobs while invalidating shared helpers and their transitive consumers', () => {
    const result = planFreshnessInvalidation({
      changes: [{ status: 'modified', path: 'shared/helper.ts' }],
      facts: [
        fact('helper', ['shared/helper.ts']),
        fact('handler', ['app/handler.ts'], { dependsOn: ['helper'] }),
        fact('endpoint', ['app/endpoint.ts'], { dependsOn: ['handler'] }),
        fact('other', ['other/file.ts']),
      ],
    });
    expect(result.changedFilesToParse).toEqual(['shared/helper.ts']);
    expect(result.invalidatedFacts).toEqual(['endpoint', 'handler', 'helper']);
    expect(result.reusedFiles).toContain('app/endpoint.ts');
  });

  it('reuses a same-blob rename and refreshes anchors, retires deleted facts and invalidates negative lookups', () => {
    const result = planFreshnessInvalidation({
      changes: [
        {
          status: 'renamed',
          path: 'app/new.ts',
          previousPath: 'app/old.ts',
          oldBlob: 'same',
          newBlob: 'same',
        },
        { status: 'deleted', path: 'app/deleted.ts' },
        { status: 'added', path: 'missing/package.ts' },
      ],
      facts: [
        fact('renamed', ['app/old.ts']),
        fact('deleted', ['app/deleted.ts']),
        fact('lookup', ['app/lookup.ts'], { negativeSearches: ['missing'] }),
      ],
    });
    expect(result.changedFilesToParse).toEqual(['missing/package.ts']);
    expect(result.refreshedAnchors).toEqual(['app/new.ts']);
    expect(result.retiredFacts).toEqual(['deleted']);
    expect(result.invalidatedFacts).toEqual(['deleted', 'lookup', 'renamed']);
  });

  it('falls back conservatively for incomplete closures and supports configuration-wide invalidation', () => {
    const facts = [
      fact('unknown', ['app/unknown.ts'], { closureComplete: false }),
      fact('peer', ['app/peer.ts']),
      fact('other', ['other/file.ts'], { scope: 'other' }),
    ];
    const result = planFreshnessInvalidation({
      changes: [{ status: 'added', path: 'external/module.ts' }],
      facts,
    });
    expect(result.fallbackScopes).toEqual(['app']);
    expect(result.invalidatedFacts).toEqual(['peer', 'unknown']);
    expect(
      planFreshnessInvalidation({ changes: [], facts, forceScope: true }).invalidatedFacts,
    ).toEqual(['other', 'peer', 'unknown']);
  });

  it('invalidates configured dependencies and lockfile changes without reparsing reused source', () => {
    const facts = [fact('handler', ['app/handler.ts'], { dependsOn: ['external-schema'] })];
    expect(
      planFreshnessInvalidation({ changes: [], facts, changedDependencies: ['external-schema'] })
        .invalidatedFacts,
    ).toEqual(['handler']);
    const result = planFreshnessInvalidation({
      changes: [{ status: 'modified', path: 'package-lock.json' }],
      facts,
    });
    expect(result.changedFilesToParse).toEqual(['package-lock.json']);
    expect(result.invalidatedFacts).toEqual(['handler']);
    expect(result.reusedFiles).toEqual(['app/handler.ts']);
  });

  it('falls back on unrecorded dependency changes and non-JavaScript configuration inputs', () => {
    const facts = [
      fact('incomplete', ['app/a.ts'], { closureComplete: false }),
      fact('peer', ['app/b.ts']),
    ];
    expect(
      planFreshnessInvalidation({ changes: [], changedDependencies: ['missing-dependency'], facts })
        .invalidatedFacts,
    ).toEqual(['incomplete', 'peer']);
    for (const path of [
      'go.mod',
      'go.sum',
      'pom.xml',
      'build.gradle.kts',
      'application.yaml',
      'Api/Api.csproj',
      'Directory.Build.props',
      'Directory.Packages.props',
      'build.targets',
      'global.json',
      'NuGet.config',
    ]) {
      const result = planFreshnessInvalidation({ changes: [{ status: 'modified', path }], facts });
      expect(result.invalidatedFacts).toEqual(['incomplete', 'peer']);
    }
  });

  it('does not parse gitlinks or invalidate an unchanged complete closure', () => {
    const facts = [fact('clean', ['app/clean.ts'])];
    expect(planFreshnessInvalidation({ changes: [], facts }).invalidatedFacts).toEqual([]);
    expect(
      planFreshnessInvalidation({
        changes: [{ status: 'modified', path: 'vendor', gitlink: true }],
        facts,
      }).changedFilesToParse,
    ).toEqual([]);
  });
});
