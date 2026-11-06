import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';

const paths = execFileSync('/usr/bin/git', ['-c', 'core.fsmonitor=false', 'ls-files', '-co', '--exclude-standard', '-z'], { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 }).split('\0').filter(Boolean);
const source = [...new Set(paths)].filter((file) => /^(?:src|tools|schema|test|workspaces)\//u.test(file) || /^(?:package(?:-lock)?\.json|[^/]*config[^/]*|\.nvmrc|AGENTS\.md|groundwork\.local\.yaml)$/u.test(file)).toSorted();
const files = {};
for (const file of source) files[file] = createHash('sha256').update(await readFile(file)).digest('hex');
const prior = JSON.parse(await readFile('artifacts/rebuild/verification/pr5/baseline-integrity.json', 'utf8'));
const baselinePaths = prior.checks.map((item) => item.file);
const blobs = execFileSync('/usr/bin/git', ['hash-object', ...baselinePaths], { encoding: 'utf8' }).trim().split('\n');
const checks = prior.checks.map((item, index) => ({ ...item, unchanged: blobs[index] === item.gitBlob }));
assert.equal(checks.length, 193);
assert.ok(checks.every((item) => item.unchanged), 'A frozen baseline changed.');
await writeFile('artifacts/rebuild/verification/pr6/baseline-integrity.json', `${JSON.stringify({ files: checks.length, allUnchanged: true, checks }, null, 2)}\n`);
await writeFile('artifacts/rebuild/verification/pr6/source-freeze.json', `${JSON.stringify({ base: '2048a2ce45388d54b087b2bca7e869b158704525', files }, null, 2)}\n`);
process.stdout.write(JSON.stringify({ sourceFiles: source.length, baselineFiles: checks.length, allBaselinesUnchanged: true }));
