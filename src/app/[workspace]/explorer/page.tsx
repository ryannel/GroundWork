import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { workspaceNavOf } from '@/application/workspace-nav';
import { workspaceHref } from '@/application/workspace-paths';
import { ExplorerPublication } from '@/features/service-explorer';
import { WorkspaceShell } from '@/features/workspace';
import { readExplorerCatalogue } from '@/infrastructure/service-explorer-catalogue';
import { readExplorerManifest } from '@/infrastructure/service-explorer-files';
import { todayData } from '@/infrastructure/today-data';

interface Params {
  readonly workspace: string;
}
export const metadata: Metadata = { title: 'Service explorer' };

export default async function ExplorerRoute({ params }: { readonly params: Promise<Params> }) {
  const { workspace: id } = await params;
  const data = await todayData(id);
  if (data === null) notFound();
  const catalogue = await readExplorerCatalogue(id);
  const manifest = catalogue === null ? await readExplorerManifest(id) : null;
  return (
    <WorkspaceShell
      nav={workspaceNavOf(data.workspace, data.plans, { section: 'explorer' }, data.programmes)}
      title="Service explorer"
      trail={[
        { label: 'Workspaces', href: '/' },
        { label: data.workspace.name, href: workspaceHref(id) },
      ]}
    >
      <ExplorerPublication catalogue={catalogue} manifest={manifest} />
    </WorkspaceShell>
  );
}
