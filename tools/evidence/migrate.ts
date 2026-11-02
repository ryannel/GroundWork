// Migrates the October 2026 capture and discovery runs into a workspace's current evidence: evidence/<repo>/
// (committed) and .groundwork/syntax/<repo>/ (cache). One-off: later scans write this form directly.
//   npm run evidence:migrate -- <capture catalogue/index.json> <discovery catalogue/index.json> <workspace> [repo]
import {
  openSyntaxCache,
  pruneEvidence,
  writeRepositoryEvidence,
} from '@/infrastructure/scan-explorer/evidence-files';
import {
  captureSources,
  evidenceName,
  migrateRepository,
  withDiscovery,
} from '@/infrastructure/scan-explorer/evidence-migration';
import { workspaceFolder } from '@/infrastructure/workspace-folders';

const [captureFile, discoveryFile, workspaceId, only] = process.argv.slice(2);
if (captureFile === undefined || discoveryFile === undefined || workspaceId === undefined) {
  throw new Error(
    'Usage: evidence:migrate <capture catalogue/index.json> <discovery catalogue/index.json> <workspace> [repo]',
  );
}
const workspace = await workspaceFolder(workspaceId);
if (workspace === null) throw new Error(`Workspace ${workspaceId} has no folder on this machine`);
const sources = await withDiscovery(await captureSources(captureFile), discoveryFile);
const selected = sources.filter(
  (source) => only === undefined || evidenceName(source.repo) === only,
);
for (const source of selected) {
  const started = performance.now();
  const syntax = await openSyntaxCache(workspace, evidenceName(source.repo));
  const evidence = await migrateRepository(source, syntax);
  await syntax.close();
  await writeRepositoryEvidence(workspace, evidence);
  const records = [...evidence.families.values()].reduce((sum, list) => sum + list.length, 0);
  const seconds = ((performance.now() - started) / 1000).toFixed(1);
  console.log(`${source.repo}: ${String(records)} records in ${seconds}s`);
}
if (only === undefined) {
  const names = new Set(sources.map((source) => evidenceName(source.repo)));
  for (const removed of await pruneEvidence(workspace, names)) console.log(`removed ${removed}`);
}
