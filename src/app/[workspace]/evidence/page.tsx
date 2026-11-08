import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { ArchiveDirectory, ArchiveRepository } from '@/features/evidence';
import { archiveRepositories, readArchive } from '@/infrastructure/interpretation-archive';
import { firstParam, type SearchParams } from '@/shared/search-params';

export const metadata: Metadata = { title: 'Archived interpretations' };

export default async function EvidenceArchive({
  params,
  searchParams,
}: {
  readonly params: Promise<{ readonly workspace: string }>;
  readonly searchParams: Promise<SearchParams>;
}) {
  const { workspace } = await params;
  const query = await searchParams;
  const repo = firstParam(query.repo);
  const commit = firstParam(query.commit);
  if (repo !== '' || commit !== '') {
    const scope = { repo, commit };
    const archive = await readArchive(workspace, scope);
    if (archive === null) notFound();
    return <ArchiveRepository archive={archive} scope={scope} workspace={workspace} />;
  }
  const repositories = await archiveRepositories(workspace);
  if (repositories === null) notFound();
  return <ArchiveDirectory repositories={repositories} workspace={workspace} />;
}
