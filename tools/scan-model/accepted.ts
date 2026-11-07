import { readFile } from 'node:fs/promises';

import { parse } from 'yaml';

import { fingerprint } from '@/../tools/migrate-model/review';
import { hasPrefix } from '@/domain/ids';
import { modelList, modelRecord, modelText, type AuthoredModel } from '@/domain/workspace-model';
import { modelValidator } from '@/infrastructure/model-schema';

import { reconcileSteps, type StepMatch } from './steps';

const ENTRY_FIELDS: ReadonlySet<string> = new Set(['request', 'response']);
const SCHEDULE_FIELDS: ReadonlySet<string> = new Set(['every', 'cron', 'trigger']);

type Handler = AuthoredModel<'Handler'>;
type Alias = AuthoredModel<'Alias'>;

interface AcceptedHandler {
  readonly before: string;
  readonly observed: Handler;
}

interface AcceptedContract {
  readonly before: string;
  readonly values: Readonly<Record<string, string>>;
  readonly cites: readonly string[];
}

interface AcceptedScan {
  readonly handlers: ReadonlyMap<string, AcceptedHandler>;
  readonly contracts: ReadonlyMap<string, AcceptedContract>;
}

function keyed<Value>(rows: readonly (readonly [string, Value])[]): ReadonlyMap<string, Value> {
  const records = new Map(rows);
  if (records.size !== rows.length) throw new Error('Duplicate accepted scan targets.');
  return records;
}

function inputRow(value: unknown) {
  const row = modelRecord(value);
  const before = modelText(row?.before);
  if (row === null || before === null || !/^[a-f\d]{64}$/u.test(before)) {
    throw new Error('Accepted scan rows need the SHA-256 of the reviewed current record.');
  }
  return { row, before };
}

function contractField(id: string, field: string, value: unknown): readonly [string, string] {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`${id}: ${field} needs a value.`);
  }
  const allowed = hasPrefix(id, 'api')
    ? ENTRY_FIELDS.has(field) && hasPrefix(value, 'sch')
    : hasPrefix(id, 'job') && SCHEDULE_FIELDS.has(field);
  if (!allowed) throw new Error(`${id}: unsupported contract fill ${field}.`);
  return [field, value];
}

function readContract(value: unknown): readonly [string, AcceptedContract] {
  const { row, before } = inputRow(value);
  const id = modelText(row.id);
  const values = modelRecord(row.values);
  const cites = modelList(row.cites).filter((cite) => hasPrefix(cite, 'ev'));
  if (id === null || values === null || Object.keys(values).length === 0) {
    throw new Error('An accepted contract fill needs a target and values.');
  }
  if (cites.length === 0 || cites.length !== modelList(row.cites).length) {
    throw new Error('An accepted contract fill needs persisted evidence.');
  }
  const fields = Object.entries(values).map(([field, item]) => contractField(id, field, item));
  return [id, { before, values: Object.fromEntries(fields), cites }];
}

export async function acceptedScan(
  file: string | undefined,
  repo: string,
  commit: string,
): Promise<AcceptedScan> {
  if (file === undefined) return { handlers: new Map(), contracts: new Map() };
  const document = modelRecord(parse(await readFile(file, 'utf8')));
  if (document?.repo !== repo || document.commit !== commit) {
    throw new Error('The accepted scan review belongs to another repository or commit.');
  }
  const checkHandler = await modelValidator('workspace', 'Handler');
  const handlers = modelList(document.handlers).map((value): readonly [string, AcceptedHandler] => {
    const { row, before } = inputRow(value);
    const observed = row.observed;
    if (row.complete !== true || !checkHandler(observed)) {
      throw new Error('An accepted handler needs complete coverage and a valid observed handler.');
    }
    return [observed.id, { before, observed }];
  });
  return {
    handlers: keyed(handlers),
    contracts: keyed(modelList(document.contracts).map(readContract)),
  };
}

function expectCurrent(id: string, current: unknown, before: string): void {
  if (fingerprint(current) !== before) throw new Error(`${id}: accepted scan review is stale.`);
}

function rewriteCauses(value: unknown, replacements: ReadonlyMap<string, string>): unknown {
  if (Array.isArray(value)) {
    return modelList(value).map((entry) => rewriteCauses(entry, replacements));
  }
  const node = modelRecord(value);
  if (node === null) return value;
  return Object.fromEntries(
    Object.entries(node).map(([key, item]) => [
      key,
      key === 'causes' && typeof item === 'string'
        ? (replacements.get(item) ?? item)
        : rewriteCauses(item, replacements),
    ]),
  );
}

interface AppliedHandler extends StepMatch {
  readonly handler: Handler;
  readonly alreadyApplied: boolean;
}

export async function applyHandlerObservation(
  original: unknown,
  refreshed: unknown,
  row: AcceptedHandler,
  sourceSpans: ReadonlyMap<string, string>,
  aliases: Readonly<Record<string, Alias | undefined>>,
): Promise<AppliedHandler> {
  const id = row.observed.id;
  const check = await modelValidator('workspace', 'Handler');
  if (!check(refreshed)) throw new Error(`${id}: invalid current handler.`);
  if (refreshed.component !== row.observed.component || refreshed.on !== row.observed.on) {
    throw new Error(`${id}: a handler refresh cannot change its component or entry.`);
  }
  if (
    row.observed.failures !== undefined &&
    fingerprint(row.observed.failures) !== fingerprint(refreshed.failures)
  ) {
    throw new Error(`${id}: a step observation cannot change existing failure records.`);
  }
  const reconciliation = reconcileSteps({
    handler: id,
    prior: refreshed.steps,
    observed: row.observed.steps,
    span: (step) => {
      const anchored = new Set(
        (step.cites ?? []).flatMap((cite) => {
          const span = sourceSpans.get(cite);
          return span === undefined ? [] : [span];
        }),
      );
      return anchored.size === 1 ? (anchored.values().next().value ?? null) : null;
    },
    aliases,
  });
  const handler = rewriteCauses(
    {
      ...row.observed,
      ...(refreshed.failures === undefined ? {} : { failures: refreshed.failures }),
      steps: reconciliation.steps,
    },
    reconciliation.replacements ?? new Map(),
  );
  if (!check(handler)) throw new Error(`${id}: invalid reconciled handler.`);
  const alreadyApplied =
    fingerprint(original) === fingerprint(handler) &&
    reconciliation.ambiguities.length === 0 &&
    Object.keys(reconciliation.retired).length === 0;
  if (!alreadyApplied) expectCurrent(id, original, row.before);
  return { ...reconciliation, handler, alreadyApplied };
}

export function applyContractFill(
  id: string,
  current: Readonly<Record<string, unknown>>,
  row: AcceptedContract,
  knownEvidence: ReadonlySet<string>,
  knownSchemas: ReadonlySet<string>,
): Readonly<Record<string, string>> {
  if (row.cites.some((cite) => !knownEvidence.has(cite))) {
    throw new Error(`${id}: contract fill has unverified evidence.`);
  }
  const fields = Object.entries(row.values);
  for (const [field, value] of fields) {
    if (ENTRY_FIELDS.has(field) && !knownSchemas.has(value)) {
      throw new Error(`${id}: schema ${value} does not exist in the current workspace.`);
    }
  }
  const same = fields.every(([field, value]) => current[field] === value);
  if (same && row.cites.every((cite) => modelList(current.cites).includes(cite))) return {};
  expectCurrent(id, current, row.before);
  const timing = [...SCHEDULE_FIELDS].filter(
    (field) => current[field] !== undefined || Object.hasOwn(row.values, field),
  );
  if (timing.length > 1) throw new Error(`${id}: a job can declare only one schedule or trigger.`);
  for (const [field] of fields) {
    if (current[field] !== undefined) {
      throw new Error(`${id}: contract fill would overwrite ${field}.`);
    }
  }
  return row.values;
}
