import { expect, it, vi } from 'vitest';

import { indexOf } from '@/application/model-index';
import { readModelFolder } from '@/infrastructure/read-model';

import { citationLineage, handlerEffectLineage } from './fact-lineage';

vi.mock(import('server-only'), () => ({}));

it('traces the exact guarded loop call and pin through its authored position to the native site', async () => {
  const model = await readModelFolder('test/fixtures/model', 'model-fixture');
  const index = indexOf({
    ...model,
    aliases: { ...model.aliases, 'Order line': { to: 'sys:ordering', reason: 'Fixture alias.' } },
  });
  const site = 'h:confirm#lines/reserve';
  const source = index.cites(site)[0];
  const effect = {
    handler: 'h:confirm',
    on: 'api:confirm',
    from: 'svc:ordering',
    to: 'ext:payments',
    kind: 'call',
    target: 'api:charge',
    path: ['steps', 4, 'do', 0],
  };
  const retained = {
    attribution: { [site]: { sources: [source] } },
    plan: {
      handlers: [
        {
          id: 'h:confirm',
          steps: [
            {},
            {},
            {},
            {},
            {
              each: 'Order line',
              do: [
                {
                  when: 'Payment is required',
                  async: false,
                  call: 'api:charge',
                  sources: [source],
                },
              ],
            },
          ],
        },
      ],
    },
    derived: { handlerEdges: [effect] },
  };
  expect(citationLineage(retained, index)[0]).toMatchObject({ nativeId: site, problems: [] });
  expect(handlerEffectLineage(retained, index)[0]).toMatchObject({ nativeId: site, problems: [] });
  const changed = {
    ...retained,
    derived: { handlerEdges: [{ ...effect, to: 'svc:ordering' }] },
  };
  expect(handlerEffectLineage(changed, index)[0]?.problems).toContain(
    'The original effect has no matching native edge.',
  );
  const oldLocation = { repo: 'not-the-source', commit: 'a'.repeat(40), path: 'wrong.ts' };
  expect(
    citationLineage({ attribution: { [site]: { sources: [oldLocation] } } }, index)[0]?.problems,
  ).toContain('Original code location has not been matched.');
});
