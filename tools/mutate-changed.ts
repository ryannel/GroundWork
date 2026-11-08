// Whole-file mutation coverage, locally or in balanced CI batches with one weighted score.
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const MUTATED = /^src\/(?:domain|application|shared)\/.+(?<!\.test|\.generated)\.ts$/u;
const COMPLETED = new Set([
  'Killed',
  'Timeout',
  'Survived',
  'NoCoverage',
  'RuntimeError',
  'CompileError',
  'Ignored',
]);
interface Batch {
  readonly index: number;
  readonly files: readonly string[];
}
interface Score {
  readonly detected: number;
  readonly undetected: number;
}
function record(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function strings(value: unknown): readonly string[] {
  if (!Array.isArray(value) || !value.every((item: unknown) => typeof item === 'string')) {
    throw new TypeError('Expected a list of file paths.');
  }
  return value;
}
function git(args: readonly string[]): readonly string[] {
  const result = spawnSync('git', args, { encoding: 'utf8' });
  if (result.status !== 0) {
    throw new Error(
      result.stderr === '' ? 'Could not read the mutation scope from Git.' : result.stderr,
    );
  }
  return result.stdout.split('\n').filter((line) => line !== '');
}
function hasRuntime(file: string): boolean {
  const source = readFileSync(file, 'utf8');
  try {
    const emitted = stripTypeScriptTypes(source);
    return emitted.replaceAll(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/gu, '').trim() !== '';
  } catch {
    // Keep files using syntax that the Node stripper cannot interpret.
    return true;
  }
}
export function mutationTargets(files: readonly string[]): readonly string[] {
  const sources = files.map((file) =>
    file.endsWith('.test.ts') ? `${file.slice(0, -'.test.ts'.length)}.ts` : file,
  );
  return [
    ...new Set(
      sources.filter((file) => MUTATED.test(file) && existsSync(file) && hasRuntime(file)),
    ),
  ].toSorted((left, right) => left.localeCompare(right, 'en'));
}
function changedFiles(base: string | undefined): readonly string[] {
  if (base !== undefined) return git(['diff', '--name-only', '--diff-filter=d', `${base}...HEAD`]);
  return [
    ...git(['diff', '--name-only', '--diff-filter=d', 'HEAD']),
    ...git(['ls-files', '--others', '--exclude-standard']),
  ];
}
export function mutationBatches(files: readonly string[], limit = 20): readonly Batch[] {
  const weighted = files.map((file) => ({
    file,
    lines: readFileSync(file, 'utf8').split('\n').length,
  }));
  weighted.sort((left, right) =>
    right.lines === left.lines
      ? left.file.localeCompare(right.file, 'en')
      : right.lines - left.lines,
  );
  const groups = Array.from({ length: Math.min(files.length, limit) }, (_, index) => ({
    index,
    files: new Array<string>(),
    lines: 0,
  }));
  for (const item of weighted) {
    const group = groups.toSorted((left, right) =>
      left.lines === right.lines ? left.index - right.index : left.lines - right.lines,
    )[0];
    if (group === undefined) throw new Error('A mutation batch must contain a file.');
    group.files.push(item.file);
    group.lines += item.lines;
  }
  return groups.map(({ index, files: members }) => ({
    index,
    files: members.toSorted((left, right) => left.localeCompare(right, 'en')),
  }));
}
function option(args: readonly string[], name: string): string | undefined {
  const at = args.indexOf(name);
  if (at === -1) return undefined;
  const value = args[at + 1];
  if (value === undefined || value.startsWith('--')) throw new Error(`Missing value for ${name}.`);
  return value;
}
async function threshold(): Promise<number> {
  const settings: unknown = await import('../stryker.config.mjs');
  if (!record(settings) || !record(settings.default) || !record(settings.default.thresholds)) {
    throw new Error('Cannot read the configured mutation threshold.');
  }
  const floor = settings.default.thresholds.break;
  if (typeof floor !== 'number' || !Number.isFinite(floor)) {
    throw new TypeError('Invalid mutation threshold.');
  }
  return floor;
}
function sameFiles(value: unknown, expected: readonly string[]): boolean {
  return (
    JSON.stringify(strings(value).toSorted((left, right) => left.localeCompare(right, 'en'))) ===
    JSON.stringify(expected.toSorted((left, right) => left.localeCompare(right, 'en')))
  );
}
function mutantScore(mutants: unknown): Score {
  if (!Array.isArray(mutants)) throw new Error('Missing mutant results.');
  let detected = 0;
  let undetected = 0;
  const ids = new Set<string>();
  for (const mutant of mutants) {
    if (!record(mutant) || typeof mutant.id !== 'string' || typeof mutant.status !== 'string') {
      throw new Error('Invalid mutant result.');
    }
    if (ids.has(mutant.id) || !COMPLETED.has(mutant.status)) {
      throw new Error('Incomplete or duplicated mutant result.');
    }
    ids.add(mutant.id);
    if (mutant.status === 'Killed' || mutant.status === 'Timeout') detected += 1;
    if (mutant.status === 'Survived' || mutant.status === 'NoCoverage') undetected += 1;
  }
  return { detected, undetected };
}
export function mutationReportScore(
  value: unknown,
  expected: readonly string[],
  floor: number,
): Score {
  if (
    !record(value) ||
    value.schemaVersion !== '1.0' ||
    !record(value.config) ||
    !record(value.files)
  ) {
    throw new Error('Missing completed mutation report.');
  }
  if (!sameFiles(value.config.mutate, expected)) {
    throw new Error('Mutation report has a different whole-file scope.');
  }
  if (!record(value.config.thresholds) || value.config.thresholds.break !== floor) {
    throw new Error('Mutation report has a different threshold.');
  }
  let detected = 0;
  let undetected = 0;
  for (const [file, result] of Object.entries(value.files)) {
    if (!expected.includes(file) || !record(result)) {
      throw new Error('Unexpected mutation report file.');
    }
    if (result.source !== readFileSync(file, 'utf8')) {
      throw new Error(`Stale mutation report: ${file}.`);
    }
    const score = mutantScore(result.mutants);
    detected += score.detected;
    undetected += score.undetected;
  }
  // Stryker omits files with no mutants. The completed JSON report's exact config still records their scope.
  return { detected, undetected };
}
export function mutationPassed(scores: readonly Score[], floor: number): boolean {
  const detected = scores.reduce((sum, score) => sum + score.detected, 0);
  const total = detected + scores.reduce((sum, score) => sum + score.undetected, 0);
  const percentage = total === 0 ? 100 : (detected / total) * 100;
  console.log(
    `Mutation score: ${String(detected)}/${String(total)} (${percentage.toFixed(2)}%); required ${String(floor)}%.`,
  );
  return percentage >= floor;
}
export async function aggregate(folder: string, targets: readonly string[]): Promise<void> {
  const batches = mutationBatches(targets);
  const expectedNames = batches
    .map(({ index }) => `mutation-${String(index)}`)
    .toSorted((left, right) => left.localeCompare(right, 'en'));
  const actualNames = readdirSync(folder).toSorted((left, right) =>
    left.localeCompare(right, 'en'),
  );
  if (JSON.stringify(actualNames) !== JSON.stringify(expectedNames)) {
    throw new Error('Missing or unexpected mutation batches.');
  }
  const floor = await threshold();
  const scores = batches.map(({ index, files }) => {
    const value: unknown = JSON.parse(
      readFileSync(path.join(folder, `mutation-${String(index)}`, 'mutation.json'), 'utf8'),
    );
    return mutationReportScore(value, files, floor);
  });
  if (!mutationPassed(scores, floor)) process.exitCode = 1;
}
function runStryker(targets: readonly string[]): void {
  if (targets.length === 0) {
    console.log('Nothing to mutate.');
    return;
  }
  const result = spawnSync(
    process.execPath,
    ['node_modules/@stryker-mutator/core/bin/stryker.js', 'run', '--mutate', targets.join(',')],
    { stdio: 'inherit' },
  );
  process.exitCode = result.status ?? 1;
}
async function main(args: readonly string[]): Promise<void> {
  const base = option(args, '--base');
  const supplied = option(args, '--files-json');
  if (supplied !== undefined) {
    const files = strings(JSON.parse(supplied));
    const targets = mutationTargets(files);
    if (!sameFiles(files, targets)) {
      throw new Error('Batch must name existing whole pure-layer files exactly once.');
    }
    runStryker(targets);
    return;
  }
  const given = args.some((arg) => arg.startsWith('--')) ? [] : args;
  const targets = mutationTargets(given.length > 0 ? given : changedFiles(base));
  const folder = option(args, '--aggregate');
  if (folder !== undefined) await aggregate(folder, targets);
  else if (args.includes('--matrix')) {
    console.log(JSON.stringify({ include: mutationBatches(targets) }));
  } else runStryker(targets);
}
if (
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href
) {
  main(process.argv.slice(2)).catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
