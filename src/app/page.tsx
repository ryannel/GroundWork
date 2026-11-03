import type { Metadata } from 'next';

import { libraryOf } from '@/application/workspace-library';
import { WorkspaceLibrary } from '@/features/workspaces';
import { localWorkspaceDetails, workspaceRegistrations } from '@/infrastructure/workspace-folders';
import { readLoadedPlans } from '@/infrastructure/workspace-plans';
import { readWorkspaces } from '@/infrastructure/workspace-store';

// Named by its layout: a layout's title template reaches the pages below it, not the page beside it.
export const metadata: Metadata = {};

export default async function HomePage() {
  const [workspaces, links] = await Promise.all([readWorkspaces(), workspaceRegistrations()]);
  const plans = new Map(
    await Promise.all(
      workspaces.map(
        async (workspace) => [workspace.id, await readLoadedPlans(workspace.id)] as const,
      ),
    ),
  );
  return (
    <WorkspaceLibrary
      library={libraryOf(workspaces, plans, new Date(), links, localWorkspaceDetails())}
    />
  );
}
