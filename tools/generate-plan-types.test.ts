import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { expect, it } from 'vitest';

import { generateModelTypes, generatePlanTypes } from './generate-plan-types';

it('the committed plan types are what the schema generates (run `npm run generate`)', async () => {
  const committed = await readFile(
    path.resolve(import.meta.dirname, '../src/domain/plan/plan.generated.ts'),
    'utf8',
  );
  await expect(generatePlanTypes()).resolves.toBe(committed);
});

it('every committed model contract is generated from the canonical schemas', async () => {
  const contracts = await generateModelTypes();
  expect(contracts.map((contract) => contract.file)).toEqual([
    'src/domain/model/workspace.generated.ts',
    'src/domain/model/plan.generated.ts',
    'src/domain/model/evidence.generated.ts',
    'src/domain/model/citations.generated.ts',
    'src/domain/model/contracts.generated.ts',
  ]);
  for (const contract of contracts) {
    await expect(
      readFile(path.resolve(import.meta.dirname, '..', contract.file), 'utf8'),
    ).resolves.toBe(contract.source);
  }
});
