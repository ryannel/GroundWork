import { describe, expect, it } from 'vitest';

import { acme } from '@/../test/workspace-kit';
import type { SystemNarratives } from '@/domain/system-narrative';

import { areaNarratives } from './narratives';

const { workspace, today } = acme();
const system = workspace.domains[0]!.systems[0]!;
const id = system.components[0]!.id;
const narratives: SystemNarratives = {
  label: 'Inferred',
  authored: '2026-10-29',
  generator: 'Test',
  status: 'current',
  stories: [
    {
      id: 'inputs',
      name: 'Inputs',
      summary: 'Prepare inputs.',
      confidence: 'medium',
      reasoning: 'Model evidence.',
      limitations: [],
      stages: [
        {
          component: id,
          title: 'Prepare',
          summary: 'Prepare inputs.',
          supporting: [],
          evidence: [id],
        },
      ],
    },
  ],
};

describe('narrative references', () => {
  it('leaves an unannotated system alone and accepts current resolved stories', () => {
    expect(areaNarratives(system)).toEqual({ stories: [], notice: null });
    expect(areaNarratives({ ...system, narratives }, today.model)).toEqual({
      stories: narratives.stories,
      notice: null,
    });
  });
  it('falls back when evidence changed or is unavailable', () => {
    expect(
      areaNarratives({ ...system, narratives: { ...narratives, status: 'stale' } }, today.model)
        .notice,
    ).toContain('changed');
    expect(areaNarratives({ ...system, narratives }).stories).toEqual([]);
    expect(areaNarratives({ ...system, narratives }).notice).toContain('missing');
    expect(areaNarratives({ ...system, components: [], narratives }, today.model).notice).toContain(
      'missing',
    );
  });
});
