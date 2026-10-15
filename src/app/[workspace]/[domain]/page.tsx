import { notFound } from 'next/navigation';

import { domainViewOf } from '@/application/workspace-domain';
import { domainPaths, findWorkspace } from '@/application/workspace-paths';
import { DomainPage } from '@/features/workspace';
import { readWorkspaces } from '@/infrastructure/workspace-store';

interface Params {
  readonly workspace: string;
  readonly domain: string;
}

export const dynamicParams = false;

export async function generateStaticParams(): Promise<Params[]> {
  return domainPaths(await readWorkspaces());
}

export default async function DomainRoute({ params }: { readonly params: Promise<Params> }) {
  const { workspace: id, domain } = await params;
  const workspace = findWorkspace(await readWorkspaces(), id);
  const view = workspace === null ? null : domainViewOf(workspace, domain);
  if (view === null) notFound();
  return <DomainPage view={view} />;
}
