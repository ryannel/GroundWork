import 'server-only';

import { parse } from 'yaml';

import type { Plan } from '@/domain/plan/plan.generated';
import { pathIn, readText } from '@/infrastructure/disk';

import { checkPlanData } from './plan-validator';

/** Parse a plan file under test/fixtures into a fresh, schema-checked plan the caller may mutate. */
export async function loadFixture(name: string): Promise<Plan> {
  const text = await readText(pathIn(process.cwd(), 'test', 'fixtures', name));
  const { plan, errors } = await checkPlanData(parse(text));
  if (plan === null) throw new Error(`fixture ${name} fails its schema: ${JSON.stringify(errors)}`);
  return plan;
}
