// Carry an accepted caption only when the full source differs solely by reviewed identity rewrites.
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { parseArgs } from 'node:util';

import { parse, stringify } from 'yaml';

import { rootId } from '../../../../src/domain/ids.ts';
import { authoredFiles, rewriteDocument } from '../../../../tools/migrate-model/files.ts';
import { fingerprint, migrationReview } from '../../../../tools/migrate-model/review.ts';
import { migrateWorkspace } from '../../../../tools/migrate-model/workspace.ts';

const { values } = parseArgs({
  options: {
    workspace: { type: 'string' },
    headlines: { type: 'string' },
    before: { type: 'string', multiple: true },
    after: { type: 'string', multiple: true },
    out: { type: 'string' },
    proof: { type: 'string' },
  },
});
for (const name of ['workspace', 'headlines', 'out', 'proof']) {
  assert.ok(values[name], `Missing --${name}`);
}
const load = async (files = []) =>
  Promise.all(files.map(async (file) => parse(await readFile(file, 'utf8'))));
const originals = parse(await readFile(values.headlines, 'utf8'));
assert.ok(originals.every((row) => row.status === 'accepted' && typeof row.say === 'string'));
const files = await authoredFiles(values.workspace);
function capture(decisions) {
  const sources = new Map();
  const review = migrationReview(decisions);
  const model = migrateWorkspace(files, {
    ...review,
    add: (family, key, source, detail) => {
      if (family === 'headlines') sources.set(key, { source, detail });
      return review.add(family, key, source, detail);
    },
  });
  return { sources, identities: model.identities };
}
const before = capture(await load(values.before));
const after = capture(await load(values.after));
const rewrites = new Map();
for (const id of new Set([
  ...before.identities.replacements.keys(),
  ...after.identities.replacements.keys(),
])) {
  const previous = before.identities.replacements.get(id) ?? id;
  const current = after.identities.replacements.get(id) ?? id;
  if (previous !== current) rewrites.set(previous, current);
}
const carried = [];
const receipt = [];
for (const original of originals) {
  const previous = before.sources.get(original.key);
  assert.ok(previous, `Missing approved source: ${original.key}`);
  assert.equal(
    fingerprint(previous.source),
    original.fingerprint,
    `Approval source changed: ${original.key}`,
  );
  const expected = rewriteDocument(previous.source, rewrites);
  const expectedFingerprint = fingerprint(expected);
  const exact = after.sources.get(original.key);
  const candidates =
    exact !== undefined && fingerprint(exact.source) === expectedFingerprint
      ? [[original.key, exact]]
      : [...after.sources].filter(
          ([key, value]) =>
            rootId(key) === rootId(original.key) &&
            fingerprint(value.source) === expectedFingerprint,
        );
  assert.equal(candidates.length, 1, `Ambiguous or changed caption source: ${original.key}`);
  const [key, value] = candidates[0];
  assert.deepEqual(value.source, expected);
  const say = rewriteDocument(original.say, rewrites);
  assert.equal(say, original.say, 'A caption wording change needs a separate editorial decision.');
  carried.push({
    ...original,
    key,
    path: value.detail.path,
    does: value.detail.does,
    fingerprint: expectedFingerprint,
  });
  if (key !== original.key || expectedFingerprint !== original.fingerprint) {
    receipt.push({
      oldKey: original.key,
      newKey: key,
      oldFingerprint: original.fingerprint,
      newFingerprint: expectedFingerprint,
      fullSourceEqualAfterReviewedRewrites: true,
      sayUnchanged: true,
    });
  }
}
assert.equal(new Set(carried.map((row) => row.key)).size, originals.length);
await writeFile(values.out, stringify(carried, { lineWidth: 100 }));
await writeFile(
  values.proof,
  JSON.stringify(
    {
      approvedRows: originals.length,
      carriedRows: carried.length,
      rewrites: Object.fromEntries(rewrites),
      changes: receipt,
      allCaptionWordingUnchanged: true,
      staleFingerprintProtectionPreserved: true,
    },
    null,
    2,
  ) + '\n',
);
process.stdout.write(
  JSON.stringify({
    approved: originals.length,
    carried: carried.length,
    normalised: receipt.length,
  }),
);
