import 'server-only';

import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { parse } from 'yaml';

import type { Plan } from '@/domain/plan/plan.generated';

import { checkPlanData } from './plan-validator';

/** Parse a plan file under test/fixtures into a fresh, schema-checked plan the caller may mutate. */
export async function loadFixture(name: string): Promise<Plan> {
  const text = await readFile(path.join(process.cwd(), 'test', 'fixtures', name), 'utf8');
  const { plan, errors } = await checkPlanData(parse(text));
  if (plan === null) throw new Error(`fixture ${name} fails its schema: ${JSON.stringify(errors)}`);
  return plan;
}
