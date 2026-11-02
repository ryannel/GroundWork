import { execFileSync } from 'node:child_process';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import type { DiscoveryInventory } from '@/domain/scan/discovery-types';
import {
  discoveryInventoryDigest,
  parseDiscoveryInventory,
} from '@/infrastructure/scan/discovery-format';
import {
  discoveryEntry,
  discoveryScopes,
  discoverySelection,
} from '@/infrastructure/scan/discovery-inventory-rules';
import {
  discoveryDigest,
  loadDiscoverySource,
} from '@/infrastructure/scan/discovery-inventory-source';

import { discoveryInventory, readDiscoveryInventory } from './scan-discovery-inventory';

vi.mock(import('server-only'), () => ({}));

const temporary: string[] = [];
afterEach(async () => {
  await Promise.all(
    temporary.splice(0).map(async (directory) => rm(directory, { recursive: true, force: true })),
  );
});
async function fixture(extras: Readonly<Record<string, string>> = {}, canonicalOnly = false) {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'discovery-inventory-'));
  temporary.push(directory);
  const cloneRoot = path.join(directory, 'clones');
  const clone = path.join(cloneRoot, 'example', 'mixed');
  const capture = path.join(directory, 'capture');
  await mkdir(clone, { recursive: true });
  await mkdir(capture);
  const files: Readonly<Record<string, string>> = canonicalOnly
    ? {
        'README.md': 'Protobuf contracts for offer and order integrations.\n',
        'contract.proto': 'syntax = "proto3";\nmessage Product { string id = 1; }\n',
      }
    : {
        'package.json': '{"scripts":{"dev":"turbo dev"}}',
        'apps/test-drive/package.json': '{"scripts":{"car:start":"next start"}}',
        'apps/test-drive/app/page.tsx':
          'export default function Page() { return "book a test drive"; }',
        'apps/test-drive/app/[siteSlug]/build/(configurator)/[modelSlug]/page.tsx':
          'export default function Configure() { return "build a car"; }',
        'apps/test-drive/app/dist/page.tsx':
          'export default function Distribution() { return "distribution"; }',
        'node_modules/dependency/package.json': '{}',
        'vendor/dependency/package.json': '{}',
        '.yarn/dependency/package.json': '{}',
        'apps/test-drive/src/feature.ts': 'export function feature() { return "booking"; }',
        'apps/test-drive/app/route.ts': 'export function POST() { return new Response("booked"); }',
        'apps/assets/README.md': 'Static assets published to storage.\n',
        'apps/nav/function-app/package.json': '{"scripts":{"start":"func start"}}',
        'apps/nav/function-app/Lookup/function.json': '{"bindings":[]}',
        'apps/nav/function-app/Lookup/index.ts':
          'export function lookup() { return "navigation"; }',
        ...extras,
        'src/Library.csproj':
          '<Project Sdk="Microsoft.NET.Sdk.Web"><PropertyGroup><OutputType>Library</OutputType></PropertyGroup></Project>',
      };
  await Promise.all(
    Object.entries(files).map(async ([filename, bytes]) => {
      await mkdir(path.dirname(path.join(clone, filename)), { recursive: true });
      await writeFile(path.join(clone, filename), bytes);
    }),
  );
  const git = (args: readonly string[]) =>
    execFileSync('git', ['-C', clone, ...args], { encoding: 'utf8' }).trim();
  git(['init', '-q']);
  git(['add', '.']);
  git([
    '-c',
    'user.name=Fixture',
    '-c',
    'user.email=fixture@example.com',
    'commit',
    '-qm',
    'fixture',
  ]);
  const commit = git(['rev-parse', 'HEAD']);
  const tree = git(['rev-parse', 'HEAD^{tree}']);
  const listed = git(['ls-tree', '-r', 'HEAD'])
    .split('\n')
    .map((line) => {
      const [metadata, filename] = line.split('\t');
      const [mode, kind, blob] = metadata?.split(' ') ?? [];
      return { path: filename, mode, kind, blob };
    });
  const inventory = { repo: 'example/mixed', commit, tree, files: listed };
  const plan = {
    inventoryDigest: discoveryDigest(JSON.stringify(inventory)),
    scopes: canonicalOnly ? [] : [{}],
  };
  const report = {
    repo: 'example/mixed',
    commit,
    tree,
    runStatus: 'source_complete',
    trials: canonicalOnly ? [] : [{ document: 'snapshot.json' }],
  };
  const bytes = `${JSON.stringify(report)}\n`;
  await Promise.all([
    writeFile(path.join(capture, 'repository.json'), bytes),
    writeFile(path.join(capture, 'inventory.json'), JSON.stringify(inventory)),
    writeFile(path.join(capture, 'run-plan.json'), JSON.stringify(plan)),
    writeFile(
      path.join(capture, 'run-state.json'),
      JSON.stringify({
        status: 'source_complete',
        reportDigest: discoveryDigest(bytes),
        planDigest: discoveryDigest(JSON.stringify(plan)),
        completed: canonicalOnly
          ? []
          : [{ artifacts: [{ path: 'snapshot.json', digest: discoveryDigest('{}') }] }],
      }),
    ),
    writeFile(path.join(capture, 'snapshot.json'), '{}'),
  ]);
  return { directory, cloneRoot, capture, files };
}
async function rewriteInventory(output: string, inventory: DiscoveryInventory): Promise<void> {
  const altered = { ...inventory, sha256: discoveryInventoryDigest(inventory) };
  const bytes = JSON.stringify(altered);
  await writeFile(path.join(output, 'inventory.json'), bytes);
  const publicationFile = path.join(output, 'publication.json');
  const parsed = z
    .object({ artifacts: z.array(z.object({ path: z.string(), sha256: z.string() })) })
    .loose()
    .parse(JSON.parse(await readFile(publicationFile, 'utf8')));
  await writeFile(
    publicationFile,
    JSON.stringify({
      ...parsed,
      inventory_sha256: altered.sha256,
      artifacts: parsed.artifacts.map((artifact) =>
        artifact.path === 'inventory.json'
          ? { ...artifact, sha256: discoveryDigest(bytes) }
          : artifact,
      ),
    }),
  );
}
describe('scripted discovery inventory', () => {
  it('preserves apps without manifests, nested hosts, business names and all route candidates', async () => {
    const input = await fixture();
    const source = await loadDiscoverySource(input.capture, input.cloneRoot);
    const scopes = discoveryScopes(source.files);
    expect(scopes.map((scope) => scope.root)).toEqual(
      expect.arrayContaining([
        '.',
        'apps/assets',
        'apps/test-drive',
        'apps/nav',
        'apps/nav/function-app',
        'apps/nav/function-app/Lookup',
        'src',
      ]),
    );
    const testDrive = scopes.find((scope) => scope.root === 'apps/test-drive');
    expect(testDrive).toBeDefined();
    expect(
      discoverySelection(testDrive!)
        .filter((selection) => selection.basis === 'entry')
        .map((selection) => selection.file.path),
    ).toEqual([
      'apps/test-drive/app/[siteSlug]/build/(configurator)/[modelSlug]/page.tsx',
      'apps/test-drive/app/dist/page.tsx',
      'apps/test-drive/app/page.tsx',
      'apps/test-drive/app/route.ts',
    ]);
    expect(
      scopes.some((scope) =>
        ['node_modules/dependency', 'vendor/dependency', '.yarn/dependency'].includes(scope.root),
      ),
    ).toBe(false);
  });
  it('discovers conventional Nest bootstraps/controllers and Nx scopes without claiming framework or runtime proof', async () => {
    const input = await fixture({
      'apps/api/project.json': '{"targets":{"serve":{"executor":"@nx/js:node"}}}',
      'apps/api/src/main.ts':
        'import { NestFactory } from "@nestjs/core"; NestFactory.create(AppModule);',
      'apps/api/src/example.controller.ts':
        '@Controller("example") export class ExampleController {}',
      'apps/api/src/events.consumer.ts': 'export class EventsConsumer {}',
      'libs/values/project.json': '{"projectType":"library"}',
      'libs/values/src/main.ts': 'export const main = "a value, not a bootstrap proof";',
      'libs/values/src/Main.ts': 'export const title = "ordinary name";',
    });
    const source = await loadDiscoverySource(input.capture, input.cloneRoot);
    const scopes = discoveryScopes(source.files);
    const api = scopes.find((scope) => scope.root === 'apps/api');
    expect(api?.manifests.map((file) => file.path)).toEqual(['apps/api/project.json']);
    expect(api?.files.filter((file) => discoveryEntry(file.path)).map((file) => file.path)).toEqual(
      [
        'apps/api/src/events.consumer.ts',
        'apps/api/src/example.controller.ts',
        'apps/api/src/main.ts',
      ],
    );
    expect(scopes.some((scope) => scope.root === 'libs/values')).toBe(true);
    expect(discoveryEntry('libs/values/src/main.ts')).toBe(true);
    expect(discoveryEntry('libs/values/src/Main.ts')).toBe(false);
    expect(discoveryEntry('templates/example.controller.ts.ejs')).toBe(false);
  });
  it('retains exact source bytes, produces stable candidates and refuses overwriting publication', async () => {
    const input = await fixture();
    const output = path.join(input.directory, 'output');
    await discoveryInventory({ ...input, output });
    const inventory = parseDiscoveryInventory(
      JSON.parse(await readFile(path.join(output, 'inventory.json'), 'utf8')),
    );
    expect(inventory.repo).toBe('example/mixed');
    expect(
      inventory.candidates.some(
        (item) => item.kind === 'entry' && item.root === 'apps/test-drive/app/route.ts',
      ),
    ).toBe(true);
    const bytes = input.files['apps/test-drive/package.json'];
    if (bytes === undefined) throw new Error('Fixture manifest missing.');
    await expect(
      readFile(path.join(output, 'contexts', `${discoveryDigest(bytes)}.txt`), 'utf8'),
    ).resolves.toBe(bytes);
    await expect(discoveryInventory({ ...input, output })).rejects.toThrow(/.+/u);
  });
  it('recomputes the frozen denominator even if an author shrinks and rehashes inventory and publication', async () => {
    const input = await fixture();
    const output = path.join(input.directory, 'output');
    await discoveryInventory({ ...input, output });
    const inventory = await readDiscoveryInventory(output);
    const changed = { ...inventory, candidates: inventory.candidates.slice(1) };
    const altered = { ...changed, sha256: discoveryInventoryDigest(changed) };
    const filename = path.join(output, 'inventory.json');
    const bytes = JSON.stringify(altered);
    await writeFile(filename, bytes);
    const publicationFile = path.join(output, 'publication.json');
    const published: unknown = JSON.parse(await readFile(publicationFile, 'utf8'));
    const parsed = z
      .object({
        inventory_sha256: z.string(),
        artifacts: z.array(z.object({ path: z.string(), sha256: z.string() })),
      })
      .loose()
      .parse(published);
    await writeFile(
      publicationFile,
      JSON.stringify({
        ...parsed,
        inventory_sha256: altered.sha256,
        artifacts: parsed.artifacts.map((artifact) =>
          artifact.path === 'inventory.json'
            ? { ...artifact, sha256: discoveryDigest(bytes) }
            : artifact,
        ),
      }),
    );
    await expect(readDiscoveryInventory(output)).rejects.toThrow('denominator/evidence');
  });
  it.each(['promoted root_name', 'removed implementation'])(
    'rejects rehashed evidence mutation: %s',
    async (mutation) => {
      const input = await fixture();
      const output = path.join(input.directory, 'output');
      await discoveryInventory({ ...input, output });
      const inventory = await readDiscoveryInventory(output);
      const changed = {
        ...inventory,
        candidates: inventory.candidates.map((candidate) => {
          if (mutation === 'promoted root_name' && candidate.root === 'apps/nav') {
            return {
              ...candidate,
              evidence: candidate.evidence.map((evidence) => ({
                ...evidence,
                basis: 'boundary' as const,
              })),
            };
          }
          if (mutation === 'removed implementation' && candidate.root === 'apps/test-drive') {
            return {
              ...candidate,
              evidence: candidate.evidence.filter(
                (evidence) => evidence.basis !== 'implementation',
              ),
            };
          }
          return candidate;
        }),
      };
      await rewriteInventory(output, changed);
      await expect(readDiscoveryInventory(output)).rejects.toThrow('denominator/evidence');
    },
  );
  it('binds a zero-trial capture to an actual pinned canonical context without inventing a scan snapshot', async () => {
    const input = await fixture({}, true);
    const output = path.join(input.directory, 'output');
    await discoveryInventory({ ...input, output });
    const inventory = await readDiscoveryInventory(output);
    expect(inventory.snapshot_sha256).toBe(
      discoveryDigest('Protobuf contracts for offer and order integrations.\n'),
    );
    const inputs = z
      .object({ inputs: z.array(z.object({ kind: z.string() }).loose()) })
      .parse(JSON.parse(await readFile(path.join(output, 'inputs.json'), 'utf8')));
    expect(inputs.inputs.some((item) => item.kind === 'scan_snapshot')).toBe(false);
    expect(inputs.inputs.some((item) => item.kind === 'context_snapshot')).toBe(true);
  });
  it('adding already selected explicit contexts preserves independent manifest and entry bases and inventory identity', async () => {
    const input = await fixture();
    const original = path.join(input.directory, 'original-selection');
    const explicit = path.join(input.directory, 'explicit-selection');
    await discoveryInventory({ ...input, output: original });
    await discoveryInventory({
      ...input,
      output: explicit,
      contextPaths: ['apps/test-drive/package.json', 'apps/test-drive/app/route.ts'],
    });
    const baseline = await readFile(path.join(original, 'inventory.json'), 'utf8');
    await expect(readFile(path.join(explicit, 'inventory.json'), 'utf8')).resolves.toBe(baseline);
    const inventory = parseDiscoveryInventory(JSON.parse(baseline));
    const candidate = inventory.candidates.find((item) => item.root === 'apps/test-drive');
    expect(
      candidate?.evidence.find(
        (item) => item.kind === 'context_snapshot' && item.path === 'apps/test-drive/package.json',
      )?.basis,
    ).toBe('boundary');
    expect(
      candidate?.evidence.find(
        (item) => item.kind === 'context_snapshot' && item.path === 'apps/test-drive/app/route.ts',
      )?.basis,
    ).toBe('entry');
  });
  it('retains oversized entry candidates with an explicit unread frontier', async () => {
    const input = await fixture({ 'apps/test-drive/app/huge/route.ts': 'x'.repeat(262_145) });
    const output = path.join(input.directory, 'output');
    await discoveryInventory({ ...input, output });
    const packetBytes = await readFile(path.join(output, 'packets.json'), 'utf8');
    expect(packetBytes).toContain('Full file exceeds per-context byte bound');
    const inventoryBytes = await readFile(path.join(output, 'inventory.json'), 'utf8');
    expect(inventoryBytes).toContain('apps/test-drive/app/huge/route.ts');
    await expect(
      readFile(path.join(output, 'contexts', `${discoveryDigest('x'.repeat(262_145))}.txt`)),
    ).rejects.toThrow('ENOENT');
  });
  it('rejects changed publication bytes and changed tracked inventory before source reads', async () => {
    const input = await fixture();
    await writeFile(path.join(input.capture, 'repository.json'), '{}');
    await expect(loadDiscoverySource(input.capture, input.cloneRoot)).rejects.toThrow(/.+/u);
    const second = await fixture();
    const filename = path.join(second.capture, 'inventory.json');
    const bytes = await readFile(filename, 'utf8');
    await writeFile(filename, bytes.replace('apps/test-drive', 'apps/hidden'));
    await expect(loadDiscoverySource(second.capture, second.cloneRoot)).rejects.toThrow(
      'inventory hash',
    );
  });
});
