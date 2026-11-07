import { expect, it } from 'vitest';

import { queryModel } from '@/../test/fixtures/model-queries';
import type { ModelCite, ModelSystem, WorkspaceModel } from '@/domain/workspace-model';

import { indexOf } from './model-index';
import { modelNarrativeProblems } from './model-narratives';

const cites: readonly ModelCite[] = [
  { kind: 'code', repo: 'fixture/a', commit: 'a'.repeat(40), path: 'example.ts', lines: [1, 2] },
];
function model(): WorkspaceModel {
  const source = queryModel();
  return {
    ...source,
    domains: source.domains.map((domain) => ({
      ...domain,
      systems: domain.systems.map((system): ModelSystem =>
        system.id === 'sys:a'
          ? {
              ...system,
              components: [...system.components, { id: 'app:client', name: 'Client', kind: 'app' }],
              narratives: {
                format: 2,
                label: 'Inferred',
                authored: '2026-11-07',
                generator: 'Synthetic fixture',
                basis: 'a'.repeat(64),
                stories: [
                  {
                    id: 'known',
                    name: 'Known interpretation',
                    summary: 'A cited summary',
                    confidence: 'low',
                    reasoning: 'Synthetic example only',
                    limitations: ['Not company evidence'],
                    relatedSystems: ['sys:b'],
                    stages: [
                      {
                        component: 'app:client',
                        title: 'Client context',
                        summary: 'The cited context',
                        supporting: [],
                        backs: ['api:a'],
                        cites,
                      },
                      {
                        component: 'svc:a',
                        title: 'Calls supplier',
                        summary: 'The backed call',
                        supporting: [],
                        backs: ['h:a#call'],
                        cites,
                      },
                    ],
                    connections: [
                      {
                        from: 'svc:a',
                        to: 'ext:supplier',
                        kind: 'api',
                        label: 'Makes the cited request',
                        backs: ['h:a#call'],
                        cites,
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
function declaredSystem(source: WorkspaceModel): ModelSystem {
  const found = source.domains[0]?.systems.find((item) => item.id === 'sys:a');
  if (found === undefined) throw new Error('Synthetic system missing');
  return found;
}
it('accepts only actual current stage references, pinned citations and matching exchange backings', () => {
  const source = model();
  expect(modelNarrativeProblems(indexOf(source), declaredSystem(source))).toEqual([]);
});
it('does not turn the narrative wording or a reversed backing into an execution edge', () => {
  const source = model();
  const current = declaredSystem(source);
  const narratives = current.narratives;
  if (narratives === null) throw new Error('Synthetic narratives missing');
  const story = narratives.stories[0];
  const reversed: ModelSystem = {
    ...current,
    narratives: {
      ...narratives,
      stories: [
        {
          ...story,
          connections: (story.connections ?? []).map((connection) => ({
            ...connection,
            from: connection.to,
            to: connection.from,
          })),
        },
      ],
    },
  };
  expect(
    modelNarrativeProblems(indexOf(source), reversed).some((problem) =>
      problem.message.includes('no matching recorded execution backing'),
    ),
  ).toBe(true);
  expect(
    indexOf(source)
      .edges()
      .some((edge) => edge.from === 'ext:supplier' && edge.to === 'svc:a'),
  ).toBe(false);
});
it('keeps missing backings and unresolved citations visible instead of blessing the interpretation', () => {
  const source = model();
  const current = declaredSystem(source);
  const narratives = current.narratives;
  if (narratives === null) throw new Error('Synthetic narratives missing');
  const story = narratives.stories[0];
  const missing: ModelSystem = {
    ...current,
    narratives: {
      ...narratives,
      stories: [
        {
          ...story,
          stages: [
            {
              ...story.stages[0],
              cites: [{ kind: 'evidence', id: 'ev:missing' }],
              backs: ['h:missing'],
            },
            {
              ...story.stages[1],
              cites: [{ kind: 'evidence', id: 'ev:missing' }],
              backs: ['h:missing'],
            },
          ],
        },
      ],
    },
  };
  const problems = modelNarrativeProblems(indexOf(source), missing);
  expect(problems).toContainEqual(
    expect.objectContaining({
      message: 'The interpretation has no resolvable pinned code citation.',
    }),
  );
  expect(problems).toContainEqual(
    expect.objectContaining({
      reference: 'h:missing',
      message: 'A recorded narrative backing is absent from the current model.',
    }),
  );
});
