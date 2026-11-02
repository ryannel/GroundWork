// Asks a workspace's evidence index a question and prints the answer as JSON, with how long it took.
//   npm run evidence -- <workspace> repositories
//   npm run evidence -- <workspace> repository <name>
//   npm run evidence -- <workspace> records <name> [family] [path]
//   npm run evidence -- <workspace> record <name> <id>
//   npm run evidence -- <workspace> search <words> [repository]
import type { EvidenceQuery } from '@/application/evidence/evidence-query';
import { evidenceIndex } from '@/infrastructure/evidence/evidence-index';
import { workspaceFolder } from '@/infrastructure/workspace-folders';

const USAGE = 'Usage: evidence <workspace> repositories|repository|records|record|search …';
const [workspaceId, question, first = '', second, third] = process.argv.slice(2);
if (workspaceId === undefined || question === undefined) throw new Error(USAGE);
const workspace = await workspaceFolder(workspaceId);
if (workspace === null) throw new Error(`Workspace ${workspaceId} has no folder on this machine`);
const opened = performance.now();
const index = await evidenceIndex(workspace);
if (index === null) throw new Error('No evidence index: run npm run evidence:index first');
const openMs = performance.now() - opened;

const questions: Readonly<Record<string, (query: EvidenceQuery) => unknown>> = {
  repositories: (query) => query.repositories(),
  repository: (query) => query.repository(first),
  records: (query) =>
    query.records(first, {
      ...(second === undefined ? {} : { family: second }),
      ...(third === undefined ? {} : { path: third }),
    }),
  record: (query) => query.record(first, second ?? ''),
  search: (query) => query.search(first, second === undefined ? {} : { repository: second }),
};
const ask = questions[question];
if (ask === undefined) throw new Error(USAGE);
const started = performance.now();
const answer = ask(index);
const queryMs = performance.now() - started;
console.log(JSON.stringify(answer, null, 2));
console.error(`opened in ${openMs.toFixed(1)}ms, answered in ${queryMs.toFixed(2)}ms`);
