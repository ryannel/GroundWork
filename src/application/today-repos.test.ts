import path from 'node:path';

import { describe, expect, it, vi } from 'vitest';

import { systemScopeOf } from '@/application/model-scope';
import { componentCardsOf } from '@/application/today-components';
import { reposOf } from '@/application/today-repos';
import { systemModelOf } from '@/application/workspace-model';
import type { Scan } from '@/domain/workspace-model';
import { readWorkspaceModel } from '@/infrastructure/workspace-model';
import { readWorkspaces } from '@/infrastructure/workspace-store';

vi.mock('server-only', () => ({}));

const root = path.resolve(import.meta.dirname, '../../workspaces');

async function alder(scans: readonly Scan[] = []) {
  const workspaces = await readWorkspaces(root);
  const workspace = workspaces.find(({ id }) => id === 'alder-finch')!;
  const model = await readWorkspaceModel(workspace, root);
  return { workspace, today: systemModelOf(workspace, { ...model, scans }) };
}

const scan = (scannedAt: string): Scan => ({
  repo: 'alder-finch/pricing',
  branch: 'main',
  head: '7a8b9c0d1e2f',
  scannedAt,
  scanner: 'test',
  files: {},
  facts: 3,
});

describe('how fresh a system reading is', () => {
  it('says a repo has not been scanned', async () => {
    const { workspace, today } = await alder();
    const [row] = reposOf(workspace, today, 'price-engine');
    expect(row).toMatchObject({ repo: 'alder-finch/pricing', scanned: false });
    expect(row?.read).toMatch(/^Not scanned yet/);
    expect(row?.cited).toMatch(/cite/);
  });

  it('gives the commit, branch and day a repo was read', async () => {
    const { workspace, today } = await alder([scan('2025-05-03T10:00:00Z')]);
    const [row] = reposOf(workspace, today, 'price-engine');
    expect(row?.read).toBe('Read at 7a8b9c0 on main, 3 May 2025');
    expect(row?.scanned).toBe(true);
  });

  it('keeps a day it cannot read as written', async () => {
    const { workspace, today } = await alder([scan('soon')]);
    expect(reposOf(workspace, today, 'price-engine')[0]?.read).toBe(
      'Read at 7a8b9c0 on main, soon',
    );
  });
});

describe('component cards', () => {
  it('teaches what each component of a system offers, calls and keeps', async () => {
    const { workspace, today } = await alder();
    const cards = componentCardsOf(today.model, systemScopeOf(workspace, 'price-engine')!);
    const pricing = cards.find((card) => card.chip.id === 'svc:pricing')!;
    expect(pricing.kind).toMatch(/^Service/);
    expect(pricing.offers.map((offer) => offer.chip.id)).toContain('api:pricing-get-price');
    expect(cards.flatMap((card) => card.keeps).length).toBeGreaterThan(0);
  });
});
