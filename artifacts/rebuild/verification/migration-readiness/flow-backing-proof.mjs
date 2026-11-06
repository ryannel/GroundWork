import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import { gunzipSync } from 'node:zlib';

import { rootId } from '../../../../src/domain/ids.ts';
import { convertCitations, migrationCitations } from '../../../../tools/migrate-model/citations.ts';
import { authoredFiles } from '../../../../tools/migrate-model/files.ts';
import { migrationReview } from '../../../../tools/migrate-model/review.ts';

const { values } = parseArgs({ options: { workspace: { type: 'string' } } });
assert.ok(values.workspace);
const folder = '.workspaces/rebuild/migration-backing';
const before = JSON.parse(gunzipSync(await readFile(`${folder}/before.json.gz`)));
const after = JSON.parse(gunzipSync(await readFile(`${folder}/after.json.gz`)));
const flowSources = new Map();
function gather(value, file, at = '') {
  if (value === null || typeof value !== 'object') return;
  if (typeof value.id === 'string' && Array.isArray(value.cites)) {
    flowSources.set(value.id, { file, at, cites: value.cites });
  }
  for (const [key, item] of Object.entries(value)) gather(item, file, `${at}/${key}`);
}
const citations = migrationCitations([], migrationReview(), 'proof');
for (const file of await authoredFiles(values.workspace)) {
  if (file.path.startsWith('flows/')) gather(convertCitations(file.value, citations), file.path);
}
const changes = [];
function compare(was, now, file, at = '', owner = null) {
  if (JSON.stringify(was) === JSON.stringify(now)) return;
  assert.equal(typeof was, typeof now, `${file}${at}: type`);
  assert.ok(was !== null && now !== null, `${file}${at}: null`);
  assert.deepEqual(
    Object.keys(was).filter((key) => key !== 'cites'),
    Object.keys(now).filter((key) => key !== 'cites'),
    `${file}${at}: keys`,
  );
  for (const key of new Set([...Object.keys(was), ...Object.keys(now)])) {
    const previous = key === 'cites' ? (was[key] ?? []) : was[key];
    const current = now[key];
    if (JSON.stringify(previous) === JSON.stringify(current)) continue;
    if (key !== 'cites') {
      assert.equal(typeof previous, 'object', `${file}${at}/${key}: value`);
      compare(previous, current, file, `${at}/${key}`, now);
      continue;
    }
    assert.ok(Array.isArray(previous) && Array.isArray(current));
    assert.deepEqual(
      current.filter((cite) => previous.includes(cite)),
      previous,
    );
    const backs = now.backs ?? owner?.backs;
    assert.ok(Array.isArray(backs), `${file}${at}: missing backing`);
    const added = current.filter((cite) => !previous.includes(cite));
    const receipts = added.map((cite) => {
      assert.match(cite, /@[a-f0-9]{40}#L\d+/u);
      const sources = backs.flatMap((back) => {
        const source = flowSources.get(back) ?? flowSources.get(rootId(back));
        return source?.cites.includes(cite)
          ? [{ backing: back, file: source.file, at: source.at }]
          : [];
      });
      assert.ok(sources.length > 0, `${file}${at}: cite not in recorded flow backing: ${cite}`);
      return { cite, sources };
    });
    changes.push({ file, at: `${at}/cites`, previousCount: previous.length, added: receipts });
  }
}
assert.deepEqual(Object.keys(before), Object.keys(after));
for (const file of Object.keys(before)) compare(before[file], after[file], file);
const result = {
  fragments: Object.keys(before).length,
  changedFragments: new Set(changes.map((row) => row.file)).size,
  changedCitationLocations: changes.length,
  additions: changes.reduce((total, row) => total + row.added.length, 0),
  distinctAddedCitations: new Set(changes.flatMap((row) => row.added.map((item) => item.cite)))
    .size,
  allOtherValuesExactlyEqual: true,
  priorCitationsAndRelativeOrderUnchanged: true,
  everyAddedCitationHasPinnedFlowBacking: true,
  changes,
};
await writeFile(
  'artifacts/rebuild/verification/migration-readiness/flow-backing-proof.json',
  JSON.stringify(result, null, 2) + '\n',
);
console.log({ ...result, changes: undefined });
