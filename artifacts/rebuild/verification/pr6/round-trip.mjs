// Acceptance proof on explicitly synthetic legacy data; the real workspaces are never written.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, readdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { authoredFiles, writeMigrationFile } from '../../../../tools/migrate-model/files.ts';
import { migrationReview } from '../../../../tools/migrate-model/review.ts';
import { migrateModel } from '../../../../tools/migrate-model/runner.ts';
import { migrateWorkspace } from '../../../../tools/migrate-model/workspace.ts';

const root = await mkdtemp(path.join(tmpdir(), 'groundwork-pr6-proof-'));
const source = path.join(root, 'source');
const base = 'domains/orders/systems/orders';
const cite = { repo: 'example/orders', path: 'src/orders.ts', commit: 'a'.repeat(40), lines: [1, 20] };
const fixture = {
  'workspace.yaml': { id: 'migration-proof', name: 'Synthetic migration proof', teams: [], actors: [] },
  'domains/orders/domain.yaml': { id: 'orders', name: 'Orders' },
  [`${base}/system.yaml`]: { id: 'orders', name: 'Orders', repos: ['example/orders'], components: [
    { id: 'svc:orders', name: 'Orders', type: 'service' },
    { id: 'svc:shop', name: 'Shop', type: 'website' },
    { id: 'st:jobs', name: 'Jobs', type: 'queue' },
  ] },
  [`${base}/contracts.yaml`]: { interfaces: [{ id: 'if:orders', service: 'svc:orders', protocol: 'rest', endpoints: [{ id: 'api:order', sig: 'GET /orders' }] }], schemas: [{ id: 'sch:job', kind: 'record', store: 'st:jobs', fields: [{ name: 'status', type: 'enum(pending, done)' }] }] },
  [`${base}/handlers.yaml`]: { handlers: [
    { id: 'h:order', component: 'svc:orders', on: 'api:order', sources: [cite], steps: [{ read: 'sch:job', from: 'st:jobs', does: 'Loads the complete queued job record, including its current processing status.' }, { return: 200 }] },
    { id: 'h:nightly', component: 'svc:shop', on: 'job:each morning', sources: [cite], steps: [{ return: 200 }] },
  ] },
  'plans/change/plan.yaml': { meta: { id: 'change', title: 'Accept the job asynchronously' }, problem: { summary: 'The proposed return value is not implemented yet.' }, changes: [{ id: 'chg:accept', title: 'Accept the request', ops: [{ modify: 'h:order', set: { steps: [{ return: 202 }] } }] }] },
  'evidence/orders/repository.json': { format: 'groundwork-evidence/v1', repo: 'example/orders', commit: 'a'.repeat(40), scannedAt: '2026-11-06T12:00:00Z', language: 'typescript', trackedFiles: 1, selectedFiles: 1, passes: ['source'] },
};
for (const [file, value] of Object.entries(fixture)) await writeMigrationFile(source, file, value);
async function hashes(folder) {
  const entries = await readdir(folder, { recursive: true, withFileTypes: true });
  const files = entries.filter((entry) => entry.isFile()).map((entry) => path.relative(folder, path.join(entry.parentPath, entry.name))).toSorted();
  const result = {};
  for (const file of files) result[file] = createHash('sha256').update(await readFile(path.join(folder, file))).digest('hex');
  return result;
}
const original = await hashes(source);
const review = migrationReview();
const input = await authoredFiles(source);
const preview = migrateWorkspace(input, review);
const accepted = [(review.rows().headlines ?? []).map((row) => ({ ...row, status: 'accepted', say: 'Load queued jobs' }))];
assert.equal(accepted[0].length, 1);
const runs = [];
for (const name of ['one', 'two']) {
  const out = path.join(root, name);
  const report = path.join(root, `${name}-report`);
  const result = await migrateModel({ workspace: source, out, report, accepted });
  assert.equal(result.status, 'ready', JSON.stringify(result));
  assert.deepEqual(result.problems, []);
  runs.push({ result, output: await hashes(out), reports: await hashes(report) });
}
assert.deepEqual(runs[0], runs[1]);
assert.deepEqual(await hashes(source), original);
function ids(value) {
  if (Array.isArray(value)) return value.flatMap(ids);
  if (!value || typeof value !== 'object') return [];
  return [...(typeof value.id === 'string' ? [value.id] : []), ...Object.values(value).flatMap(ids)];
}
const reversed = migrateWorkspace(input.toReversed(), migrationReview());
const identities = (workspace) => [...workspace.files.values()].flatMap((fragment) => ids(fragment.value)).toSorted();
assert.deepEqual(identities(preview), identities(reversed));
const proof = { syntheticFixture: true, acceptedFilesSha256: createHash('sha256').update(JSON.stringify(accepted)).digest('hex'), readyRuns: 2, outputBytesIdentical: true, reportBytesIdentical: true, inputUnchanged: true, reorderedInputIdsUnchanged: true, includes: ['cited queue record access', 'app job and preserved trigger', 'accepted headline', 'uncited future plan return', 'isolated ordinary reader and plan projection validation'], output: runs[0].output, reports: runs[0].reports, original };
await writeFile('artifacts/rebuild/verification/pr6/round-trip.json', `${JSON.stringify(proof, null, 2)}\n`);
process.stdout.write(JSON.stringify({ readyRuns: 2, outputBytesIdentical: true, reportBytesIdentical: true, inputUnchanged: true, reorderedInputIdsUnchanged: true }));
