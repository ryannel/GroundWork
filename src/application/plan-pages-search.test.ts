import { describe, expect, it, vi } from 'vitest';

import { acme } from '@/../test/workspace-kit';

import { paletteEntries, searchPalette } from './plan-pages-search';
import { systemModelOf } from './workspace-model';

vi.mock(import('server-only'), () => ({}));

const { workspace, model: read } = acme();
const { model } = systemModelOf(workspace, read);
const entries = paletteEntries(model, []);

describe('the palette', () => {
  it('says which system a thing belongs to', () => {
    const create = entries.find(({ target }) => target === 'api:orders-create');
    expect(create?.hint).toMatch(/ · Ordering$/u);
  });

  it('finds an endpoint by its system, method and path', () => {
    const found = searchPalette(entries, 'ordering post /orders').map(({ target }) => target);
    expect(found).toContain('api:orders-create');
  });
});
