// Read-only inventory of the original data and the deterministic preflight; never accepts review rows.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { writeFile } from 'node:fs/promises';

import { authoredFiles } from '../../../../tools/migrate-model/files.ts';
import { migrationReview } from '../../../../tools/migrate-model/review.ts';
import { migrateWorkspace } from '../../../../tools/migrate-model/workspace.ts';

const source = process.argv[2];
if (!source) throw new Error('Pass the registered workspace folder.');
const files = await authoredFiles(source);
const review = migrationReview();
const converted = migrateWorkspace(files, review);
function records(value) {
  if (Array.isArray(value)) return value.flatMap(records);
  if (!value || typeof value !== 'object') return [];
  return [value, ...Object.values(value).flatMap(records)];
}
const sourceNodes = files.flatMap((file) => records(file.value));
const resultNodes = [...converted.files.values()].flatMap((fragment) => records(fragment.value));
const sources = sourceNodes.flatMap((node) => Array.isArray(node.sources) ? node.sources : []);
const jobs = resultNodes.filter((node) => typeof node.id === 'string' && node.id.startsWith('job:') && node.component);
const definitions = {};
for (const fragment of converted.files.values()) {
  const key = fragment.family === null ? 'retained auxiliary' : `${fragment.family}/${fragment.definition}`;
  definitions[key] = (definitions[key] ?? 0) + 1;
}
const data = {
  sourceCommit: execFileSync('/usr/bin/git', ['-c', 'core.fsmonitor=false', '-C', source, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  sourceFiles: files.length,
  sourceSha256: createHash('sha256').update(files.map((file) => `${file.path}\0${file.text}`).join('\0')).digest('hex'),
  migrationFiles: converted.files.size,
  definitions,
  explicitIdentityRewrites: converted.identities.replacements.size,
  ambiguousLegacyIdentities: converted.identities.ambiguous.size,
  rawSources: sources.length,
  urlSources: sources.filter((item) => typeof item.url === 'string').length,
  symbolsWithoutLines: sources.filter((item) => item.symbol && !item.lines),
  jobs: jobs.length,
  aliases: Object.keys(converted.files.get('aliases.yaml').value).length,
  splitHandlerFiles: [...converted.files.keys()].filter((file) => file.includes('/handlers/')).length,
  review: Object.fromEntries(Object.entries(review.rows()).map(([family, rows]) => [family, rows.length])),
  originalFiles: files.map((file) => ({ path: file.path, sha256: createHash('sha256').update(file.text).digest('hex') })),
};
await writeFile('artifacts/rebuild/verification/pr6/migration-inventory.json', `${JSON.stringify(data, null, 2)}\n`);
process.stdout.write(JSON.stringify({ files: data.sourceFiles, output: data.migrationFiles, jobs: data.jobs, urlSources: data.urlSources, symbolsWithoutLines: data.symbolsWithoutLines.length }));
