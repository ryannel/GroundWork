import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { describe, expect, it, vi } from 'vitest';

import { scanFixture } from '@/../test/scan-kit';
import { explorerManifestFixture } from '@/../test/service-explorer-kit';
import type { ScanDocument } from '@/domain/scan/scan.generated';
import { explorerPage } from '@/domain/service-explorer-check';
import {
  readCorpusDocument,
  type CorpusRepository,
} from '@/infrastructure/scan-explorer/corpus-catalogue';
import { parseExplorerManifest } from '@/infrastructure/service-explorer-format';

import { publishCorpusRepository } from './publish-corpus-repository';

vi.mock(import('server-only'), () => ({}));

vi.mock(import('@/infrastructure/scan-explorer/corpus-catalogue'), () => ({
  corpusDocuments: () =>
    ['metadata', 'native'].map((filename) => ({ filename, digest: '', program: true })),
  readCorpusDocument: vi.fn<() => Promise<ScanDocument>>(),
}));
vi.mock(import('@/infrastructure/scan-explorer/corpus-purpose'), () => ({
  readCorpusPurpose: async () =>
    await Promise.resolve(explorerManifestFixture([]).services[0]!.purpose),
}));

const reference = { path: '', bytes: 0, sha256: '' };
const detail: CorpusRepository = {
  repo: 'fixture/repo',
  commit: 'a'.repeat(40),
  detail: '',
  sourceStatus: 'source_complete',
  bindingArtifacts: [],
  interpretationArtifact: reference,
  review: reference,
  sourceDirectory: '',
  scopes: [],
  ancillary: [],
};

function documents(): readonly [ScanDocument, ScanDocument] {
  const base = scanFixture();
  const fixture = {
    ...base,
    sources: base.sources.map((source) => ({ ...source, commit: detail.commit })),
  };
  const metadata: ScanDocument = {
    ...fixture,
    framework: [
      {
        kind: 'source_framework_binding',
        id: 'entry',
        source: 'source:handler',
        support: ['source:handler'],
        language: 'python',
        framework: 'fastapi',
        role: 'http_entry',
        name: 'GET /price',
        target_source: 'source:handler',
        declaration: '@get',
        status: 'source_declared',
        limitations: ['Runtime unverified'],
      },
    ],
  };
  const native: ScanDocument = {
    ...fixture,
    semantic: [
      {
        kind: 'semantic_node',
        id: 'function',
        source: 'source:handler',
        owner: 'summary',
        nodeKind: 'function',
        name: 'getPrice',
        syntax: 'getPrice()',
      },
      {
        kind: 'semantic_node',
        id: 'return',
        source: 'source:handler',
        owner: 'summary',
        nodeKind: 'return',
        syntax: 'return price',
      },
      {
        kind: 'semantic_edge',
        id: 'body',
        source: 'source:handler',
        owner: 'summary',
        from: 'function',
        to: 'return',
        relation: 'body',
      },
    ],
  };
  return [metadata, native];
}

describe('corpus entry publication precedence', () => {
  it('keeps a later captured method body instead of an earlier metadata-only entry frame', async () => {
    const folder = await mkdtemp(path.join(os.tmpdir(), 'corpus-entry-'));
    const [metadata, native] = documents();
    vi.mocked(readCorpusDocument).mockResolvedValueOnce(metadata).mockResolvedValueOnce(native);
    try {
      const selection = await publishCorpusRepository(detail, {
        root: folder,
        output: folder,
        workspace: 'fixture',
        snapshot: 'selected',
        name: 'Prices',
      });
      const manifest = parseExplorerManifest(
        JSON.parse(await readFile(path.join(folder, selection.manifest.file), 'utf8')),
      );
      const entry = manifest.services[0]!.entries[0]!;
      const page = explorerPage(JSON.parse(await readFile(path.join(folder, entry.file), 'utf8')));
      expect(
        page.nodes.some((node) => node.kind === 'return' && node.label.includes('price')),
      ).toBe(true);
      expect(page.description).not.toContain('implementation has not been expanded');
    } finally {
      await rm(folder, { recursive: true, force: true });
    }
  });
});
