// Read native facts through the same workspace, plan and index queries as the application.
import { readCanonicalModelIndex } from '@/infrastructure/model-index';
import { readExplorerCatalogue } from '@/infrastructure/service-explorer-catalogue';
import { readExplorerManifest } from '@/infrastructure/service-explorer-files';

import { writeModelFacts } from './model-facts';

export async function captureFacts(workspaceId: string, out: string): Promise<readonly string[]> {
  const index = await readCanonicalModelIndex(workspaceId);
  if (index === null) throw new Error(`Cannot capture ${workspaceId}: select a native workspace.`);
  // The publication remains separately retained for the explorer retirement proof.
  const [manifest, catalogue] = await Promise.all([
    readExplorerManifest(workspaceId),
    readExplorerCatalogue(workspaceId),
  ]);
  return writeModelFacts(out, index, undefined, { manifest, catalogue });
}
