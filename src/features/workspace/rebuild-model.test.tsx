// @vitest-environment happy-dom
import { cp, mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { parse } from 'yaml';

import { modelDomainNavOf, modelDomainViewOf } from '@/application/model-domain';
import { indexOf } from '@/application/model-index';
import { apply } from '@/domain/plan-apply';
import { modelValidator } from '@/infrastructure/model-schema';
import { readModel } from '@/infrastructure/read-model';
import { validateModel } from '@/infrastructure/validate-model';

import { DomainOverview, DomainPage } from './index';

vi.mock(import('server-only'), () => ({}));
vi.mock(import('next/navigation'), () => ({ usePathname: () => '/model-fixture/orders/' }));
afterEach(cleanup);

describe('the consolidated model through a domain page', () => {
  it('loads, indexes, applies the fixture plan and renders the domain page with its declared fields', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'groundwork-native-'));
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
    const index = indexOf(after);
    expect(index.get('h:confirm#tx/save')?.data.say).toBe('Save the confirmed order');
    expect(index.get('sch:confirm#order-id')?.data.name).toBe('orderId');
    const view = modelDomainViewOf(index, 'orders');
    if (view === null) throw new Error('Missing domain view');
    render(
      <DomainPage nav={modelDomainNavOf(index, view, 0)} view={view}>
        <DomainOverview view={view} />
      </DomainPage>,
    );
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Orders');
    expect(screen.getByRole('link', { name: 'Ordering' }).getAttribute('href')).toBe(
      '/model-fixture/orders/ordering',
    );
    expect(screen.getByText('Confirm orders and arrange delivery.')).toBeTruthy();
  });
});
