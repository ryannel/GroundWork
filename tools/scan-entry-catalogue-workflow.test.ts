import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import type { ScanScope } from '@/infrastructure/scan/scan-scope';

import { readEntryArtifact } from './scan-entry-artifacts';
import { repositoryGit } from './scan-repository-inventory';
import { buildSpringEntryCatalogue } from './scan-spring-entry-catalogue';
import { querySpringEntry } from './scan-spring-entry-query';

vi.mock(import('server-only'), () => ({}));
const folders: string[] = [];
afterEach(async () => {
  for (const folder of folders.splice(0)) await rm(folder, { recursive: true, force: true });
});

async function fixture(maxSourceBytes?: number) {
  const root = await mkdtemp(path.join(tmpdir(), 'entry-workflow-'));
  folders.push(root);
  const repository = path.join(root, 'fixture/repo');
  const source = path.join(repository, 'core/src/main/java');
  const capture = path.join(root, 'capture');
  const cache = path.join(root, 'cache');
  const output = path.join(root, 'catalogue');
  await mkdir(source, { recursive: true });
  await mkdir(path.join(capture, 'repository-0001'), { recursive: true });
  const files = [
    [
      'Api.java',
      `package fixture; import org.springframework.web.bind.annotation.RestController;
      import org.springframework.web.bind.annotation.GetMapping;
      @RestController class Api { Helper helper; @GetMapping("/one") String run() { return helper.execute(); } }`,
    ],
    ['Helper.java', 'package fixture; class Helper { String execute() { return "ok"; } }'],
    ['Unused.java', 'package fixture; class Unused { void notCalled() {} }'],
  ] as const;
  for (const [file, content] of files) await writeFile(path.join(source, file), content);
  repositoryGit(repository, ['init', '-q']);
  repositoryGit(repository, ['config', 'user.email', 'fixture@example.test']);
  repositoryGit(repository, ['config', 'user.name', 'Fixture']);
  repositoryGit(repository, ['add', '-A']);
  repositoryGit(repository, ['commit', '-qm', 'Pinned fixture']);
  const commit = repositoryGit(repository, ['rev-parse', 'HEAD']).toString('utf8').trim();
  const paths = files.map(([file]) => `core/src/main/java/${file}`);
  const scope: ScanScope = {
    format: 'scan-scope/v1',
    workspace: 'fixture',
    id: 'repository-0001',
    repo: 'fixture/repo',
    commit,
    ref: 'HEAD',
    files: paths.map((file) => ({ path: file, language: 'java', environment: 'server' })),
    questions: paths.map((file, index) => ({
      id: `investigate-${String(index)}`,
      profile: 'endpoint',
      path: file,
      symbol: '',
      checks: [
        { kind: 'investigation', text: 'Retain source evidence without a completeness claim.' },
      ],
    })),
  };
  await writeFile(path.join(capture, 'repository-0001/scope.json'), JSON.stringify(scope));
  await writeFile(
    path.join(capture, 'repository.json'),
    JSON.stringify({
      format: 'scan-repository/v1',
      repo: scope.repo,
      commit,
      ...(maxSourceBytes === undefined ? {} : { sourcePolicy: { maxSourceBytes } }),
    }),
  );
  const options = {
    capture: path.join(capture, 'repository.json'),
    cloneRoot: root,
    cache,
    output,
  };
  await buildSpringEntryCatalogue(options);
  const artifact = await readEntryArtifact(output);
  const entry = artifact.plans[0]?.plan.entry_id;
  if (entry === undefined) throw new Error('Expected automatic source entry');
  return { ...options, entry, catalogue: output, root };
}

function pagesOf(value: unknown): readonly unknown[] {
  if (!Array.isArray(value)) throw new Error('Expected public query pages');
  return value;
}

describe.runIf(process.env.GROUNDWORK_NATIVE_PARSERS === '1')(
  'automatic entry catalogue workflow',
  () => {
    it('queries only needed cached files, reuses native indexes and returns bounded source evidence', async () => {
      const options = await fixture();
      const output = path.join(options.root, 'query');
      await querySpringEntry({ ...options, output });
      const receipt: unknown = JSON.parse(
        await readFile(path.join(output, 'receipt.json'), 'utf8'),
      );
      expect(receipt).toMatchObject({
        completeness: 'partial',
        execution: 'source_reachability_runtime_unverified',
        statistics: [
          {
            scope: 'repository-0001',
            selectedPaths: ['core/src/main/java/Api.java', 'core/src/main/java/Helper.java'],
            stats: { blobReads: 0, parsedFiles: 0, indexHits: 2, reusedFiles: 2 },
          },
        ],
      });
      const pages: unknown = JSON.parse(await readFile(path.join(output, 'pages.json'), 'utf8'));
      for (const page of pagesOf(pages)) {
        expect(Buffer.byteLength(JSON.stringify(page))).toBeLessThanOrEqual(65_536);
      }
      expect(JSON.stringify(pages)).not.toContain('Unused.java');
      expect(JSON.stringify(pages)).toContain('semantic_node');
      const metadata: unknown = JSON.parse(
        await readFile(path.join(options.catalogue, 'metadata.json'), 'utf8'),
      );
      expect(metadata).toMatchObject({ semantic: [], summaries: [] });
    }, 30_000);

    it('rejects stale source captures before creating a query output', async () => {
      const options = await fixture();
      await writeFile(options.capture, JSON.stringify({ changed: true }));
      await expect(
        querySpringEntry({ ...options, output: path.join(options.root, 'query') }),
      ).rejects.toThrow('source capture changed');
    }, 30_000);

    it('rejects corrupted planning metadata without silently using stale selectors', async () => {
      const options = await fixture();
      const artifact = await readEntryArtifact(options.catalogue);
      const plan = artifact.plans[0];
      if (!plan) throw new Error('Missing query plan');
      plan.plan.owner_source_ids = ['source:unknown'];
      await writeFile(path.join(options.catalogue, 'catalogue.json'), JSON.stringify(artifact));
      await expect(
        querySpringEntry({ ...options, output: path.join(options.root, 'query') }),
      ).rejects.toThrow('planning checksum changed');
    }, 30_000);
    it('rejects an outdated analysis fingerprint before projecting native bodies', async () => {
      const options = await fixture();
      const artifact = await readEntryArtifact(options.catalogue);
      artifact.analysisFingerprint = 'stale-analysis';
      await writeFile(path.join(options.catalogue, 'catalogue.json'), JSON.stringify(artifact));
      await expect(
        querySpringEntry({ ...options, output: path.join(options.root, 'query') }),
      ).rejects.toThrow('analysis fingerprint is stale');
    }, 30_000);
    it('inherits explicit source budgets through catalogue fingerprints and warm native queries', async () => {
      const options = await fixture(512);
      const artifact = await readEntryArtifact(options.catalogue);
      expect(artifact.sourcePolicy.maxSourceBytes).toBe(512);
      const output = path.join(options.root, 'query');
      await querySpringEntry({ ...options, output });
      const receipt: unknown = JSON.parse(
        await readFile(path.join(output, 'receipt.json'), 'utf8'),
      );
      expect(receipt).toMatchObject({
        sourcePolicy: { maxSourceBytes: 512 },
        statistics: [{ stats: { parsedFiles: 0, blobReads: 0 } }],
      });
      await expect(
        querySpringEntry({
          ...options,
          maxSourceBytes: 1024,
          output: path.join(options.root, 'conflict'),
        }),
      ).rejects.toThrow('source policy conflicts');
    }, 30_000);
  },
);
