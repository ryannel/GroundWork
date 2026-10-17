import { describe, expect, it } from 'vitest';

import { acme as acmeKit } from '@/../test/workspace-kit';
import { systemScopeOf } from '@/application/model-scope';
import { componentCardsOf } from '@/application/today-components';
import { reposOf } from '@/application/today-repos';
import { systemModelOf } from '@/application/workspace-model';
import type { Scan } from '@/domain/workspace-model';

function acme(scans: readonly Scan[] = []) {
  const { workspace, model } = acmeKit();
  return { workspace, today: systemModelOf(workspace, { ...model, scans }) };
}

const scan = (scannedAt: string): Scan => ({
  repo: 'acme/products',
  branch: 'main',
  head: '7a8b9c0d1e2f',
  scannedAt,
  scanner: 'test',
  files: {},
  facts: 3,
});

describe('how fresh a system reading is', () => {
  it('says a repo has not been scanned', () => {
    const { workspace, today } = acme();
    const [row] = reposOf(workspace, today, 'products');
    expect(row).toMatchObject({ repo: 'acme/products', scanned: false });
    expect(row?.read).toMatch(/^Not scanned yet/u);
    expect(row?.cited).toMatch(/cite/u);
  });

  it('gives the commit, branch and day a repo was read', () => {
    const { workspace, today } = acme([scan('2025-05-03T10:00:00Z')]);
    const [row] = reposOf(workspace, today, 'products');
    expect(row?.read).toBe('Read at 7a8b9c0 on main, 3 May 2025');
    expect(row?.scanned).toBe(true);
  });

  it('keeps a day it cannot read as written', () => {
    const { workspace, today } = acme([scan('soon')]);
    expect(reposOf(workspace, today, 'products')[0]?.read).toBe('Read at 7a8b9c0 on main, soon');
  });
});

describe('component cards', () => {
  it('teaches what each component of a system offers, calls and keeps', () => {
    const { workspace, today } = acme();
    const cards = componentCardsOf(today.model, systemScopeOf(workspace, 'products')!);
    const products = cards.find((card) => card.chip.id === 'svc:products')!;
    expect(products.kind).toMatch(/^Service/u);
    expect(products.offers.map((offer) => offer.chip.id)).toEqual([
      'api:products-get',
      'api:products-update',
    ]);
    expect(cards.flatMap((card) => card.keeps).length).toBeGreaterThan(0);
  });
});
