import { spawnSync } from 'node:child_process';
import { mkdtemp, mkdir, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { describe, expect, it, vi } from 'vitest';

import { queryKnowledge } from '@/application/knowledge/query-knowledge';
import { type KnowledgeReader, recordIndexes } from '@/domain/knowledge/knowledge-reader';
import { knowledgeValidators } from '@/infrastructure/knowledge/knowledge-format';

import { validateKnowledgeFiles } from './knowledge-validation';
import { contractView } from './runtime-proof-contracts';

vi.mock(import('server-only'), () => ({}));
const DIRECTORY = 'test/fixtures/knowledge/notification';
const PREFIX = 'notification-187bfb5-constraints/';
const parse = await knowledgeValidators();
const bundle = parse.bundle(JSON.parse(await readFile(`${DIRECTORY}/bundle.json`, 'utf8')));
const manifest = parse.snapshot(JSON.parse(await readFile(`${DIRECTORY}/snapshot.json`, 'utf8')));
const records = new Map(bundle.records.map((record) => [record.id, record]));
const reader: KnowledgeReader = {
  snapshot: manifest.id,
  rules: manifest.rules,
  get: (id) => records.get(id),
  select: (field, value) =>
    bundle.records.filter((record) => recordIndexes(record).get(field)?.includes(value) === true),
};
async function query(name: string) {
  const request = parse.request(
    JSON.parse(await readFile(`${DIRECTORY}/${name}.request.json`, 'utf8')),
  );
  const result = parse.response(queryKnowledge(reader, request));
  expect(result.limitsHit).toEqual([]);
  expect(result.exhaustive).toBe(false);
  return result;
}

describe('independently authored canonical scan example', () => {
  it('validates its pinned synthetic source locally through the generic scan workflow', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'groundwork-scan-example-'));
    try {
      await mkdir(path.join(root, 'example'));
      const cloned = spawnSync(
        'git',
        [
          'clone',
          '--quiet',
          `${DIRECTORY}/source.bundle`,
          path.join(root, 'example/notification-api'),
        ],
        { encoding: 'utf8' },
      );
      expect(cloned.status, cloned.stderr).toBe(0);
      await expect(
        validateKnowledgeFiles({
          files: [`${DIRECTORY}/bundle.json`],
          snapshot: `${DIRECTORY}/snapshot.json`,
          sources: root,
        }),
      ).resolves.toMatchObject({
        sourceRangesChecked: 10,
        sourceVerification: 'pinned_local_files',
        records: 84,
      });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
  it('retains declared object policy and literal response constraints structurally', () => {
    expect(records.get(`${PREFIX}shape/request-source`)).toMatchObject({
      additionalProperties: false,
    });
    const error = bundle.records
      .filter((record) => record.kind === 'shape')
      .flatMap((record) => record.fields)
      .find((field) => field.name === 'error');
    expect(error).toMatchObject({ const: 'Text is empty' });
    const contract = records.get(`${PREFIX}contract/inbound`);
    if (contract?.kind !== 'interface_contract') throw new Error('Missing inbound contract');
    const view = contractView(contract, records);
    expect(view).toContain('Additional properties: forbidden');
    expect(view).toContain('const &quot;Text is empty&quot;');
  });
  it('keeps the early return separate from the conditional SDK invocation', async () => {
    const rejected = await query('outcome400');
    const accepted = await query('outcome202');
    expect(rejected.nodes.some((node) => node.record === `${PREFIX}op/send`)).toBe(false);
    expect(accepted.nodes.some((node) => node.record === `${PREFIX}op/send`)).toBe(true);
    expect(
      accepted.edges.some((edge) => edge.assumption?.includes('unresolved dependency') === true),
    ).toBe(true);
  });
  it('shows one actual host and one unresolved outbound boundary', async () => {
    const result = await query('interactions');
    expect(result.edges).toHaveLength(1);
    expect(result.edges[0]).toMatchObject({
      from: `${PREFIX}component`,
      to: `${PREFIX}interaction/send`,
    });
    expect(result.frontiers.some((frontier) => frontier.reason === 'binding_unresolved')).toBe(
      true,
    );
    expect(result.sourceLinks?.length).toBeGreaterThan(0);
  });
  it.each(['trace', 'outgoingContent', 'responseId', 'effects', 'contracts'])(
    'returns a schema-valid bounded %s response',
    async (name) => {
      const result = await query(name);
      expect(result.traversalComplete).toBe(true);
    },
  );
});
