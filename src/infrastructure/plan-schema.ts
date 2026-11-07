import 'server-only';

import type { ValidateFunction } from 'ajv';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { fullFormats } from 'ajv-formats/dist/formats.js';

import { isRecord, prop } from '@/application/plan/ids';
import { pathIn, readText } from '@/infrastructure/disk';

interface Validators {
  readonly root: <T>() => ValidateFunction<T>;
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
    await readText(pathIn(process.cwd(), 'schema', 'legacy-plan.schema.json')),
  );
  const id = prop(schema, '$id');
  if (!isRecord(schema) || typeof id !== 'string') {
    throw new Error('legacy-plan.schema.json has no $id');
  }
  const ajv = new Ajv2020({ allErrors: true, strict: false, discriminator: true, verbose: true });
  addFormats(ajv);
  ajv.addFormat('uri', isUri);
  ajv.addSchema(schema);
  return {
    root: <T>() => {
      const check = ajv.getSchema<T>(id);
      if (check === undefined) throw new Error('legacy-plan.schema.json did not compile');
      return check;
    },
    def: <T>(name: string) => ajv.getSchema<T>(`${id}#/$defs/${name}`),
  };
}

export const planSchema = async (): Promise<Validators> => (compiled ??= compile());

/** The schema check for one `$defs` entry (`interface`, `flow`, …), for plan-shaped data kept outside a plan. */
export async function planDef<T>(name: string): Promise<ValidateFunction<T>> {
  const { def } = await planSchema();
  const check = def<T>(name);
  if (check === undefined) throw new Error(`legacy-plan.schema.json has no $defs/${name}`);
  return check;
}
