import { describe, expect, it } from 'vitest';

import { explorerManifestFixture } from '@/../test/service-explorer-kit';

import { explorerLocation, explorerSearch, serviceExplorerHref } from './explorer-location';

describe('published explorer addresses', () => {
  const manifest = explorerManifestFixture([
    { file: 'flow.json', bytes: 0, sha256: 'a'.repeat(64) },
    { file: 'data.json', bytes: 0, sha256: 'b'.repeat(64) },
  ]);
  it('round trips service, frame and selected evidence without losing punctuation', () => {
    const place = { component: 'component:fixture', file: 'data.json', selected: 'field:#id' };
    expect(explorerLocation(manifest, explorerSearch(place))).toEqual(place);
    expect(serviceExplorerHref('acme', place.component)).toBe(
      '/acme/explorer/?service=component%3Afixture',
    );
  });
  it('returns stale or foreign selections to a published overview', () => {
    expect(explorerLocation(manifest, '?service=missing&page=../private&node=field')).toEqual({
      component: 'component:fixture',
      file: 'flow.json',
      selected: null,
    });
    expect(explorerLocation(manifest, '?service=missing&page=data.json').file).toBe('flow.json');
    expect(explorerLocation({ ...manifest, services: [] }, '')).toEqual({
      component: '',
      file: '',
      selected: null,
    });
  });
});
