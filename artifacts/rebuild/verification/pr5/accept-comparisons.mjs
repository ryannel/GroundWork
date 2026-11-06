// Re-evaluate the unchanged comparator against exact recorded production captures after documenting allowances.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';

import { parse } from 'yaml';

import { allowancesOf, unexplained } from '../../../../tools/rebuild/allowances.ts';
import { manifestOf } from '../../../../tools/rebuild/capture.ts';
import { differences, readSnapshot } from '../../../../tools/rebuild/snapshots.ts';

const proof = 'artifacts/rebuild/verification/pr5';
const freeze = JSON.parse(await readFile(`${proof}/source-freeze.json`, 'utf8'));
for (const [file, expected] of Object.entries(freeze.files)) assert.equal(createHash('sha256').update(await readFile(file)).digest('hex'), expected, `Changed frozen source: ${file}`);
const policyText = await readFile('artifacts/rebuild/allowed-diffs.yaml', 'utf8');
const policy = allowancesOf(parse(policyText));
const results = {};
for (const workspace of ['personal', 'acme', 'volvo-cars']) {
  const baseline = `artifacts/rebuild/baseline/${workspace}`;
  const current = `${proof}/comparison-complete/${workspace}`;
  const before = manifestOf(await readSnapshot(baseline, 'manifest.json'));
  const after = manifestOf(await readSnapshot(current, 'manifest.json'));
  const captured = await readSnapshot(current, 'comparison.json.gz');
  const changes = differences('selection', before.routes, after.routes);
  for (const file of new Set([...before.files, ...after.files])) {
    const was = before.files.includes(file) ? await readSnapshot(baseline, file) : undefined;
    const now = after.files.includes(file) ? await readSnapshot(current, file) : undefined;
    changes.push(...differences(file, was, now));
  }
  assert.deepEqual(changes, captured.changes, `${workspace}: capture changed`);
  const rejected = unexplained(workspace, changes, policy);
  assert.deepEqual(rejected, [], `${workspace}: unexplained differences`);
  results[workspace] = { routes: after.routes.length, differences: changes.length, unexplained: rejected.length, exactCapturedChangesRecomputed: true };
  console.log(`${workspace}: ${changes.length} exact differences; ${rejected.length} unexplained.`);
}
await writeFile(`${proof}/comparison-acceptance.json`, `${JSON.stringify({ sourceFrozen: true, allowedDiffsSha256: createHash('sha256').update(policyText).digest('hex'), comparatorUnchanged: true, results }, null, 2)}\n`);
