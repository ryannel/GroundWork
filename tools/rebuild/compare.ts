// npm run rebuild:compare -- --before <dir> --workspace <id> [--out <captured comparison>]
import { mkdir, mkdtemp, readFile, realpath } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { parse } from 'yaml';

import { allowancesOf, unexplained } from './allowances';
import { argumentsOf, capture, manifestOf } from './capture';
import { selectedRoutes } from './routes';
import { differences, readSnapshot, writeSnapshot } from './snapshots';

const { values } = argumentsOf();
if (values.workspace === undefined || values.before === undefined) {
  throw new Error('Use --before <dir> --workspace <id>.');
}
const before = manifestOf(await readSnapshot(values.before, 'manifest.json'));
if (values.workspace !== before.workspace) {
  throw new Error('The baseline belongs to another workspace.');
}
const out = values.out ?? (await mkdtemp(path.join(tmpdir(), 'groundwork-compare-')));
await mkdir(out, { recursive: true });
if ((await realpath(out)) === (await realpath(values.before))) {
  throw new Error('A comparison must not overwrite its baseline. Choose another --out directory.');
}
const after = await capture({
  workspace: values.workspace,
  out,
  asOf: before.asOf,
  origin: values.origin,
  routes: [...new Set([...before.routes, ...(await selectedRoutes(values.workspace))])].toSorted(
    (a, b) => a.localeCompare(b),
  ),
});
const changes = differences('selection', before.routes, after.routes);
for (const file of new Set([...before.files, ...after.files])) {
  const was = before.files.includes(file) ? await readSnapshot(values.before, file) : undefined;
  const now = after.files.includes(file) ? await readSnapshot(out, file) : undefined;
  changes.push(...differences(file, was, now));
}
const allowedFile = values.allowed ?? 'artifacts/rebuild/allowed-diffs.yaml';
const allowances = allowancesOf(parse(await readFile(allowedFile, 'utf8')));
const rejected = unexplained(values.workspace, changes, allowances);
await writeSnapshot(out, 'comparison.json', {
  workspace: values.workspace,
  changes,
  unexplained: rejected,
});
console.log(
  `${String(changes.length)} differences; ${String(rejected.length)} unexplained. Report: ${path.join(out, 'comparison.json')}`,
);
if (rejected.length > 0) process.exitCode = 1;
