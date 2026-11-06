import { mkdtemp, readFile, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { describe, expect, it, vi } from 'vitest';

import { modelRecord } from '@/domain/workspace-model';

import { authoredFiles, writeMigrationFile } from './files';
import { migrationReview } from './review';
import { migrateModel } from './runner';
import { migrateWorkspace } from './workspace';

vi.mock(import('server-only'), () => ({}));

async function bytes(folder: string): Promise<readonly unknown[]> {
  const files = await readdir(folder, { recursive: true, withFileTypes: true });
  return Promise.all(
    files
      .filter((file) => file.isFile())
      .toSorted((a, b) =>
        path.join(a.parentPath, a.name).localeCompare(path.join(b.parentPath, b.name)),
      )
      .map(async (file) => {
        const full = path.join(file.parentPath, file.name);
        return [path.relative(folder, full), await readFile(full, 'utf8')];
      }),
  );
}
function identities(value: unknown): readonly string[] {
  if (Array.isArray(value)) return value.flatMap(identities);
  const node = modelRecord(value);
  if (node === null) return [];
  return [
    ...(typeof node.id === 'string' ? [node.id] : []),
    ...Object.values(node).flatMap(identities),
  ];
}
async function fixture(source: string): Promise<void> {
  const files = {
    'evidence/orders/repository.json': {
      format: 'groundwork-evidence/v1',
      repo: 'example/orders',
      commit: 'a'.repeat(40),
      scannedAt: '2026-11-06T12:00:00Z',
      language: 'typescript',
      trackedFiles: 1,
      selectedFiles: 1,
      passes: ['source'],
    },
    'workspace.yaml': {
      id: 'migration-test',
      name: 'Migration test',
      description: 'Run [[job:each morning]]',
      teams: [],
      actors: [],
    },
    'domains/shop/domain.yaml': { id: 'shop', name: 'Shop' },
    'domains/shop/systems/orders/system.yaml': {
      id: 'orders',
      name: 'Orders',
      repos: ['example/orders'],
      components: [{ id: 'svc:orders', name: 'Orders', type: 'service' }],
    },
    'domains/shop/systems/orders/contracts.yaml': {
      interfaces: [
        {
          id: 'if:orders',
          service: 'svc:orders',
          protocol: 'rest',
          endpoints: [{ id: 'api:order', sig: 'GET /orders' }],
        },
      ],
    },
    'domains/shop/systems/orders/handlers.yaml': {
      handlers: [
        {
          id: 'h:order',
          component: 'svc:orders',
          on: 'api:order',
          sources: [
            {
              repo: 'example/orders',
              path: 'src/orders.ts',
              commit: 'a'.repeat(40),
              lines: [1, 10],
            },
          ],
          steps: [
            {
              return: 'An order',
              does: 'Returns the complete order, including the current delivery address and selected items.',
            },
          ],
        },
        { id: 'h:nightly', component: 'svc:orders', on: 'job:each morning', steps: [] },
      ],
    },
  };
  for (const [file, value] of Object.entries(files)) await writeMigrationFile(source, file, value);
}
describe('migration runner', () => {
  it('validates the selected copy, writes every review file and produces byte-identical outputs', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'groundwork-migrate-'));
    const source = path.join(root, 'original');
    await fixture(source);
    const before = await bytes(source);
    const preview = migrationReview();
    migrateWorkspace(await authoredFiles(source), preview);
    const accepted = [
      preview
        .rows()
        .headlines?.map((row) => ({ ...row, status: 'accepted', say: 'Return the order' })) ?? [],
    ];
    const options = {
      workspace: source,
      accepted,
      out: path.join(root, 'one'),
      report: path.join(root, 'report-one'),
    };
    const first = await migrateModel(options);
    expect(first).toMatchObject({ status: 'ready', problems: [] });
    await expect(
      readFile(path.join(options.out, 'domains/shop/systems/orders/contracts.yaml'), 'utf8'),
    ).resolves.toContain('trigger: each morning');
    await expect(readFile(path.join(options.out, 'aliases.yaml'), 'utf8')).resolves.toContain(
      'job:each morning:',
    );
    await expect(
      readFile(
        path.join(options.out, 'domains/shop/systems/orders/handlers/svc-orders.yaml'),
        'utf8',
      ),
    ).resolves.toContain('say: Return the order');
    const second = await migrateModel({
      ...options,
      out: path.join(root, 'two'),
      report: path.join(root, 'report-two'),
    });
    expect(second).toEqual(first);
    await expect(bytes(options.out)).resolves.toEqual(await bytes(path.join(root, 'two')));
    await expect(bytes(options.report)).resolves.toEqual(
      await bytes(path.join(root, 'report-two')),
    );
    await expect(bytes(source)).resolves.toEqual(before);
    await expect(readdir(options.report)).resolves.toEqual(
      expect.arrayContaining([
        'step-ids.yaml',
        'headlines.yaml',
        'review-edges.yaml',
        'migration.json',
      ]),
    );
  });
});

it('keeps assigned identities when authored file order changes', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'groundwork-migrate-order-'));
  const source = path.join(root, 'source');
  await fixture(source);
  const files = await authoredFiles(source);
  const first = migrateWorkspace(files, migrationReview());
  const second = migrateWorkspace(files.toReversed(), migrationReview());
  const allIds = (workspace: ReturnType<typeof migrateWorkspace>): readonly string[] =>
    [...workspace.files.values()]
      .flatMap((fragment) => identities(fragment.value))
      .toSorted((a, b) => a.localeCompare(b));
  expect(allIds(second)).toEqual(allIds(first));
});
