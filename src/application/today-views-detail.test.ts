import { describe, expect, it } from 'vitest';

import { acme as acmeKit } from '@/../test/workspace-kit';
import { systemMapOf } from '@/application/system-map';
import { mapMarkdownOf } from '@/application/system-map-md';
import { journeysHeadline, todayJourneysOf } from '@/application/today-journeys';
import { codeEvidenceOf, todayPlaceOf } from '@/application/today-thing';
import { roleOf } from '@/application/workspace-landscape';
import { systemModelOf } from '@/application/workspace-model';
import { systemViewOf } from '@/application/workspace-system';

function acme() {
  const { workspace, today } = acmeKit();
  return { workspace, model: today.model };
}

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
  it('still says what it is and that no team runs it', () => {
    const { workspace, model } = acmeKit();
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
    const today = systemModelOf(workspace, model);
    const view = systemViewOf(bare, today, { domain: 'storefront', system: 'shop' })!;
    expect(view.about).toMatch(/^No team runs it yet/u);
    expect(view.about).toMatch(/Storefront/u);
  });
});

describe('the map in words, for a thin workspace', () => {
  it('says what is missing rather than leaving gaps', () => {
    const { workspace, model } = acmeKit();
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
    const scanned = {
      ...model,
      scans: [
        {
          repo: 'acme/products',
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
    expect(md).toMatch(/7a8b9c0/u);
    expect(md).toMatch(/not scanned/u);
    expect(md).not.toMatch(/9a8b7c6/u);
    expect(roleOf(thin.domains[0]!, [])).toBeNull();
  });
});

describe('journeys and places with nothing to hold them', () => {
  it('leaves out user journeys when there are none, and places nothing for a user journey', () => {
    const { workspace, model } = acme();
    const flows = todayJourneysOf(model).filter((j) => j.kind !== 'journey');
    expect(journeysHeadline(flows)).toMatch(/^\w+ flows? carry work/u);
    expect(todayPlaceOf(workspace, model, 'nothing:here')).toBeNull();
    expect(todayPlaceOf(workspace, model, 'sys:shop')).not.toBeNull();
  });
});
