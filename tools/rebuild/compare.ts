// npm run rebuild:compare -- --before <dir> --workspace <id> [--out <captured comparison>] [--candidate <completed capture>]
import { mkdir, mkdtemp, readFile, realpath } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { parse } from 'yaml';

import { judge, kilobytes, PAGE_BYTE_LIMIT, type PageSize } from '@/../tools/page-budget-rules';

import { allowancesOf, unexplained } from './allowances';
import { argumentsOf, capture, manifestOf } from './capture';
import { factChecksums } from './model-facts';
import { capturedPageSize } from './route-response';
import { selectedRoutes } from './routes';
import { differences, digest, readSnapshot, writeSnapshot } from './snapshots';

const { values } = argumentsOf();
if (values.workspace === undefined || values.before === undefined) {
  throw new Error('Use --before <dir> --workspace <id>.');
}
const before = manifestOf(await readSnapshot(values.before, 'manifest.json'));
if (values.workspace !== before.workspace) {
  throw new Error('The baseline belongs to another workspace.');
}
const out =
  values.out ?? values.candidate ?? (await mkdtemp(path.join(tmpdir(), 'groundwork-compare-')));
await mkdir(out, { recursive: true });
if ((await realpath(out)) === (await realpath(values.before))) {
  throw new Error('A comparison must not overwrite its baseline. Choose another --out directory.');
}
const candidate = values.candidate ?? out;
if (
  values.candidate !== undefined &&
  (await realpath(candidate)) === (await realpath(values.before))
) {
  throw new Error('The candidate must be a separate completed capture.');
}
const after =
  values.candidate === undefined
    ? await capture({
        workspace: values.workspace,
        out,
        asOf: before.asOf,
        origin: values.origin,
        factFolder: values.facts,
        routes: [
          ...new Set([...before.routes, ...(await selectedRoutes(values.workspace))]),
        ].toSorted((a, b) => a.localeCompare(b)),
      })
    : manifestOf(await readSnapshot(candidate, 'manifest.json'));
if (after.workspace !== before.workspace || after.asOf !== before.asOf) {
  throw new Error('The candidate does not match the frozen workspace and date.');
}
const afterRoutes = new Set(after.routes);
if (before.routes.some((route) => !afterRoutes.has(route))) {
  throw new Error('The candidate is missing a frozen route.');
}
const facts = 'facts.json.gz';
const afterFacts = await readSnapshot(candidate, facts);
const checksums = factChecksums(afterFacts);
const expectedFiles = new Set([
  facts,
  ...checksums.keys(),
  ...after.routes.map((route) => `route-${digest(route).slice(0, 20)}.json.gz`),
]);
if (
  expectedFiles.size !== after.files.length ||
  after.files.some((file) => !expectedFiles.has(file))
) {
  throw new Error('The candidate manifest does not cover every fact shard and route.');
}
const pages: PageSize[] = [];
const changes = differences('selection', before.routes, after.routes);
for (const file of new Set([...before.files, ...after.files])) {
  const was = before.files.includes(file) ? await readSnapshot(values.before, file) : undefined;
  const shard = after.files.includes(file) && file !== facts;
  const currentValue = shard ? await readSnapshot(candidate, file, checksums.get(file)) : undefined;
  const now = file === facts ? afterFacts : currentValue;
  changes.push(...differences(file, was, now));
  if (file.startsWith('route-') && after.files.includes(file)) {
    const page = capturedPageSize(now);
    if (page !== null) pages.push(page);
  }
}
const allowedFile = values.allowed ?? 'artifacts/rebuild/allowed-diffs.yaml';
const allowances = allowancesOf(parse(await readFile(allowedFile, 'utf8')));
const rejected = unexplained(values.workspace, changes, allowances);
const pageBudget = judge(pages, PAGE_BYTE_LIMIT, 10);
await writeSnapshot(out, 'comparison.json', {
  workspace: values.workspace,
  changes,
  unexplained: rejected,
  pageBudget,
});
console.log(
  `${String(changes.length)} differences; ${String(rejected.length)} unexplained. Report: ${path.join(out, 'comparison.json')}`,
);
for (const page of pageBudget.over) {
  console.error(`Page budget exceeded: ${page.page} (${kilobytes(page.bytes)}).`);
}
if (rejected.length > 0 || pageBudget.over.length > 0) process.exitCode = 1;
