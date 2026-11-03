import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';

import { findWorkspace, workspaceHref } from '@/application/workspace-paths';
import { workspaceRegistrations } from '@/infrastructure/workspace-folders';
import { readWorkspaces } from '@/infrastructure/workspace-store';
import { ScopeProvider } from '@/ui/scope-switcher.client';

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

export default async function WorkspaceLayout({
  children,
  params,
}: {
  readonly children: ReactNode;
  readonly params: Promise<Params>;
}) {
  const { workspace: id } = await params;
  const registered = await workspaceRegistrations();
  const links = registered
    .toSorted((a, b) => {
      if (a.isExample !== b.isExample) {
        return a.isExample ? 1 : -1;
      }
      return a.name.localeCompare(b.name);
    })
    .map((workspace) => ({
      label: workspace.name,
      href: workspaceHref(workspace.id),
      group: workspace.isExample ? 'Examples' : 'Workspaces',
      ...(workspace.isExample ? { note: 'example' } : {}),
    }));
  const current = links.find((link) => link.href === workspaceHref(id));
  if (current === undefined) notFound();
  return (
    <ScopeProvider
      scope={{ label: 'Workspace', current, links, index: { label: 'All workspaces', href: '/' } }}
    >
      {children}
    </ScopeProvider>
  );
}
