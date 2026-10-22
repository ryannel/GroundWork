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
  checked: null,
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

const checked = (tip: string, behind: number | null): Scan => ({
  ...scan('2025-05-03T10:00:00Z'),
  checked: { at: '2025-05-10T10:00:00Z', tip, behind, folders: {} },
});

describe('how far the code has moved since', () => {
  it('says nothing until someone has checked the remote', () => {
    const { workspace, today } = acme([scan('2025-05-03T10:00:00Z')]);
    expect(reposOf(workspace, today, 'products')[0]?.moved).toBeNull();
  });

  it('counts the commits the branch has moved past the reading', () => {
    const { workspace, today } = acme([checked('99aa88bb', 12)]);
    expect(reposOf(workspace, today, 'products')[0]?.moved).toBe(
      '12 commits behind, checked 10 May 2025',
    );
  });

  it('says up to date when the tip is the commit read', () => {
    const { workspace, today } = acme([checked('7a8b9c0d1e2f', 0)]);
    expect(reposOf(workspace, today, 'products')[0]?.moved).toBe('Up to date, checked 10 May 2025');
  });

  it('says the code moved on when nobody counted how far', () => {
    const { workspace, today } = acme([checked('99aa88bb', null)]);
    expect(reposOf(workspace, today, 'products')[0]?.moved).toMatch(
      /^The code has moved on since/u,
    );
  });
});

// Search holds cmd/products of the products repo, so the facts read from there are Search's.
function shared(scans: readonly Scan[] = []) {
  const { workspace, model } = acmeKit();
  const split = {
    ...workspace,
    domains: workspace.domains.map((domain) => ({
      ...domain,
      systems: domain.systems.map((system) =>
        system.id === 'search'
          ? { ...system, repos: [...system.repos, { repo: 'acme/products', path: 'cmd/products' }] }
          : system,
      ),
    })),
  };
  return { workspace: split, today: systemModelOf(split, { ...model, scans }) };
}

const touching = (folders: Readonly<Record<string, number>>): Scan => ({
  ...checked('99aa88bb', 12),
  checked: { at: '2025-05-10T10:00:00Z', tip: '99aa88bb', behind: 12, folders },
});

function folderMoved(folders: Readonly<Record<string, number>>): string | null | undefined {
  const { workspace, today } = shared([touching(folders)]);
  return reposOf(workspace, today, 'search').find((r) => r.repo.endsWith('cmd/products'))?.moved;
}

describe('a repo that systems share by folder', () => {
  it('gives the folder its own row, and its facts to the system that holds it', () => {
    const { workspace, today } = shared();
    const folder = reposOf(workspace, today, 'search').find((r) => r.repo.endsWith('cmd/products'));
    expect(folder).toMatchObject({
      repo: 'acme/products/cmd/products',
      href: 'https://github.com/acme/products/tree/HEAD/cmd/products',
    });
    expect(folder?.cited).toMatch(/^\d+ facts? cites? its code$/u);
    expect(reposOf(workspace, today, 'products')[0]?.cited).toBe('No fact cites its code yet');
  });

  it('says whether the new commits touch the folder', () => {
    expect(folderMoved({ 'cmd/products': 0 })).toBe(
      'Up to date: none of the 12 commits since touch this folder, checked 10 May 2025',
    );
    expect(folderMoved({ 'cmd/products': 1 })).toBe(
      '1 of the 12 commits since touches this folder, checked 10 May 2025',
    );
    expect(folderMoved({})).toBe('12 commits behind, checked 10 May 2025');
  });
});

describe('component cards', () => {
  it('teaches what each component of a system offers, calls and keeps', () => {
    const { workspace, today } = acme();
    const cards = componentCardsOf(today.model, systemScopeOf(workspace, 'products')!);
    const products = cards.find((card) => card.chip.id === 'svc:products')!;
    expect(products.kind).toMatch(/^Service/u);
    expect(products.offers.map((offer) => offer.id)).toEqual([
      'api:products-get',
      'api:products-update',
    ]);
    expect(cards.flatMap((card) => card.keeps).length).toBeGreaterThan(0);
  });
});
