import { describe, expect, it } from 'vitest';

import { explorerManifestFixture } from '@/../test/service-explorer-kit';

import { explorerComponentLinks, explorerRepositoryLinks } from './explorer-component-links';

describe('published component navigation', () => {
  const manifest = explorerManifestFixture([]);
  it('links exact and legacy-prefixed identities only when evidence is published', () => {
    expect(explorerComponentLinks(manifest, ['component:fixture', 'missing'])).toEqual({
      'component:fixture': '/acme/explorer/?service=component%3Afixture',
    });
    const service = { ...manifest.services[0]!, id: 'pricing' };
    expect(explorerComponentLinks({ ...manifest, services: [service] }, ['svc:pricing'])).toEqual({
      'svc:pricing': '/acme/explorer/?service=pricing',
    });
    expect(explorerComponentLinks(null, ['svc:pricing'])).toEqual({});
  });
  it('does not choose between ambiguous aliases', () => {
    const service = manifest.services[0]!;
    expect(
      explorerComponentLinks(
        {
          ...manifest,
          services: [
            { ...service, id: 'svc:pricing' },
            { ...service, id: 'pricing' },
          ],
        },
        ['svc:pricing'],
      ),
    ).toEqual({});
  });
  it('connects shared repository folders without asserting a component identity', () => {
    const selected = {
      ...manifest,
      services: [{ ...manifest.services[0]!, repo: 'org/shared', id: 'shared' }],
    };
    expect(
      explorerRepositoryLinks(selected, ['org/shared/apps/checkout', 'org/shared-other']),
    ).toEqual([
      {
        label: 'org/shared/apps/checkout',
        href: '/acme/explorer/?service=shared',
        revision: manifest.services[0]!.commit.slice(0, 8),
      },
    ]);
    expect(explorerRepositoryLinks(null, ['org/shared'])).toEqual([]);
  });
});
