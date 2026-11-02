import { describe, expect, it } from 'vitest';

import { explorerManifestFixture } from '@/../test/service-explorer-kit';

import { explorerArtifactIndex, explorerBucket } from './explorer-artifact-index';
import {
  checkedExplorerIndex,
  checkedExplorerManifest,
  checkedPackPage,
} from './explorer-publication-check';

describe('bounded corpus publication', () => {
  const artifact = { file: `page-${'a'.repeat(24)}.json`, bytes: 100, sha256: 'b'.repeat(64) };
  const manifest = explorerManifestFixture([artifact]);
  it('accepts one hash-bound pack layer and checks selected member bounds', () => {
    const pack = { file: 'pack-abc.json', bytes: 1000, sha256: 'c'.repeat(64) };
    const packed = { ...manifest, artifacts: [{ ...artifact, pack }] };
    expect(checkedExplorerManifest(packed)).toEqual(packed);
    expect(
      checkedPackPage(
        { format: 'service-explorer-pack/v1', pages: { 'page.json': '{}' } },
        'page.json',
      ),
    ).toBe('{}');
    expect(() =>
      checkedExplorerManifest({ ...packed, artifacts: [{ ...artifact, pack: { ...pack, pack } }] }),
    ).toThrow('Invalid');
    expect(() =>
      checkedExplorerManifest({ ...packed, artifacts: [{ ...artifact, pack: null }] }),
    ).toThrow('Invalid');
    expect(() => checkedPackPage(null, 'page.json')).toThrow('Invalid');
    expect(() => checkedPackPage({ format: 'other', pages: {} }, 'page.json')).toThrow('Invalid');
    expect(() =>
      checkedPackPage({ format: 'service-explorer-pack/v1', pages: null }, 'page.json'),
    ).toThrow('Invalid');
    expect(() =>
      checkedPackPage({ format: 'service-explorer-pack/v1', pages: {} }, 'page.json'),
    ).toThrow('outside');
    expect(() =>
      checkedPackPage(
        {
          format: 'service-explorer-pack/v1',
          pages: Object.fromEntries(
            Array.from({ length: 1025 }, (_, index) => [String(index), '{}']),
          ),
        },
        '0',
      ),
    ).toThrow('bound');
  });
  it('locates an immutable page through its selected index bucket', () => {
    const index = { bucket: 'aa', file: 'index-aa.json', bytes: 200, sha256: 'c'.repeat(64) };
    const selected = { ...manifest, artifactIndexes: [index] };
    expect(checkedExplorerManifest(selected)).toEqual(selected);
    expect(explorerArtifactIndex(selected, artifact.file)).toEqual(index);
    expect(explorerArtifactIndex(selected, '../page-aa.json')).toBeUndefined();
    expect(explorerBucket('outside.json')).toBeNull();
    expect(
      checkedExplorerIndex(
        { format: 'service-explorer-index/v1', snapshot: manifest.snapshot, artifacts: [artifact] },
        manifest.snapshot,
      ),
    ).toEqual([artifact]);
    expect(checkedExplorerManifest(manifest).artifactIndexes).toBeUndefined();
  });
  it.each([
    null,
    {},
    { ...manifest, format: 'other' },
    { ...manifest, workspace: '' },
    { ...manifest, snapshot: null },
    { ...manifest, services: null },
    { ...manifest, artifacts: {} },
    { ...manifest, artifactIndexes: [artifact] },
    { ...manifest, artifactIndexes: [{ ...artifact, bucket: 'wrong' }] },
    { ...manifest, artifacts: [{ ...artifact, bytes: 0 }] },
    { ...manifest, artifacts: [{ ...artifact, bytes: 2_097_153 }] },
    { ...manifest, artifacts: [{ ...artifact, sha256: 'not-a-digest' }] },
    { ...manifest, artifacts: [{ ...artifact, file: '../escape.json' }] },
  ])('rejects malformed selected manifests', (value) => {
    expect(() => checkedExplorerManifest(value)).toThrow(/Invalid|changed/u);
  });
  it.each(['id', 'name', 'repo', 'commit', 'overview', 'callers', 'purpose', 'entries'])(
    'rejects an invalid service %s',
    (key) => {
      expect(() =>
        checkedExplorerManifest({
          ...manifest,
          services: [{ ...manifest.services[0], [key]: null }],
        }),
      ).toThrow(/Invalid|changed/u);
    },
  );
  it('rejects malformed purpose and entry declarations', () => {
    const service = manifest.services[0]!;
    for (const purpose of [
      null,
      { ...service.purpose, label: 'Fact' },
      { ...service.purpose, confidence: 'certain' },
      { ...service.purpose, statement: '' },
      { ...service.purpose, claim: '' },
    ]) {
      expect(() =>
        checkedExplorerManifest({ ...manifest, services: [{ ...service, purpose }] }),
      ).toThrow(/Invalid|changed/u);
    }
    for (const entries of [
      [null],
      [{ id: '', label: 'test', file: 'page.json' }],
      [{ id: 'test', label: '', file: 'page.json' }],
      [{ id: 'test', label: 'test', file: '../page.json' }],
    ]) {
      expect(() =>
        checkedExplorerManifest({ ...manifest, services: [{ ...service, entries }] }),
      ).toThrow(/Invalid|changed/u);
    }
  });
  it('requires a matching index snapshot, unique pages and bounded metadata', () => {
    const index = {
      format: 'service-explorer-index/v1',
      snapshot: manifest.snapshot,
      artifacts: [artifact],
    };
    expect(() => checkedExplorerIndex(null, manifest.snapshot)).toThrow(/Invalid|changed/u);
    expect(() => checkedExplorerIndex({ ...index, format: 'other' }, manifest.snapshot)).toThrow(
      /Invalid|changed/u,
    );
    expect(() => checkedExplorerIndex(index, 'different')).toThrow(/Invalid|changed/u);
    expect(() =>
      checkedExplorerIndex({ ...index, artifacts: [artifact, artifact] }, manifest.snapshot),
    ).toThrow('Duplicate');
    expect(() =>
      checkedExplorerManifest({
        ...manifest,
        services: Array.from({ length: 201 }, () => manifest.services[0]),
      }),
    ).toThrow(/Invalid|changed/u);
  });
});
