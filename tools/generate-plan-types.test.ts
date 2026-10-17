import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { expect, it } from 'vitest';

import { generatePlanTypes } from './generate-plan-types';

it('the committed plan types are what the schema generates (run `npm run generate`)', async () => {
  const committed = await readFile(
    path.resolve(import.meta.dirname, '../src/domain/plan/plan.generated.ts'),
    'utf8',
  );
  await expect(generatePlanTypes()).resolves.toBe(committed);
});
