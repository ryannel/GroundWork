import path from 'node:path';

import { describe, expect, it, vi } from 'vitest';

import { findIn, ownedBy, systemMapOf, unscanned } from '@/application/system-map';
import { callersOf, shownIn } from '@/application/system-map-links';
import { mapMarkdownOf } from '@/application/system-map-md';
import { systemModelOf } from '@/application/workspace-model';
import { readWorkspaceModel } from '@/infrastructure/workspace-model';
import { readWorkspaces } from '@/infrastructure/workspace-store';

vi.mock('server-only', () => ({}));

const root = path.resolve(import.meta.dirname, '../../workspaces');

async function alder() {
  const workspaces = await readWorkspaces(root);
  const workspace = workspaces.find(({ id }) => id === 'alder-finch')!;
  const model = await readWorkspaceModel(workspace, root);
  return systemMapOf(workspace, systemModelOf(workspace, model));
}

describe('the system map', () => {
  it('places every fact in its domain, system and component', async () => {
    const map = await alder();
    const price = map.facts.get('api:pricing-get-price')!;
    expect(price).toMatchObject({
      type: 'endpoint',
      domain: 'commercial-backbone',
      system: 'price-engine',
      component: 'svc:pricing',
    });
  });

  it('cites the parent when a fact has no sources of its own', async () => {
    const map = await alder();
    const price = map.facts.get('api:pricing-get-price')!;
    expect(price.sourcesOf).toBe('svc:pricing');
    expect(price.sources[0]?.url).toMatch(/^https:\/\/github\.com\/alder-finch\/pricing\/blob\//);
  });

  it('finds facts by words, best match first', async () => {
    const found = findIn(await alder(), 'pricing graph');
    expect(found[0]?.id).toBe('svc:pricing-graph');
  });

  it('says who calls an endpoint', async () => {
    const map = await alder();
    const shown = shownIn(map, 'api:pricing-get-price')!;
    expect(shown.in.map(({ from }) => from)).toContain('svc:pricing-graph');
    expect(callersOf(map, 'api:pricing-get-price').length).toBeGreaterThanOrEqual(shown.in.length);
    expect(shownIn(map, 'api:nothing')).toBeUndefined();
  });

  it('finds the facts read from a file', async () => {
    const owned = ownedBy(await alder(), 'ProductResolver.kt');
    expect(owned.map(({ id }) => id)).toContain('svc:pricing-graph');
  });

  it('lists repos never scanned', async () => {
    const map = await alder();
    expect(unscanned(map).map(({ repo }) => repo)).toContain('alder-finch/pricing');
  });

  it('writes one line per component in MAP.md', async () => {
    const text = mapMarkdownOf(await alder());
    expect(text).toContain('## Commercial backbone (`commercial-backbone`)');
    expect(text).toContain('- `svc:pricing` Pricing');
  });
});
