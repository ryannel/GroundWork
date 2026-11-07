import { describe, expect, it } from 'vitest';

import { flowFixture } from '@/../test/fixtures/model-current-flow';
import { queryModel, systemProviderModel } from '@/../test/fixtures/model-queries';
import { indexOf } from '@/application/model-index';

import { modelReposOf, modelSystemFlowOf, modelSystemViewOf } from './model-system';

describe('native system views', () => {
  it('keeps components, code homes and actual relationships separate from ownership and external providers', () => {
    const model = queryModel();
    const original = JSON.stringify(model);
    const index = indexOf(model);
    const a = modelSystemViewOf(index, { domain: 'queries', system: 'a' });
    const b = modelSystemViewOf(index, { domain: 'dom:queries', system: 'sys:b' });
    expect(a).toMatchObject({
      id: 'sys:a',
      domainId: 'dom:queries',
      name: 'A',
      about: 'Run by the A team',
      facts: ['1 component', '1 repo', '0 authored flows', '1 entry'],
    });
    expect(a?.components[0]).toMatchObject({
      chip: { id: 'svc:a' },
      offers: [{ id: 'api:a' }],
      calls: [{ id: 'api:supplier' }],
      announces: [{ id: 'msg:remote' }],
      keeps: [{ id: 'st:remote' }],
    });
    expect(a?.data).toEqual([]);
    expect(a?.entries.map((entry) => entry.id)).toEqual(['api:a']);
    expect(a?.components.some((card) => card.chip.id === 'ext:supplier')).toBe(false);
    expect(b?.components.map((card) => card.chip.id)).toEqual(['svc:b', 'st:remote', 'top:remote']);
    expect(b?.data[0]).toMatchObject({ head: { id: 'st:remote' }, note: 'Kept by A' });
    expect(b?.entries.map((entry) => entry.id)).toEqual(['sub:b', 'job:b']);
    expect(b?.facts).toContain('2 entries');
    expect(b?.gaps).toContainEqual({
      id: 'top:remote',
      kind: 'no_owner',
      message: 'No cited resource owner is recorded.',
    });
    expect(JSON.stringify(model)).toBe(original);
  });

  it('retains an unmapped system and its real API without manufacturing a component or operator', () => {
    const index = indexOf(systemProviderModel());
    const view = modelSystemViewOf(index, { domain: 'queries', system: 'unmapped' });
    expect(view).toMatchObject({
      id: 'sys:unmapped',
      mapped: false,
      components: [],
      about: 'Team not recorded',
    });
    expect(view?.headline).toContain('Implementation not mapped.');
    expect(view?.entries.map((entry) => entry.id)).toEqual(['api:unmapped-api']);
    expect(view?.catalogue.apis[0]?.head.id).toBe('sys:unmapped');
    expect(view?.gaps).toContainEqual(
      expect.objectContaining({ id: 'api:unmapped-api', kind: 'unmapped_target' }),
    );
    expect(modelSystemViewOf(index, { domain: 'missing', system: 'unmapped' })).toBeNull();
    expect(modelSystemViewOf(index, { domain: 'queries', system: 'missing' })).toBeNull();
  });

  it('shows the actual scan pin and cited record count without inventing remote freshness', () => {
    const base = queryModel();
    const commit = 'a'.repeat(40);
    const index = indexOf({
      ...base,
      evidence: [
        {
          repository: {
            format: 'groundwork-evidence/v2',
            repo: 'fixture/a',
            commit,
            scannedAt: '2026-11-01T00:00:00Z',
            language: 'typescript',
            trackedFiles: 1,
            selectedFiles: 1,
            passes: ['source'],
          },
          records: [],
          discovery: null,
        },
      ],
    });
    expect(modelReposOf(index, 'sys:a')).toEqual([
      {
        repo: 'fixture/a',
        href: 'https://github.com/fixture/a',
        read: `Read at ${commit}, 2026-11-01T00:00:00Z`,
        scanned: true,
        moved: 'Remote branch freshness not recorded',
        cited: '6 records cite code here',
      },
    ]);
    expect(modelReposOf(index, 'sys:b')[0]).toMatchObject({
      repo: 'fixture/b/worker',
      scanned: false,
      read: 'No repository scan pin recorded',
      moved: 'Remote branch freshness not recorded',
    });
  });
  it('groups a system flow by its actual first component and selects only declared touching flows', () => {
    const model = flowFixture();
    const index = indexOf({
      ...model,
      domains: model.domains.map((domain) => ({
        ...domain,
        systems: domain.systems.map((system) =>
          system.id === 'sys:a' ? { ...system, name: 'A system' } : system,
        ),
      })),
    });
    const view = modelSystemViewOf(index, { domain: 'queries', system: 'a' });
    expect(view?.flows[0]?.entry).toBe('A');
    expect(modelSystemFlowOf(index, { domain: 'queries', system: 'a' })?.id).toBe('flow:story');
    expect(modelSystemFlowOf(index, { domain: 'queries', system: 'a' }, 'story')?.id).toBe(
      'flow:story',
    );
    expect(modelSystemFlowOf(index, { domain: 'queries', system: 'a' }, 'invented')).toBeNull();
  });
});
