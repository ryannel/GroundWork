import type { Metadata } from 'next';

import { WorkspaceLibrary } from '@/features/workspaces';
import { readWorkspaceLibrary } from '@/infrastructure/workspace-library';

// Named by its layout: a layout's title template reaches the pages below it, not the page beside it.
export const metadata: Metadata = {};

export default async function HomePage() {
  return <WorkspaceLibrary library={await readWorkspaceLibrary()} />;
}
