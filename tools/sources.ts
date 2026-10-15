// Is every fact in a workspace's system model attributed to the code that proves it?
//   node tools/sources.ts workspaces/<ws> [--missing] [--check]   report; exits 1 on errors (or unreachable sources)
//   node tools/sources.ts workspaces/<ws> --index [--repo org/name] JSON: each fact with its sources, for scan tools
// A fact is any object with an `id` in a system's system.yaml, contracts.yaml or handlers.yaml, or in flows/ and
// journeys/. Sources on things without an id (handler steps, fields) belong to the fact that holds them.
// A source is { repo, path, lines, commit, symbol? }, as schema/plan.schema.json defines it; a bare `url` is the
// older form, still read and reported as a warning.
// --check asks GitHub (gh api) for each file at its commit and checks the lines are inside it.
import { spawnSync } from 'node:child_process';
import { glob, readFile } from 'node:fs/promises';
import path from 'node:path';

import { parse } from 'yaml';

type Json = Record<string, unknown>;

export interface Located {
  repo: string;
  path: string;
  commit: string;
  lines?: readonly [number, number];
}

export interface Fact {
  id: string;
  file: string;
  origin: string;
  sources: Located[];
  problems: string[];
  stepsWithoutSources: number;
  notes: string[];
}

const COMMIT = /^[0-9a-f]{40}$/;
const HASH_LINES = /^#L(\d+)(?:-L(\d+))?$/;
const GENERATED = new Set(['contracts.yaml', 'handlers.yaml']);
const SIGNIFICANT = ['call', 'publish', 'read', 'write', 'if', 'each', 'parallel', 'retry', 'try'];
const PATTERNS = [
  'domains/*/systems/*/{system,contracts,handlers}.yaml',
  'flows/*.yaml',
  'journeys/*.yaml',
];

function isObject(value: unknown): value is Json {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function linesOf(value: unknown, problems: string[]): readonly [number, number] | undefined {
  const pair = Array.isArray(value) && value.length === 2 ? value.map(Number) : [];
  const [from = 0, to = 0] = pair;
  if (Number.isInteger(from) && Number.isInteger(to) && from >= 1 && from <= to) return [from, to];
  problems.push('lines must be [from, to], counted from 1');
  return undefined;
}

// the older form: a GitHub blob url
function fromUrl(url: string, problems: string[]): Located | undefined {
  if (!URL.canParse(url)) {
    problems.push(`${url} is not a url`);
    return undefined;
  }
  const { hostname, pathname, hash } = new URL(url);
  const [, owner, name, blob, commit = '', ...rest] = pathname.split('/');
  if (hostname !== 'github.com' || blob !== 'blob' || owner === undefined || name === undefined) {
    problems.push(`${url} is not a GitHub file link`);
    return undefined;
  }
  if (!COMMIT.test(commit)) {
    problems.push(`${url} names a branch, not a commit`);
    return undefined;
  }
  const match = HASH_LINES.exec(hash);
  const located: Located = { repo: `${owner}/${name}`, path: rest.join('/'), commit };
  if (match?.[1] !== undefined) located.lines = [Number(match[1]), Number(match[2] ?? match[1])];
  return located;
}

// a source as written, or undefined with the reason added to problems
export function locate(source: unknown, problems: string[]): Located | undefined {
  if (!isObject(source)) {
    problems.push('a source must be { repo, path, lines, commit }');
    return undefined;
  }
  const { repo, path: file, commit, url } = source;
  if (typeof repo !== 'string' || typeof file !== 'string' || typeof commit !== 'string') {
    if (typeof url === 'string') return fromUrl(url, problems);
    problems.push('a source needs repo, path and commit');
    return undefined;
  }
  if (!COMMIT.test(commit)) {
    problems.push(`${repo} ${file}: commit must be a full 40-character sha`);
    return undefined;
  }
  const located = { repo: repo.replace(/^github\.com\//, ''), path: file, commit };
  if (source.lines === undefined) return located;
  const lines = linesOf(source.lines, problems);
  if (lines === undefined) return undefined;
  return { ...located, lines };
}

function noteSources(fact: Fact, value: unknown): void {
  if (!Array.isArray(value)) return;
  for (const source of value) {
    const located = locate(source, fact.problems);
    if (located !== undefined) fact.sources.push(located);
    if (isObject(source) && !('repo' in source))
      fact.notes.push('a source is a bare url; rewrite it as { repo, path, lines, commit }');
    else if (located !== undefined && located.lines === undefined)
      fact.notes.push(
        `${located.path}: cite the lines you read, or [1, <length>] for a whole file`,
      );
  }
}

function isUnanchoredStep(node: Json): boolean {
  const anchored = Array.isArray(node.sources) && node.sources.length > 0;
  return !anchored && SIGNIFICANT.some((key) => key in node);
}

function factOf(node: Json, file: string, owner: Fact | undefined): Fact | undefined {
  if (typeof node.id !== 'string') return owner;
  const fallback = GENERATED.has(path.basename(file)) ? 'extracted' : 'curated';
  const origin = typeof node.origin === 'string' ? node.origin : (owner?.origin ?? fallback);
  return {
    id: node.id,
    file,
    origin,
    sources: [],
    problems: [],
    stepsWithoutSources: 0,
    notes: [],
  };
}

export function factsIn(doc: unknown, file: string): Fact[] {
  const facts: Fact[] = [];
  const visit = (node: unknown, owner?: Fact): void => {
    if (Array.isArray(node)) {
      for (const item of node) visit(item, owner);
      return;
    }
    if (!isObject(node)) return;
    const holder = factOf(node, file, owner);
    if (holder !== undefined && holder !== owner) facts.push(holder);
    else if (holder?.id.startsWith('h:') === true && isUnanchoredStep(node))
      holder.stepsWithoutSources += 1;
    if (holder !== undefined) noteSources(holder, node.sources);
    for (const [key, value] of Object.entries(node)) if (key !== 'sources') visit(value, holder);
  };
  visit(doc);
  return facts;
}

export async function workspaceFacts(workspace: string): Promise<Fact[]> {
  const facts: Fact[] = [];
  const files: string[] = [];
  for await (const file of glob(PATTERNS, { cwd: workspace })) files.push(file);
  for (const file of files.toSorted((a, b) => a.localeCompare(b))) {
    const doc: unknown = parse(await readFile(path.join(workspace, file), 'utf8'));
    facts.push(...factsIn(doc, file));
  }
  return facts;
}

export function findings(fact: Fact): { errors: string[]; warnings: string[] } {
  const errors = fact.problems.map((problem) => `${fact.id}: ${problem}`);
  const warnings: string[] = [];
  if (fact.origin === 'extracted' && fact.sources.length === 0 && fact.problems.length === 0)
    errors.push(`${fact.id}: extracted but cites no code; add sources with tools/permalink.ts`);
  if (fact.origin === 'extracted')
    warnings.push(...fact.notes.map((note) => `${fact.id}: ${note}`));
  if (fact.stepsWithoutSources > 0)
    warnings.push(
      `${fact.id}: ${String(fact.stepsWithoutSources)} call, publish, store or branch step(s) cite no code`,
    );
  return { errors, warnings };
}

function fileLength(source: Located): number | undefined {
  const run = spawnSync(
    'gh',
    [
      'api',
      '-H',
      'Accept: application/vnd.github.raw',
      `repos/${source.repo}/contents/${source.path}?ref=${source.commit}`,
    ],
    { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 },
  );
  return run.status === 0 ? run.stdout.split('\n').length : undefined;
}

function unreachable(facts: readonly Fact[]): string[] {
  const lengths = new Map<string, number | undefined>();
  const out: string[] = [];
  for (const fact of facts)
    for (const source of fact.sources) {
      const key = `${source.repo}@${source.commit}:${source.path}`;
      if (!lengths.has(key)) lengths.set(key, fileLength(source));
      const length = lengths.get(key);
      if (length === undefined) out.push(`${fact.id}: ${key} cannot be read`);
      else if (source.lines !== undefined && source.lines[1] > length)
        out.push(`${fact.id}: ${key} has ${String(length)} lines, not ${String(source.lines[1])}`);
    }
  return out;
}

function report(facts: readonly Fact[], check: boolean): number {
  const attributed = facts.filter((fact) => fact.sources.length > 0).length;
  const seeded = facts.filter(
    (fact) => fact.origin === 'seeded' && fact.sources.length === 0,
  ).length;
  console.log(
    `  ${String(attributed)} of ${String(facts.length)} facts cite code; ${String(seeded)} seeded without sources`,
  );
  let errors = 0;
  for (const fact of facts) {
    const found = findings(fact);
    errors += found.errors.length;
    for (const line of found.errors) console.log(`  error   ${fact.file}  ${line}`);
    for (const line of found.warnings) console.log(`  warning ${fact.file}  ${line}`);
  }
  if (check) {
    const missing = unreachable(facts);
    errors += missing.length;
    for (const line of missing) console.log(`  missing ${line}`);
  }
  console.log(
    errors === 0 ? '  ✓ every extracted fact cites code' : `  ✗ ${String(errors)} error(s)`,
  );
  return errors;
}

async function main(argv: readonly string[]): Promise<void> {
  const workspace = argv.find((arg) => !arg.startsWith('--'));
  if (workspace === undefined) {
    console.error(
      'usage: node tools/sources.ts workspaces/<ws> [--missing] [--check] [--index [--repo org/name]]',
    );
    process.exit(2);
  }
  const facts = await workspaceFacts(path.resolve(workspace));
  if (argv.includes('--index')) {
    const repo = argv[argv.indexOf('--repo') + 1];
    const picked = argv.includes('--repo')
      ? facts.filter((fact) => fact.sources.some((s) => s.repo === repo))
      : facts;
    console.log(JSON.stringify(picked, null, 2));
    return;
  }
  if (argv.includes('--missing')) {
    for (const fact of facts.filter((f) => f.origin === 'extracted' && f.sources.length === 0))
      console.log(`${fact.file}\t${fact.id}`);
    return;
  }
  console.log(workspace);
  if (report(facts, argv.includes('--check')) > 0) process.exit(1);
}

if (process.argv[1] === import.meta.filename) await main(process.argv.slice(2));
