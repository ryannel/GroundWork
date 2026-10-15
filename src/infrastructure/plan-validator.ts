import 'server-only';

import { readFile } from 'node:fs/promises';
import path from 'node:path';

import type { ValidateFunction } from 'ajv';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';

import type { Issue } from '@/application/plan/check-context';
import type { ShapeCheck } from '@/application/plan/check-shape';
import { isRecord, prop } from '@/application/plan/ids';
import { validatePlan } from '@/application/plan/validate-plan';
import type { Fanout } from '@/domain/plan/plan-graph';
import type { Plan } from '@/domain/plan/plan.generated';

import { rewriteErrors, shapeProblems } from './plan-schema-errors';

/** What loading a plan found. `plan` is null when the schema rejected it. */
export interface PlanCheck {
  plan: Plan | null;
  errors: Issue[];
  warnings: Issue[];
}

interface Validators {
  plan: ValidateFunction<Plan>;
  def: <T = unknown>(name: string) => ValidateFunction<T> | undefined;
}

let compiled: Promise<Validators> | undefined;

async function compile(): Promise<Validators> {
  const schema: unknown = JSON.parse(
    await readFile(path.join(process.cwd(), 'schema', 'plan.schema.json'), 'utf8'),
  );
  const id = prop(schema, '$id');
  if (!isRecord(schema) || typeof id !== 'string') throw new Error('plan.schema.json has no $id');
  const ajv = new Ajv2020({ allErrors: true, strict: false, discriminator: true, verbose: true });
  addFormats(ajv);
  ajv.addSchema(schema);
  const plan = ajv.getSchema<Plan>(id);
  if (plan === undefined) throw new Error('plan.schema.json did not compile');
  return { plan, def: <T>(name: string) => ajv.getSchema<T>(`${id}#/$defs/${name}`) };
}

const validators = async (): Promise<Validators> => (compiled ??= compile());

/** Validate parsed plan data against the schema, then (when the shape is right) the cross-references. */
export async function checkPlanData(data: unknown, fanout?: Fanout): Promise<PlanCheck> {
  if (!isRecord(data)) {
    return {
      plan: null,
      errors: [{ path: '(root)', message: 'plan must be a YAML mapping' }],
      warnings: [],
    };
  }
  const { plan: isPlan, def } = await validators();
  if (!isPlan(data)) {
    const errors = rewriteErrors(isPlan.errors ?? [], data, { branchOf: def });
    return { plan: null, errors, warnings: [] };
  }
  const shape: ShapeCheck = (type, entity) => {
    const check = def(type);
    return check === undefined || check(entity) ? [] : shapeProblems(check.errors ?? []);
  };
  return { plan: data, ...validatePlan(data, { fanout, shape }) };
}

/** The schema check for one `$defs` entry (`interface`, `flow`, …), for plan-shaped data kept outside a plan. */
export async function planDef<T>(name: string): Promise<ValidateFunction<T>> {
  const { def } = await validators();
  const check = def<T>(name);
  if (check === undefined) throw new Error(`plan.schema.json has no $defs/${name}`);
  return check;
}

/** Why a value failed a `planDef` check, one readable line per problem. */
export function defProblems(check: ValidateFunction): string[] {
  return shapeProblems(check.errors ?? []).map(
    ({ prop: key, tail, message }) => `${[key, ...tail].join('.')}: ${message}`,
  );
}
