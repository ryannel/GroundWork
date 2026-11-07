import { expect, it, vi } from 'vitest';

import { fingerprint } from '@/../tools/migrate-model/review';
import type { AuthoredModel } from '@/domain/workspace-model';

import { applyContractFill, applyHandlerObservation } from './accepted';

vi.mock(import('server-only'), () => ({}));

it('preserves failure IDs and rewrites causes to matched step IDs on first application and retry', async () => {
  const prior: AuthoredModel<'Handler'> = {
    id: 'h:daily',
    component: 'svc:daily',
    on: 'job:daily',
    steps: [
      { id: 'original', cites: ['ev:start'] },
      { id: 'send', cites: ['ev:send'] },
    ],
    failures: [{ id: 'offline', when: 'offline', return: 503, cites: ['ev:fail'] }],
  };
  const observed: AuthoredModel<'Handler'> = {
    id: prior.id,
    component: prior.component,
    on: prior.on,
    steps: [
      { id: 'replacement', cites: ['ev:start'] },
      { id: 'send', causes: 'h:daily#replacement', cites: ['ev:send'] },
    ],
  };
  const review = { before: fingerprint(prior), observed };
  const spans = new Map([
    ['ev:start', '1'],
    ['ev:send', '2'],
  ]);
  const applied = await applyHandlerObservation(prior, prior, review, spans, {});
  expect(applied.ambiguities).toEqual([]);
  expect(applied.handler.steps[1]?.causes).toBe('h:daily#original');
  expect(applied.handler.failures).toEqual(prior.failures);
  const again = await applyHandlerObservation(applied.handler, applied.handler, review, spans, {});
  expect(again.alreadyApplied).toBe(true);
  expect(again.handler).toEqual(applied.handler);
});

it('rejects conflicting schedules and undeclared schema targets before publication', () => {
  const current = { id: 'job:daily', every: '30s' };
  const known = new Set(['ev:proof']);
  const review = {
    before: fingerprint(current),
    values: { cron: '0 1 * * *' },
    cites: ['ev:proof'],
  };
  expect(() => applyContractFill(current.id, current, review, known, new Set())).toThrow(
    /only one schedule/u,
  );
  const entry = { id: 'api:daily' };
  const shape = {
    before: fingerprint(entry),
    values: { request: 'sch:absent' },
    cites: ['ev:proof'],
  };
  expect(() => applyContractFill(entry.id, entry, shape, known, new Set())).toThrow(
    /does not exist/u,
  );
});
