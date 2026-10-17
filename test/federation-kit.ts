import { readFileSync } from 'node:fs';
import path from 'node:path';

import { expect } from 'vitest';
import { parse } from 'yaml';

import { buildGraph, systemOf } from '@/application/plan/graph';
import { validatePlan } from '@/application/plan/validate-plan';
import type { Field, Plan, Schema } from '@/domain/plan/plan.generated';

export type Mutate = (p: Plan) => void;

/** The federated shop fixture: a fresh, mutable plan every call. */
export const shop = (): Plan =>
  parse(readFileSync(path.join(process.cwd(), 'test', 'fixtures', 'shop.yaml'), 'utf8')) as Plan;

export function byId<T extends { id: string }>(list: T[] | undefined, id: string): T {
  const found = list?.find((x) => x.id === id);
  if (found === undefined) throw new Error(`no ${id} in the plan`);
  return found;
}

export function field(p: Plan, typeId: string, name: string): Field {
  const found = byId<Schema>(p.schemas, typeId).fields?.find((f) => f.name === name);
  if (found === undefined) throw new Error(`no ${typeId}.${name} in the plan`);
  return found;
}

export const asIsOf = (p: Plan) => buildGraph(systemOf(p));

export const fetchesOf = (plan: {
  readonly fetches: readonly {
    readonly id: string;
    readonly subgraph: string;
    readonly after: readonly string[];
  }[];
}) =>
  plan.fetches.map((f) => {
    const after = f.after.length > 0 ? ` after ${f.after.join(',')}` : '';
    return `${f.id} ${f.subgraph.replace('sg:', '')}${after}`;
  });

export const states = (c: {
  readonly layers: readonly { readonly store: string; readonly state: string }[];
}) => c.layers.map((l) => `${l.store.replace('st:', '')}:${l.state}`);

/** Validate a mutated shop and return its findings as "path: message" lines. */
export function check(mutate?: Mutate) {
  const p = shop();
  mutate?.(p);
  const { errors, warnings } = validatePlan(p);
  return {
    errors: errors.map((e) => `${e.path}: ${e.message}`),
    warnings: warnings.map((w) => `${w.path}: ${w.message}`),
  };
}

export const has = (lines: string[], re: RegExp): boolean => lines.some((l) => re.test(l));

export function expectError(mutate: Mutate, re: RegExp): void {
  const r = check(mutate);
  expect(
    has(r.errors, re),
    `expected an error matching ${String(re)}; got:\n${r.errors.join('\n')}`,
  ).toBe(true);
}

export function expectWarning(mutate: Mutate, re: RegExp): void {
  const r = check(mutate);
  expect(
    has(r.warnings, re),
    `expected a warning matching ${String(re)}; got:\n${r.warnings.join('\n')}`,
  ).toBe(true);
}
