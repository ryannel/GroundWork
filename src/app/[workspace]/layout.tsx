import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import { findWorkspace } from '@/application/workspace-paths';
import { readWorkspaces } from '@/infrastructure/workspace-store';

interface Params {
  readonly workspace: string;
}

// Every page in a workspace names the workspace after its own title.
export async function generateMetadata({
  params,
}: {
  readonly params: Promise<Params>;
}): Promise<Metadata> {
  const { workspace: id } = await params;
  const workspace = findWorkspace(await readWorkspaces(), id);
  if (workspace === null) return {};
  const { name } = workspace;
  return { title: { default: name, template: `%s · ${name}` } };
}

export default async function WorkspaceLayout({ children }: { readonly children: ReactNode }) {
  return children;
}
