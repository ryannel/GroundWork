// Read native facts through the same workspace, plan and index queries as the application.
import { readEntryHistory } from '@/infrastructure/entry-history';
import { readCanonicalModelIndex } from '@/infrastructure/model-index';

import { writeModelFacts } from './model-facts';

export async function captureFacts(workspaceId: string, out: string): Promise<readonly string[]> {
  const index = await readCanonicalModelIndex(workspaceId);
  if (index === null) throw new Error(`Cannot capture ${workspaceId}: select a native workspace.`);
  const archive = await readEntryHistory(workspaceId, {});
  const scopes = archive?.kind === 'directory' ? archive.scopes : [];
  return writeModelFacts(out, index, undefined, { historicalScopes: scopes });
}
