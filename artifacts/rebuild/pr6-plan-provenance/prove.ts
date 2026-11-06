import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { authoredFiles } from '@/../tools/migrate-model/files';
import { migrationReview } from '@/../tools/migrate-model/review';
import { migrateWorkspace } from '@/../tools/migrate-model/workspace';
import { modelList, modelRecord, modelText } from '@/domain/workspace-model';
import { modelProblems } from '@/infrastructure/model-schema';

const source = process.argv[2];
const report = process.argv[3];
if (source === undefined || report === undefined) throw new Error('Pass the workspace folder and report JSON filename.');
const files = await authoredFiles(source);
const migrated = migrateWorkspace(files, migrationReview());
const probes: {
  readonly file: string;
  readonly line: number;
  readonly handler: string;
  readonly value: unknown;
  readonly missingCitations: Awaited<ReturnType<typeof modelProblems>>;
}[] = [];
for (const [file, fragment] of migrated.files) {
  if (fragment.family !== 'plan') continue;
  for (const change of modelList(modelRecord(fragment.value)?.changes)) {
    for (const item of modelList(modelRecord(change)?.ops)) {
      const op = modelRecord(item);
      if (op?.add !== 'handler') continue;
      const value = modelRecord(op.value);
      const id = modelText(value?.id);
      if (id === null) throw new Error('Missing proposed handler identity.');
      const errors = await modelProblems('workspace', 'Handler', value);
      const missingCitations = errors.filter((error) => error.keyword === 'required' && error.params.missingProperty === 'cites');
      if (missingCitations.length === 0) continue;
      const original = files.find((entry) => entry.path === file);
      probes.push({ file, line: (original?.text.split('\n').findIndex((line) => line.includes(`id: ${id}`)) ?? -1) + 1, handler: id, value, missingCitations });
    }
  }
}
if (probes.length !== 2 || probes.reduce((count, probe) => count + probe.missingCitations.length, 0) !== 6) throw new Error('The observed conflict changed; inspect the new input before using this evidence.');
const schema = await readFile('schema/workspace.schema.json');
const data = {
  sourceCommit: execFileSync('/usr/bin/git', ['-c', 'core.fsmonitor=false', '-C', path.resolve(source), 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  schemaSha256: createHash('sha256').update(schema).digest('hex'),
  plans: 1,
  proposedHandlers: probes.length,
  missingEffectCitations: 6,
  probes,
};
await writeFile(report, `${JSON.stringify(data, null, 2)}\n`);
process.stdout.write(JSON.stringify({ report, proposedHandlers: data.proposedHandlers, missingEffectCitations: data.missingEffectCitations }));
