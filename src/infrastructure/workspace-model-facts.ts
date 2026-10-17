import 'server-only';

import type { ValidateFunction } from 'ajv';
import type { z } from 'zod';

import { isRecord } from '@/application/plan/ids';
import type { Source } from '@/domain/plan/plan.generated';
import {
  type Attribution,
  type CodeSource,
  type ComponentDetail,
  type Origin,
  permalinkOf,
} from '@/domain/workspace-model';

import { defProblems, planDef } from './plan-validator';
import {
  anySource,
  type codeSource,
  type componentDetail,
  origin as originSchema,
} from './workspace-model-schema';

/** Reads the facts of the system model, keeping who said each one and where in the code. */
export interface Reading {
  readonly attribution: Readonly<Record<string, Attribution>>;
  readonly in: (file: string) => FileReading;
}

export interface FileReading {
  readonly facts: <T>(def: string, entries: readonly unknown[]) => Promise<T[]>;
  readonly fact: <T>(def: string, raw: unknown) => Promise<T>;
  readonly detail: (raw: z.output<typeof componentDetail>) => ComponentDetail;
}

type Attribute = (id: string, attribution: Attribution) => void;

export function readingOf(): Reading {
  const attribution: Record<string, Attribution> = {};
  const seen = new Set<string>();
  const claim = (id: string, where: string): void => {
    if (seen.has(id)) throw new Error(`${where} is defined twice in the system model`);
    seen.add(id);
  };
  const attribute: Attribute = (id, said) => {
    attribution[id] = said;
  };
  const inFile = (file: string): FileReading => {
    const fact = async <T>(def: string, raw: unknown): Promise<T> => {
      const { id, origin, fact: plain } = unwrap(raw, file);
      claim(id, `${file}: ${id}`);
      const value = attributed(plain, { origin, where: `${file}: ${id}`, attribute });
      attribution[id] ??= { origin, sources: [] };
      return checked<T>(def, value, `${file}: ${id}`);
    };
    return {
      fact,
      facts: async <T>(def: string, entries: readonly unknown[]): Promise<T[]> =>
        Promise.all(entries.map(async (raw) => fact<T>(def, raw))),
      detail: (raw) => {
        claim(raw.id, `${file}: ${raw.id}`);
        return detailOf(raw, attribute);
      },
    };
  };
  return { attribution, in: inFile };
}

function unwrap(
  raw: unknown,
  file: string,
): { readonly id: string; readonly origin: Origin; readonly fact: unknown } {
  if (!isRecord(raw) || typeof raw.id !== 'string') throw new Error(`${file}: an entry has no id`);
  const { origin: said, ...fact } = raw;
  const origin = originSchema.safeParse(said);
  if (!origin.success) {
    throw new Error(`${file}: ${raw.id}: origin must be extracted, seeded or curated`);
  }
  return { id: raw.id, origin: origin.data, fact };
}

async function checked<T>(def: string, value: unknown, where: string): Promise<T> {
  const check: ValidateFunction<T> = await planDef<T>(def);
  if (!check(value)) throw new Error(`${where}:\n${defProblems(check).join('\n')}`);
  return value;
}

function detailOf(raw: z.output<typeof componentDetail>, attribute: Attribute): ComponentDetail {
  const { id, origin, kind, summary, sources } = raw;
  const cited = citedOf(sources ?? []);
  attribute(id, { origin, sources: cited.code });
  return {
    id,
    ...(kind === undefined ? {} : { kind }),
    ...(summary === undefined ? {} : { summary }),
    ...(sources === undefined ? {} : { sources: cited.plan }),
  };
}

interface Walk {
  readonly origin: Origin;
  readonly where: string;
  readonly attribute: Attribute;
}

function attributed(value: unknown, walk: Walk): unknown {
  if (Array.isArray(value)) return value.map((child) => attributed(child, walk));
  if (!isRecord(value)) return value;
  const out: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(value)) {
    out[key] = key === 'sources' ? cite(child, value.id, walk) : attributed(child, walk);
  }
  return out;
}

function cite(raw: unknown, id: unknown, walk: Walk): readonly Source[] {
  const parsed = anySource.array().safeParse(raw);
  if (!parsed.success) {
    throw new Error(
      `${walk.where}: sources must be {repo, path, commit, lines?, symbol?} or {url}: ${parsed.error.message}`,
    );
  }
  const { code, plan } = citedOf(parsed.data);
  if (typeof id === 'string') walk.attribute(id, { origin: walk.origin, sources: code });
  return plan;
}

// Code sources are kept for attribution and drawn as permalinks; a bare link is drawn as it is.
function citedOf(sources: readonly z.output<typeof anySource>[]): {
  readonly code: readonly CodeSource[];
  readonly plan: readonly Source[];
} {
  const code: CodeSource[] = [];
  const plan: Source[] = [];
  for (const source of sources) {
    if ('url' in source) {
      const { url, label, note } = source;
      plan.push({
        url,
        ...(label === undefined ? {} : { label }),
        ...(note === undefined ? {} : { note }),
      });
    } else {
      const kept = codeSourceOf(source);
      code.push(kept);
      plan.push(planSourceOf(kept));
    }
  }
  return { code, plan };
}

function codeSourceOf(raw: z.output<typeof codeSource>): CodeSource {
  const { repo, path, commit, lines, symbol, label, note } = raw;
  return {
    repo,
    path,
    commit,
    ...(lines === undefined ? {} : { lines }),
    ...(symbol === undefined ? {} : { symbol }),
    ...(label === undefined ? {} : { label }),
    ...(note === undefined ? {} : { note }),
  };
}

function planSourceOf(source: CodeSource): Source {
  const label = source.label ?? source.symbol;
  return {
    url: permalinkOf(source),
    ...(label === undefined ? {} : { label }),
    ...(source.note === undefined ? {} : { note: source.note }),
  };
}
