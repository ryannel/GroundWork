// @vitest-environment happy-dom
import { cp, mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { parse } from 'yaml';

import { domainNavOf } from '@/application/domain-nav';
import { legacyLosses, legacyViewOf } from '@/application/legacy-view';
import { indexOf } from '@/application/model-index';
import { domainViewOf } from '@/application/workspace-domain';
import { apply } from '@/domain/plan-apply';
import { modelValidator } from '@/infrastructure/model-schema';
import { readModel } from '@/infrastructure/read-model';
import { validateModel } from '@/infrastructure/validate-model';

import { DomainOverview, DomainPage } from './index';

vi.mock(import('server-only'), () => ({}));
vi.mock(import('next/navigation'), () => ({ usePathname: () => '/model-fixture/orders/' }));
afterEach(cleanup);

describe('the canonical model through a legacy page', () => {
  it('loads, indexes, applies the fixture plan and renders the existing domain page without losing a field', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'groundwork-legacy-'));
    await cp(path.resolve('test/fixtures/model'), path.join(root, 'model'), { recursive: true });
    const model = await readModel('model-fixture', root);
    if (model === null) throw new Error('Missing fixture');
    const value: unknown = parse(
      await readFile(path.join(root, 'model/plans/confirm/plan.yaml'), 'utf8'),
    );
    const check = await modelValidator('plan', 'document');
    if (!check(value)) throw new Error(JSON.stringify(check.errors));
    const after = apply(
      value.changes.flatMap((change) => change.ops ?? []),
      model,
    );
    await expect(validateModel(after)).resolves.toEqual([]);
    expect(indexOf(after).get('h:confirm#tx/save')?.data.say).toBe('Save the confirmed order');
    const legacy = legacyViewOf(after);
    expect(legacy.losses).toEqual([]);
    expect(legacy.workspace.domains[0]?.systems[0]?.handlers).toEqual(
      after.domains[0]?.systems[0]?.handlers,
    );
    expect(legacy.model.asIs.get('sch:confirm#order-id')).toMatchObject({ name: 'orderId' });
    const view = domainViewOf(legacy.workspace, legacy.model, 'orders');
    if (view === null) throw new Error('Missing domain view');
    render(
      <DomainPage nav={domainNavOf(legacy.workspace, view, { words: 0 })} view={view}>
        <DomainOverview view={view} />
      </DomainPage>,
    );
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Orders');
    expect(screen.getByRole('link', { name: 'Ordering' }).getAttribute('href')).toBe(
      '/model-fixture/orders/ordering',
    );
    expect(screen.getByText('Confirm orders and arrange delivery.')).toBeTruthy();
    expect(legacyLosses(after, { ...legacy.workspace, externals: [] })).toEqual([
      { path: '/externals', message: 'The legacy carrier changed a collection.' },
    ]);
    expect(legacyLosses({ a: { b: true } }, { a: {} })).toEqual([
      { path: '/a/b', message: 'The legacy carrier did not retain this value.' },
    ]);
    expect(legacyLosses({ a: {} }, {})).toEqual([
      { path: '/a', message: 'The legacy carrier did not retain this object.' },
    ]);
  });
});
