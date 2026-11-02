// Builds a workspace's evidence index (.groundwork/evidence.sqlite) from its evidence/ folder.
//   npm run evidence:index -- <workspace>
import { buildEvidenceIndex } from '@/infrastructure/scan-explorer/evidence-index-builder';
import { workspaceFolder } from '@/infrastructure/workspace-folders';

const [workspaceId] = process.argv.slice(2);
if (workspaceId === undefined) throw new Error('Usage: evidence:index <workspace>');
const workspace = await workspaceFolder(workspaceId);
if (workspace === null) throw new Error(`Workspace ${workspaceId} has no folder on this machine`);
const started = performance.now();
const built = await buildEvidenceIndex(workspace);
const seconds = ((performance.now() - started) / 1000).toFixed(1);
console.log(
  `${built.file}: ${String(built.repositories)} repositories, ${String(built.records)} records, ${String(built.links)} links in ${seconds}s`,
);
