import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { appendFile, readFile, writeFile } from 'node:fs/promises';
import { parseArgs } from 'node:util';

import { parse } from 'yaml';

import { allowancesOf, unexplained } from '../../../../tools/rebuild/allowances.ts';
import { differences, readSnapshot } from '../../../../tools/rebuild/snapshots.ts';

const { values } = parseArgs({
  options: {
    current: { type: 'string' },
    previous: { type: 'string' },
    proof: { type: 'string' },
    policy: { type: 'string', default: 'artifacts/rebuild/allowed-diffs.yaml' },
    out: { type: 'string' },
  },
});
for (const key of ['current', 'previous', 'proof', 'out']) {
  assert.ok(values[key], `Missing --${key}`);
}
const text = await readFile(values.policy, 'utf8');
const policy = allowancesOf(parse(text));
const proof = JSON.parse(await readFile(values.proof, 'utf8'));
const additions = [];
const receipts = [];
for (const workspace of ['personal', 'acme', 'volvo-cars']) {
  const captured = JSON.parse(
    await readFile(`${values.current}/${workspace}/comparison.json`, 'utf8'),
  );
  for (const row of unexplained(workspace, captured.changes, policy)) {
    assert.equal(row.path, '/htmlBytes', 'A transport allowance cannot cover changed facts.');
    const match = proof.find((item) => item.workspace === workspace && item.file === row.file);
    assert.ok(
      match?.allDomAndHydratedValuesEqual,
      `${workspace}/${row.file}: missing exact response proof`,
    );
    const base = await readSnapshot(`artifacts/rebuild/baseline/${workspace}`, row.file);
    const previous = await readSnapshot(`${values.previous}/${workspace}`, row.file);
    const current = await readSnapshot(`${values.current}/${workspace}`, row.file);
    for (const key of ['route', 'status', 'type', 'headings', 'links', 'payload']) {
      assert.deepEqual(current[key], previous[key], `${workspace}/${row.file}/${key}`);
    }
    assert.equal(match.previous.bytes, previous.htmlBytes);
    assert.equal(match.current.bytes, current.htmlBytes);
    assert.deepEqual(
      differences(row.file, base, current).find((item) => item.path === row.path),
      row,
    );
    const prior = differences(row.file, base, previous).filter((item) => item.path === row.path);
    assert.deepEqual(
      unexplained(workspace, prior, policy),
      [],
      'Baseline-to-previous transport must already have an exact approved pointer.',
    );
    assert.ok(prior.length <= 1);
    const reason = `Exact saved DOM/Flight proof: ${values.proof} for ${match.route}. Baseline ${base.htmlBytes} bytes to prior ${previous.htmlBytes} is ${prior.length === 0 ? 'identical' : 'an already approved exact pointer'}; prior to current ${current.htmlBytes} changes only ${match.wrapperDeltaBytes} Flight-wrapper bytes and ${match.assetDeltaBytes} asset-name bytes. All model values and array order remain identical; no facts are normalised.`;
    additions.push({ ...row, workspace, reason });
    receipts.push({
      workspace,
      file: row.file,
      route: match.route,
      baselineBytes: base.htmlBytes,
      priorBytes: previous.htmlBytes,
      currentBytes: current.htmlBytes,
      priorApprovedPointers: prior,
      newPointer: row,
      exactResponseProof: values.proof,
    });
  }
}
for (const row of additions) {
  await appendFile(values.policy, `  - ${JSON.stringify(row)}\n`);
}
await writeFile(
  values.out,
  JSON.stringify(
    {
      policyBeforeSha256: createHash('sha256').update(text).digest('hex'),
      addedExactTransportPointers: additions.length,
      receipts,
    },
    null,
    2,
  ) + '\n',
);
console.log({ addedExactTransportPointers: additions.length });
