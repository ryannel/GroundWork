import path from 'node:path';

import { describe, expect, it, vi } from 'vitest';

import { keyJourneysOf } from '@/application/key-journeys';
import { domainScopeOf, workspaceScopeOf } from '@/application/model-scope';
import { systemMapOf } from '@/application/system-map';
import { mapMarkdownOf } from '@/application/system-map-md';
import { catalogueOf } from '@/application/today-catalogue';
import { journeysHeadline, todayJourneysOf } from '@/application/today-journeys';
import { mapScopeOf, outsideOf } from '@/application/today-scope';
import { codeEvidenceOf, todayPlaceOf } from '@/application/today-thing';
import { domainViewOf } from '@/application/workspace-domain';
import { roleOf } from '@/application/workspace-landscape';
import { systemModelOf } from '@/application/workspace-model';
import { workspaceNavOf } from '@/application/workspace-nav';
import { systemViewOf } from '@/application/workspace-system';
import { readWorkspaceModel } from '@/infrastructure/workspace-model';
import { readWorkspaces } from '@/infrastructure/workspace-store';

vi.mock('server-only', () => ({}));

const root = path.resolve(import.meta.dirname, '../../workspaces');

async function alder() {
  const workspaces = await readWorkspaces(root);
  const workspace = workspaces.find(({ id }) => id === 'alder-finch')!;
  const today = systemModelOf(workspace, await readWorkspaceModel(workspace, root));
  return { workspace, model: today.model };
}

describe('the rail of a workspace read today', () => {
  it('counts every journey, names the key ones and marks the one being walked', async () => {
    const { workspace, model } = await alder();
    const all = todayJourneysOf(model);
    const first = workspaceNavOf(workspace, [], { today: model, section: 'journeys' });
    const journeys = first.find((group) => group.key === 'journeys')!;
    expect(journeys.count).toBe(String(all.length));
    expect(journeys.items.map((item) => item.title)).toEqual(
      keyJourneysOf(workspace, model).picked.map((k) => k.journey.title),
    );
    const named = new Set(journeys.items.map((item) => item.title));
    const other = all.find((j) => !named.has(j.title))!;
    const nav = workspaceNavOf(workspace, [], {
      today: model,
      section: 'journeys',
      key: other.key,
    });
    const open = nav.find((group) => group.key === 'journeys')!;
    expect(open.current).toBe(true);
    expect(open.items).toHaveLength(journeys.items.length + 1);
    expect(open.items.filter((item) => item.current).map((item) => item.title)).toEqual([
      other.title,
    ]);
  });

  it('lists the kinds of reference and marks the one being read', async () => {
    const { workspace, model } = await alder();
    const nav = workspaceNavOf(workspace, [], {
      today: model,
      section: 'reference',
      key: 'stores',
    });
    const reference = nav.find((group) => group.key === 'reference')!;
    expect(reference.open).toBe(true);
    expect(reference.items.find((item) => item.current)?.href).toBe(
      '/alder-finch/reference/stores/',
    );
  });
});

describe('scopes', () => {
  it('draws the whole landscape and marks neighbours outside a domain', async () => {
    const { workspace } = await alder();
    const whole = workspaceScopeOf(workspace);
    expect(mapScopeOf(workspace, whole).focus).toBeNull();
    expect(outsideOf(whole)).toBeNull();
    const website = domainScopeOf(workspace, 'website')!;
    expect(mapScopeOf(workspace, website).focus).toContain('sys:checkout');
    expect(mapScopeOf(workspace, website).places['sys:pim']).toBe('Commercial backbone');
    expect(outsideOf(website)).toBe('outside this domain, one step away');
    expect(domainScopeOf(workspace, 'nowhere')).toBeNull();
  });

  it('keeps only what the components in a domain own in its catalogue', async () => {
    const { workspace, model } = await alder();
    const all = catalogueOf(model, workspaceScopeOf(workspace));
    const one = catalogueOf(model, domainScopeOf(workspace, 'website')!);
    expect(JSON.stringify(one).length).toBeLessThan(JSON.stringify(all).length);
  });
});

describe('a domain read today', () => {
  it('says what it does and who runs it', async () => {
    const { workspace, model } = await alder();
    const view = domainViewOf(workspace, model, 'order-to-delivery')!;
    expect(JSON.stringify(view)).toMatch(/team/);
    expect(domainViewOf(workspace, model, 'nowhere')).toBeNull();
  });
});

const at = (file: string, lines?: readonly [number, number]) => ({
  repo: 'org/app',
  path: file,
  commit: 'abcdef1234567',
  ...(lines === undefined ? {} : { lines }),
});

describe('the code behind a thing', () => {
  it('lists its own lines first, then its parts, each once', () => {
    const evidence = codeEvidenceOf(
      {
        'api:x#b': { origin: 'extracted', sources: [at('b.ts', [3, 3])] },
        'api:x': { origin: 'curated', sources: [at('x.ts', [1, 9]), at('x.ts', [1, 9])] },
        'api:x#a': { origin: 'seeded', sources: [at('a.ts')] },
        'api:y': { origin: 'seeded', sources: [at('y.ts')] },
      },
      'api:x',
    );
    expect(evidence.map((e) => e.where)).toEqual(['x.ts:1–9', 'a.ts', 'b.ts:3']);
    expect(evidence[0]?.commit).toBe('abcdef1');
  });
});

describe('a system with little written about it', () => {
  it('still says what it is and that no team runs it', async () => {
    const { workspace } = await alder();
    const bare = {
      ...workspace,
      domains: workspace.domains.map((domain) => ({
        ...domain,
        systems: domain.systems.map((system) => ({
          ...system,
          team: null,
          components: system.components.map((component) => ({ ...component, does: null })),
        })),
      })),
    };
    const today = systemModelOf(workspace, await readWorkspaceModel(workspace, root));
    const view = systemViewOf(bare, today, { domain: 'website', system: 'checkout' })!;
    expect(view.about).toMatch(/^No team runs it yet/);
  });
});

describe('the map in words, for a thin workspace', () => {
  it('says what is missing rather than leaving gaps', async () => {
    const { workspace } = await alder();
    const thin = {
      ...workspace,
      domains: workspace.domains.map((domain) => ({
        ...domain,
        purpose: null,
        systems: domain.systems.map((system) => ({
          ...system,
          components: system.components.map((c) => ({ ...c, does: null, tech: null })),
        })),
      })),
    };
    const model = await readWorkspaceModel(workspace, root);
    const scanned = {
      ...model,
      scans: [
        {
          repo: 'alder-finch/pricing',
          branch: 'main',
          head: '7a8b9c0d1e2f',
          scannedAt: '2025-05-03',
          scanner: 'test',
          files: {},
          facts: 1,
        },
      ],
    };
    const md = mapMarkdownOf(systemMapOf(thin, systemModelOf(thin, scanned)));
    expect(md).toMatch(/7a8b9c0/);
    expect(md).toMatch(/not scanned/);
    expect(roleOf(thin.domains[0]!, [])).toBeNull();
  });
});

describe('journeys and places with nothing to hold them', () => {
  it('leaves out user journeys when there are none, and places nothing for a user journey', async () => {
    const { workspace, model } = await alder();
    const flows = todayJourneysOf(model).filter((j) => j.kind !== 'journey');
    expect(journeysHeadline(flows)).toMatch(/^\w+ flows? carry work/);
    expect(todayPlaceOf(workspace, model, 'nothing:here')).toBeNull();
    expect(todayPlaceOf(workspace, model, 'sys:checkout')).not.toBeNull();
  });
});
