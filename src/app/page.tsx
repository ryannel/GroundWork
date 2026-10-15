import { libraryOf } from '@/application/workspace-library';
import { WorkspaceLibrary } from '@/features/workspaces';
import { readLoadedPlans } from '@/infrastructure/workspace-plans';
import { readWorkspaces } from '@/infrastructure/workspace-store';

export default async function HomePage() {
  const workspaces = await readWorkspaces();
  const plans = new Map(
    await Promise.all(
      workspaces.map(
        async (workspace) => [workspace.id, await readLoadedPlans(workspace.id)] as const,
      ),
    ),
  );
  return <WorkspaceLibrary library={libraryOf(workspaces, plans)} />;
}
