import type { Model } from '@/application/plan/derive';
import { changedLinksWithoutTest } from '@/application/plan-viz-contracts';
import { teamOf } from '@/application/plan-viz-teams';
import { countOf } from '@/application/plan-viz-text';
import type { Test } from '@/domain/plan/plan.generated';

// The test levels, where tests run, the gaps a change can have, and the counts the pyramid and the matrix share.

const LEVEL_WORD: Readonly<Record<string, string>> = {
  unit: 'unit',
  service: 'service',
  contract: 'contract',
  integration: 'integration',
  e2e: 'end-to-end',
};

export const LEVEL_MEANS: Readonly<Record<string, string>> = {
  unit: 'one function or class, nothing outside it',
  service: 'one service running, its neighbours faked',
  contract: 'one service’s expectations of another, checked against the other’s build',
  integration: 'several real services or stores together',
  e2e: 'a whole flow, on a real environment',
};

export const levelWord = (level: string): string => LEVEL_WORD[level] ?? level;

const ENV_ORDER = ['local', 'ci', 'staging', 'prod'];

const ENV_MEANS: Readonly<Record<string, string>> = {
  local: 'on a laptop',
  ci: 'automatically on every code change',
  staging: 'on the staging environment',
  prod: 'in production',
};

export const envMeans = (env: string): string => ENV_MEANS[env] ?? env;

/** The environments a change's tests run on, in the order code travels. */
export const envsInOrder = (envs: readonly string[]): string[] =>
  envs.toSorted((a, b) => ENV_ORDER.indexOf(a) - ENV_ORDER.indexOf(b));

export const GAP: Readonly<Record<string, { readonly word: string; readonly means: string }>> = {
  untested: { word: 'untested', means: 'no test proves this change' },
  'unit-only': {
    word: 'unit tests only',
    means: 'only unit tests; nothing checks it across a service boundary',
  },
  'no-e2e': {
    word: 'no end-to-end',
    means: 'no end-to-end test: fine for internal changes, a gap for anything a user sees',
  },
};

/** A planned test is hollow, never a tick: nothing has run, and a tick would read as "passing". */
export const PLANNED = '○';

/** "runs in every build", "runs on staging · prod". */
export function runsLine(envs: readonly string[]): string {
  if (envs.length === 1 && envs[0] === 'ci') return 'runs in every build';
  return `runs on ${envs.map((e) => (e === 'ci' ? 'every build' : e)).join(' · ')}`;
}

/** What a test is, in words: the name for a button, its hover line and its accessible name. */
export interface TestInfo {
  readonly id: string;
  readonly name: string;
  readonly level: string;
  readonly tip: string;
  readonly label: string;
}

function where(env: string | undefined): string {
  return env === undefined ? '' : ` · ${runsLine([env])}`;
}

export function testInfo(model: Model, id: string): TestInfo {
  const test = (model.plan.tests ?? []).find((t) => t.id === id);
  const level = test === undefined ? '' : levelWord(test.level);
  const name = test === undefined ? id : model.label(id);
  const kind = level === '' ? '' : `${level} `;
  return {
    id,
    name,
    level,
    tip: `Planned ${kind}test (no result yet) · ${name} · ${id}${where(test?.env)}`,
    label: `planned ${kind}test: ${name}`,
  };
}

export interface LevelStats {
  readonly levels: readonly string[];
  readonly rows: ReturnType<Model['coverage']>['rows'];
  readonly tests: readonly Test[];
  /** The changes shown. */
  readonly m: number;
  readonly by: Readonly<Record<string, { readonly tests: number; readonly changes: number }>>;
}

/**
 * What every surface counts, once: the changes shown (the lens narrows them), the tests over them, and per level how many
 * tests there are and how many of the shown changes have one.
 */
export function levelStats(model: Model, lens?: string): LevelStats {
  const cov = model.coverage();
  const cut = lens === undefined ? null : model.teamCut(lens);
  const rows = cut === null ? cov.rows : cov.rows.filter((r) => cut.changes.includes(r.change));
  const all = model.plan.tests ?? [];
  const tests = cut === null ? all : all.filter((t) => cut.tests.includes(t.id));
  const by = Object.fromEntries(
    cov.levels.map((l) => [
      l,
      {
        tests: tests.filter((t) => t.level === l).length,
        changes: rows.filter((r) => (r.byLevel[l] ?? []).length > 0).length,
      },
    ]),
  );
  return { levels: cov.levels, rows, tests, m: rows.length, by };
}

/** The new or re-routed links no contract test covers, the lens keeping those with an end in the team. */
function linksNeedingContract(model: Model, lens?: string) {
  const all = changedLinksWithoutTest(model);
  if (lens === undefined) return all;
  return all.filter((p) => [p.consumer, p.provider].some((s) => teamOf(model, s) === lens));
}

export interface GapNote {
  readonly level: string;
  readonly count: number;
  readonly text: string;
}

/** The gap noted beside a level of the pyramid. */
export function gapNotes(model: Model, st: LevelStats, lens?: string): GapNote[] {
  const out: GapNote[] = [];
  const noE2e = st.m - (st.by.e2e?.changes ?? 0);
  if (noE2e > 0) {
    out.push({
      level: 'e2e',
      count: noE2e,
      text: `no end-to-end test for ${countOf(noE2e, 'change')}`,
    });
  }
  const links = linksNeedingContract(model, lens).length;
  if (links > 0) {
    out.push({
      level: 'contract',
      count: links,
      text: `${countOf(links, 'new link')} without a contract test`,
    });
  }
  const unitOnly = st.rows.filter((r) => r.gaps.includes('unit-only')).length;
  if (unitOnly > 0) {
    out.push({
      level: 'unit',
      count: unitOnly,
      text: `${countOf(unitOnly, 'change')} ${unitOnly === 1 ? 'has' : 'have'} unit tests only`,
    });
  }
  return out;
}

export interface Pyramid {
  readonly level: string;
  readonly word: string;
  readonly means: string;
  readonly tests: number;
  readonly changes: number;
  /** Bar width, 8–100 per cent of the widest; 0 when there are no tests. */
  readonly width: number;
  readonly note: GapNote | null;
}

/** The pyramid, end-to-end on top: one row per level with its bar and the note beside it. */
export function pyramidRows(model: Model, st: LevelStats, lens?: string): Pyramid[] {
  const max = Math.max(1, ...Object.values(st.by).map((x) => x.tests));
  const notes = gapNotes(model, st, lens);
  return st.levels.toReversed().map((level) => {
    const { tests, changes } = st.by[level] ?? { tests: 0, changes: 0 };
    return {
      level,
      word: levelWord(level),
      means: LEVEL_MEANS[level] ?? '',
      tests,
      changes,
      width: tests === 0 ? 0 : Math.max(8, Math.round((tests / max) * 100)),
      note: notes.find((n) => n.level === level) ?? null,
    };
  });
}

/** The pyramid as it is drawn: the changes shown, the tests over them, and the rows. */
export interface PyramidView {
  readonly changes: number;
  readonly tests: number;
  readonly rows: readonly Pyramid[];
}

/** The pyramid for everyone, or for one team. */
export function pyramidView(model: Model, lens?: string): PyramidView {
  const st = levelStats(model, lens);
  return { changes: st.m, tests: st.tests.length, rows: pyramidRows(model, st, lens) };
}

export interface Unrun {
  readonly test: string;
  readonly change: string;
}

/** The tests that name a change they never run a step of: coverage that reads better than it is. */
export function provesWithoutWalking(model: Model, lens?: string): readonly Unrun[] {
  const cut = lens === undefined ? null : model.teamCut(lens);
  const all = model.coverage().gaps.provesWithoutWalking;
  return cut === null ? all : all.filter((g) => cut.changes.includes(g.change));
}
