// Recheck recorded captures with the unchanged comparator; never refetch a route or alter a baseline.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import { gzipSync } from 'node:zlib';

import { parse } from 'yaml';

import { allowancesOf, unexplained } from '../../../../tools/rebuild/allowances.ts';
import { differences, readSnapshot } from '../../../../tools/rebuild/snapshots.ts';

const { values } = parseArgs({ options: { capture: { type: 'string', default: 'artifacts/rebuild/verification/pr6/comparison' }, freeze: { type: 'string', default: 'artifacts/rebuild/verification/pr6/source-freeze.json' }, out: { type: 'string', default: 'artifacts/rebuild/verification/pr6/comparison-acceptance.json' } } });
const frozen = JSON.parse(await readFile(values.freeze, 'utf8'));
for (const [file, expected] of Object.entries(frozen.files)) assert.equal(createHash('sha256').update(await readFile(file)).digest('hex'), expected, `Changed frozen source: ${file}`);
const policyText = await readFile('artifacts/rebuild/allowed-diffs.yaml', 'utf8');
const policy = allowancesOf(parse(policyText));
const results = {};
for (const workspace of ['personal', 'acme', 'volvo-cars']) {
  const base = `artifacts/rebuild/baseline/${workspace}`;
  const current = `${values.capture}/${workspace}`;
  const before = await readSnapshot(base, 'manifest.json');
  const after = await readSnapshot(current, 'manifest.json');
  let captured;
  try { captured = await readSnapshot(current, 'comparison.json'); }
  catch (error) {
    if (error.code !== 'ENOENT') { throw error; }
    captured = await readSnapshot(current, 'comparison.json.gz');
  }
  const changes = differences('selection', before.routes, after.routes);
  for (const file of new Set([...before.files, ...after.files])) {
    changes.push(...differences(file, before.files.includes(file) ? await readSnapshot(base, file) : undefined, after.files.includes(file) ? await readSnapshot(current, file) : undefined));
  }
  assert.deepEqual(changes, captured.changes);
  const rejected = unexplained(workspace, changes, policy);
  assert.deepEqual(rejected, [], `${workspace}: unexplained differences`);
  results[workspace] = { routes: after.routes.length, differences: changes.length, unexplained: 0, exactCapturedChangesRecomputed: true };
  await writeFile(`${current}/comparison.json.gz`, gzipSync(JSON.stringify(captured, null, 2) + '\n'));
}
await writeFile(values.out, JSON.stringify({ sourceFrozen: true, comparatorUnchanged: true, allowedDiffsSha256: createHash('sha256').update(policyText).digest('hex'), results }, null, 2) + '\n');
process.stdout.write(JSON.stringify(results));
