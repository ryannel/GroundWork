import { describe, expect, it, vi } from 'vitest';

import { systemProviderModel } from '@/../test/fixtures/model-queries';
import { indexOf } from '@/application/model-index';

import { modelValidator } from './model-schema';
import { validateModel } from './validate-model';

vi.mock(import('server-only'), () => ({}));

const base = {
  id: 'if:boundary',
  kind: 'rest',
  entries: [{ id: 'api:boundary', method: 'GET', path: '/known' }],
  cites: [`client:Client.ts@${'a'.repeat(40)}#L1-2`],
};

describe('known APIs of unmapped systems', () => {
  it('requires exactly one explicit provider at the same interface boundary', async () => {
    const check = await modelValidator('workspace', 'Interface');
    expect(check({ ...base, system: 'sys:unknown' })).toBe(true);
    expect(check({ ...base, component: 'svc:known' })).toBe(true);
    expect(check({ ...base, external: 'ext:known' })).toBe(true);
    expect(check(base)).toBe(false);
    expect(check({ ...base, component: 'sys:unknown' })).toBe(false);
    expect(check({ ...base, system: 'svc:known' })).toBe(false);
    expect(check({ ...base, system: 'sys:unknown', component: 'svc:known' })).toBe(false);
    expect(check({ ...base, system: 'sys:unknown', external: 'ext:known' })).toBe(false);
    expect(
      check({ ...base, system: 'sys:unknown', external: 'ext:known', component: 'svc:known' }),
    ).toBe(false);
  });
  it.each(['rest', 'graphql', 'grpc', 'sdk'])(
    'accepts the explicit provider for %s interfaces',
    async (kind) => {
      const check = await modelValidator('workspace', 'Interface');
      expect(check({ id: 'if:boundary', kind, system: 'sys:unknown', entries: [] })).toBe(true);
    },
  );
  it('accepts the cited declaration without claiming an implementation', async () => {
    await expect(validateModel(systemProviderModel())).resolves.toEqual([]);
  });
  it.each(['sys:missing', 'sys:a'])(
    'rejects a missing or mapped provider: %s',
    async (provider) => {
      const problems = await validateModel(systemProviderModel(provider));
      expect(problems).toEqual([
        {
          at: 'if:unmapped-api/system',
          message:
            'A system-level interface provider must reference a declared unmapped system (mapped: false).',
        },
      ]);
    },
  );
  it('rejects an explicitly mapped system and an alias to another entity kind', async () => {
    const model = systemProviderModel();
    const mapped = {
      ...model,
      domains: model.domains.map((domain) => ({
        ...domain,
        systems: domain.systems.map((system) =>
          system.id === 'sys:unmapped' ? { ...system, mapped: true } : system,
        ),
      })),
    };
    const wrongKind = {
      ...systemProviderModel('sys:pretend'),
      aliases: { 'sys:pretend': { to: 'svc:a' } },
    };
    const mappedProblems = await validateModel(mapped);
    const wrongKindProblems = await validateModel(wrongKind);
    expect(mappedProblems.map((problem) => problem.at)).toEqual(['if:unmapped-api/system']);
    expect(wrongKindProblems.map((problem) => problem.at)).toEqual(['if:unmapped-api/system']);
  });
  it('keeps current-effect evidence strict', async () => {
    const model = systemProviderModel();
    const uncited = {
      ...model,
      domains: model.domains.map((domain) => ({
        ...domain,
        systems: domain.systems.map((system) => ({
          ...system,
          handlers: system.handlers.map((handler) => ({
            ...handler,
            steps: handler.steps.map((step) =>
              step.id === 'call-unmapped' ? { ...step, cites: [] } : step,
            ),
          })),
        })),
      })),
    };
    const check = await modelValidator('workspace', 'Step');
    expect(check({ id: 'call', call: 'api:unmapped-api' })).toBe(false);
    expect(check({ id: 'call', call: 'api:unmapped-api', cites: [] })).toBe(false);
    expect(check({ id: 'call', call: 'api:unmapped-api', cites: base.cites })).toBe(true);
    expect(indexOf(uncited).gaps('h:a#call-unmapped')).toContainEqual(
      expect.objectContaining({ kind: 'no_cites' }),
    );
  });
});
