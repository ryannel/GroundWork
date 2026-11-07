import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { ExplorerPublication } from '@/features/service-explorer';
import { WorkspaceShell } from '@/features/workspace';
import { readCanonicalModelIndex } from '@/infrastructure/model-index';
import { readModelWorkspaceNav } from '@/infrastructure/model-workspace-nav';
import { readExplorerCatalogue } from '@/infrastructure/service-explorer-catalogue';
import { readExplorerManifest } from '@/infrastructure/service-explorer-files';

interface Params {
  readonly workspace: string;
}
export const metadata: Metadata = { title: 'Service explorer' };

export default async function ExplorerRoute({ params }: { readonly params: Promise<Params> }) {
  const { workspace: id } = await params;
  const native = await readCanonicalModelIndex(id);
  if (native === null) notFound();
  const catalogue = await readExplorerCatalogue(id);
  const manifest = catalogue === null ? await readExplorerManifest(id) : null;
  return (
    <WorkspaceShell
      workspace={native.model}
      nav={await readModelWorkspaceNav(native, { section: 'explorer' })}
      title="Service explorer"
    >
      <ExplorerPublication catalogue={catalogue} manifest={manifest} />
    </WorkspaceShell>
  );
}
