import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';

import { readSnapshot } from '../../../../tools/rebuild/snapshots.ts';

const result = {};
for (const workspace of ['personal', 'acme', 'volvo-cars']) {
  const previous = `artifacts/rebuild/verification/pr5/comparison-complete/${workspace}`;
  const current = `artifacts/rebuild/verification/pr6/comparison/${workspace}`;
  const before = await readSnapshot(previous, 'manifest.json');
  const after = await readSnapshot(current, 'manifest.json');
  assert.deepEqual(after.routes, before.routes);
  assert.deepEqual(after.files, before.files);
  assert.deepEqual(await readSnapshot(current, 'facts.json.gz'), await readSnapshot(previous, 'facts.json.gz'));
  const transport = [];
  for (const file of after.files.filter((file) => file !== 'facts.json.gz')) {
    const was = await readSnapshot(previous, file);
    const now = await readSnapshot(current, file);
    for (const field of ['route', 'status', 'type', 'headings', 'links', 'payload']) assert.deepEqual(now[field], was[field], `${workspace}/${file}/${field}`);
    if (was.htmlBytes !== now.htmlBytes) transport.push({ file, route: now.route, previous: was.htmlBytes, current: now.htmlBytes });
  }
  result[workspace] = { routes: after.routes.length, allFactsExactlyEqualToPr5: true, allRouteStatusHeadingsLinksAndPayloadEqualToPr5: true, transportDifferences: transport };
}
await writeFile('artifacts/rebuild/verification/pr6/fidelity.json', JSON.stringify(result, null, 2) + '\n');
process.stdout.write(JSON.stringify(Object.fromEntries(Object.entries(result).map(([key, value]) => [key, { routes: value.routes, allFactsEqual: true, transportDifferences: value.transportDifferences.length }]))));
