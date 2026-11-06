import { cp, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { beforeAll, describe, expect, it, vi } from 'vitest';

import { entryFlowOf } from '@/application/entry-flow';
import { indexOf } from '@/application/model-index';
import type { ModelSystem, WorkspaceModel } from '@/domain/workspace-model';

import { modelValidator } from './model-schema';
import { readModel } from './read-model';
import { validateModel } from './validate-model';

vi.mock(import('server-only'), () => ({}));

let original: WorkspaceModel;
beforeAll(async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'groundwork-queues-'));
  await cp(path.resolve('test/fixtures/model'), path.join(root, 'model'), { recursive: true });
  const value = await readModel('model-fixture', root);
  if (value === null) throw new Error('Missing fixture');
  original = value;
});

function withQueue(form: 'queue' | 'stream', declared = true): WorkspaceModel {
  const schema: ModelSystem['schemas'][number] = {
    id: 'sch:job',
    kind: 'record',
    store: 'top:jobs',
  };
  return {
    ...original,
    domains: original.domains.map((domain) => ({
      ...domain,
      systems: domain.systems.map((system): ModelSystem => ({
        ...system,
        components: [
          ...system.components,
          ...(declared ? [{ id: 'top:jobs', name: 'Jobs', kind: 'topic' as const, form }] : []),
        ],
        schemas: [...system.schemas, schema],
        handlers: system.handlers.map((handler) =>
          handler.id === 'h:confirm'
            ? {
                ...handler,
                steps: [
                  ...handler.steps,
                  { id: 'read-job', read: 'sch:job', from: 'top:jobs', cites: handler.cites ?? [] },
                  { id: 'write-job', write: 'sch:job', to: 'top:jobs', cites: handler.cites ?? [] },
                ],
              }
            : handler,
        ),
      })),
    })),
  };
}

describe('cited record access to queues', () => {
  it('validates queue targets without changing read/write facts into message delivery', async () => {
    const model = withQueue('queue');
    await expect(validateModel(model)).resolves.toEqual([]);
    const index = indexOf(model);
    expect(index.storeAccess('top:jobs').map((edge) => [edge.kind, edge.via])).toEqual([
      ['read', 'sch:job'],
      ['write', 'sch:job'],
    ]);
    expect(index.edges('top:jobs', { kinds: ['publish', 'consume'] })).toEqual([]);
    const flow = entryFlowOf(index, 'api:confirm');
    expect(JSON.stringify(flow)).toContain('h:confirm#write-job');
    expect(index.get('h:confirm#write-job')?.data.cites).not.toEqual([]);
  });
  it('keeps flow topic exchanges distinct from handler record access', async () => {
    const model: WorkspaceModel = {
      ...original,
      flows: original.flows.map((flow) => ({
        ...flow,
        steps: [
          ...flow.steps,
          {
            id: 'publish-confirmed',
            from: 'svc:ordering',
            to: 'top:confirmed',
            via: 'msg:confirmed',
            action: 'Publishes the order confirmation',
            cites: flow.steps[0]?.cites ?? [],
          },
          {
            id: 'consume-confirmed',
            from: 'top:confirmed',
            to: 'svc:ordering',
            via: 'msg:confirmed',
            action: 'Consumes the order confirmation',
            cites: flow.steps[0]?.cites ?? [],
          },
        ],
      })),
    };
    const before = JSON.stringify(model.flows);
    await expect(validateModel(model)).resolves.toEqual([]);
    const index = indexOf(model);
    expect(index.get('flow:confirm#publish-confirmed')?.data.to).toBe('top:confirmed');
    expect(index.get('flow:confirm#consume-confirmed')?.data.from).toBe('top:confirmed');
    expect(JSON.stringify(model.flows)).toBe(before);
  });
  it.each([
    ['stream', true],
    ['queue', false],
  ] as const)('rejects %s targets (declared: %s)', async (form, declared) => {
    const problems = await validateModel(withQueue(form, declared));
    expect(problems.map((problem) => problem.at)).toEqual([
      'sch:job/store',
      'h:confirm#read-job/from',
      'h:confirm#write-job/to',
    ]);
    expect(problems.every((problem) => problem.message.includes('declared queue'))).toBe(true);
  });
  it('keeps other component prefixes invalid in the authored schema', async () => {
    const check = await modelValidator('workspace', 'Step');
    expect(check({ id: 'write', write: 'sch:job', to: 'svc:ordering', cites: ['ev:source'] })).toBe(
      false,
    );
    expect(check.errors).toContainEqual(
      expect.objectContaining({ instancePath: '/to', keyword: 'pattern' }),
    );
  });
});
