// Synthetic inferred stories and authored flows, never company claims.
import { flowCite, flowFixture } from '@/../test/fixtures/model-current-flow';
import type { ModelSystem, WorkspaceModel } from '@/domain/workspace-model';

export function systemFixture(): WorkspaceModel {
  const model = flowFixture();
  return {
    ...model,
    domains: model.domains.map((domain) => ({
      ...domain,
      systems: domain.systems.map((system): ModelSystem =>
        system.id === 'sys:a'
          ? {
              ...system,
              narratives: {
                format: 2,
                label: 'Inferred',
                authored: '2026-11-01',
                generator: 'fixture',
                basis: 'a'.repeat(64),
                stories: [
                  {
                    id: 'source-story',
                    name: 'An inferred story',
                    summary: 'The original story summary.',
                    confidence: 'low',
                    reasoning: 'Suggested by the cited source.',
                    limitations: ['Execution has not been verified.'],
                    relatedSystems: ['sys:b'],
                    connections: [
                      {
                        from: 'svc:a',
                        to: 'svc:b',
                        label: 'Interpreted collaboration',
                        kind: 'api',
                        cites: [flowCite],
                        backs: ['h:a#read'],
                      },
                    ],
                    stages: [
                      {
                        component: 'svc:a',
                        title: 'First stage',
                        summary: 'The original first paragraph.',
                        supporting: ['svc:b'],
                        cites: [flowCite],
                        backs: ['h:a#read'],
                      },
                      {
                        component: 'svc:b',
                        title: 'Second stage',
                        summary: 'The original second paragraph.',
                        supporting: [],
                        cites: [flowCite],
                      },
                    ],
                  },
                ],
              },
            }
          : system,
      ),
    })),
  };
}
