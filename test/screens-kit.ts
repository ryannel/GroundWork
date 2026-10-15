import { readFileSync } from 'node:fs';
import path from 'node:path';

import { parse } from 'yaml';

import type { Change, Plan, Screen } from '@/domain/plan/plan.generated';

import { byId } from './federation-kit';

const mini = (): Plan =>
  parse(readFileSync(path.join(process.cwd(), 'test', 'fixtures', 'mini.yaml'), 'utf8')) as Plan;

const account = (): Screen => ({
  id: 'scr:account',
  name: 'Account',
  service: 'svc:web',
  kind: 'page',
  route: '/account',
  device: 'desktop',
  image: 'assets/account.svg',
  regions: [
    {
      id: 'scr:account#plan',
      name: 'Plan',
      shows: 'Status and renewal date.',
      at: { x: 10, y: 10, w: 80, h: 30 },
    },
    {
      id: 'scr:account#cancel',
      name: 'Cancel',
      shows: 'The cancel button.',
      at: { x: 10, y: 50, w: 80, h: 10 },
    },
  ],
});

/**
 * The mini plan with one screen, "Account". The plan changes the Plan region, removes Cancel, adds Pause and, unless
 * `toBeImage` is empty, gives the screen a new picture.
 */
export function accountPlan({ toBeImage = 'assets/account-tobe.svg' } = {}): Plan {
  const plan = mini();
  plan.screens = [account()];
  const ops = [
    ...(toBeImage === '' ? [] : [{ modify: 'scr:account', set: { image: toBeImage } }]),
    {
      add: 'region',
      into: 'scr:account',
      value: {
        id: 'scr:account#pause',
        name: 'Pause',
        shows: 'A pause button.',
        at: { x: 10, y: 62, w: 80, h: 10 },
      },
    },
    { modify: 'scr:account#plan', set: { shows: 'Status, renewal date and a pause badge.' } },
    { remove: 'scr:account#cancel' },
  ];
  byId<Change>(plan.changes, 'chg:pause-api').ops.push(...(ops as unknown as Change['ops']));
  return plan;
}
