import 'server-only';

import type { ValidateFunction } from 'ajv';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { fullFormats } from 'ajv-formats/dist/formats.js';

import type { Issue } from '@/application/plan/check-context';
import type { ShapeCheck } from '@/application/plan/check-shape';
import { isRecord, prop } from '@/application/plan/ids';
import { validatePlan } from '@/application/plan/validate-plan';
import type { Fanout } from '@/domain/plan/plan-graph';
import type { Neighbours } from '@/domain/plan/plan-neighbours';
import type { Plan } from '@/domain/plan/plan.generated';
import { pathIn, readText } from '@/infrastructure/disk';

import { rewriteErrors, shapeProblems } from './plan-schema-errors';

/** What loading a plan found. `plan` is null when the schema rejected it. */
export interface PlanCheck {
  readonly plan: Plan | null;
  readonly errors: readonly Issue[];
  readonly warnings: readonly Issue[];
}

interface Validators {
  readonly plan: ValidateFunction<Plan>;
  readonly def: <T = unknown>(name: string) => ValidateFunction<T> | undefined;
}

let compiled: Promise<Validators> | undefined;

// The full RFC 3986 test is slow, and a workspace names the same links in every plan read onto it, so each answer
// is kept. Bounded so a long-running server does not keep every link it has ever seen.
const URIS = new Map<string, boolean>();
const MAX_URIS = 50_000;

function isUri(text: string): boolean {
  const kept = URIS.get(text);
  if (kept !== undefined) return kept;
  const test = fullFormats.uri;
  const answer = typeof test === 'function' && test(text);
  if (URIS.size >= MAX_URIS) URIS.clear();
  URIS.set(text, answer);
  return answer;
}

async function compile(): Promise<Validators> {
  const schema: unknown = JSON.parse(
    await readText(pathIn(process.cwd(), 'schema', 'plan.schema.json')),
  );
  const id = prop(schema, '$id');
  if (!isRecord(schema) || typeof id !== 'string') throw new Error('plan.schema.json has no $id');
  const ajv = new Ajv2020({ allErrors: true, strict: false, discriminator: true, verbose: true });
  addFormats(ajv);
  ajv.addFormat('uri', isUri);
  ajv.addSchema(schema);
  const plan = ajv.getSchema<Plan>(id);
  if (plan === undefined) throw new Error('plan.schema.json did not compile');
  return { plan, def: <T>(name: string) => ajv.getSchema<T>(`${id}#/$defs/${name}`) };
}

const validators = async (): Promise<Validators> => (compiled ??= compile());

/**
 * Plan data against the schema alone, without the cross-references: how a plan that was checked when it was
 * written is read, so its pages can rely on its shape.
 */
export async function shapePlanData(data: unknown): Promise<PlanCheck> {
  if (!isRecord(data)) {
    return {
      plan: null,
      errors: [{ path: '(root)', message: 'plan must be a YAML mapping' }],
      warnings: [],
    };
  }
  const { plan: isPlan, def } = await validators();
  if (isPlan(data)) return { plan: data, errors: [], warnings: [] };
  const errors = rewriteErrors(isPlan.errors ?? [], data, { branchOf: def });
  return { plan: null, errors, warnings: [] };
}

/**
 * Validate parsed plan data against the schema, then (when the shape is right) the cross-references, resolving
 * what it names in other plans and programmes against `neighbours` when given.
 */
export async function checkPlanData(
  data: unknown,
  fanout?: Fanout,
  neighbours?: Neighbours,
): Promise<PlanCheck> {
  const shaped = await shapePlanData(data);
  if (shaped.plan === null) return shaped;
  const { def } = await validators();
  const shape: ShapeCheck = (type, entity) => {
    const check = def(type);
    return check === undefined || check(entity) ? [] : shapeProblems(check.errors ?? []);
  };
  return { plan: shaped.plan, ...validatePlan(shaped.plan, { fanout, shape, neighbours }) };
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
