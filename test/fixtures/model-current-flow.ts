// Synthetic authored narrative and source pins, not company claims.
import { queryModel } from '@/../test/fixtures/model-queries';
import type { ModelCite, WorkspaceModel } from '@/domain/workspace-model';

export const flowCite: Extract<ModelCite, { readonly kind: 'code' }> = {
  kind: 'code',
  repo: 'fixture/a',
  commit: 'a'.repeat(40),
  path: 'flow.ts',
  lines: [2, 9],
};
export function flowFixture(): WorkspaceModel {
  return {
    ...queryModel(),
    actors: [{ id: 'actor:reader', name: 'Reader' }],
    flows: [
      {
        id: 'flow:story',
        name: 'An authored narrative',
        actor: 'actor:reader',
        trigger: 'A precise trigger',
        outcome: 'A precise outcome',
        cites: [flowCite],
        steps: [
          {
            id: 'first',
            from: 'svc:a',
            to: 'svc:b',
            via: 'api:a',
            action: 'First action',
            logic: 'Only when a value is present',
            fails: 'Never reports success after failure',
            reads: ['sch:remote#id'],
            writes: ['sch:remote'],
            purges: ['st:remote'],
            screen: 'scr:known',
            beat: 'Authored beat',
            case: 'miss',
            handler_step: 'h:a#read',
          },
          {
            id: 'second',
            from: 'svc:b',
            to: 'sys:unmapped',
            transport: 'Unspecified transport',
            action: 'Second action',
          },
        ],
      },
    ],
  };
}
