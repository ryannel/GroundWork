import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { archiveHref } from '@/application/interpretation-archive';
import type { ModelIndex } from '@/application/model-index';
import { tokenToId } from '@/domain/ids';
import { ModelTodayThing, ModelTodayOverlays, TodaySearch } from '@/features/plan';
import { WorkspaceShell } from '@/features/workspace';
import { readArchive } from '@/infrastructure/interpretation-archive';
import { readCanonicalModelIndex } from '@/infrastructure/model-index';
import { readModelWorkspaceNav } from '@/infrastructure/model-workspace-nav';
import { firstParam, type SearchParams } from '@/shared/search-params';
import { Text } from '@/ui/text';

interface Params {
  readonly workspace: string;
}

async function archivedOriginal(index: ModelIndex, id: string): Promise<string | null> {
  const evidence = index.model.evidence.find((repository) =>
    repository.records.some((record) => record.family === 'claims' && record.data.id === id),
  );
  if (evidence === undefined) return null;
  const archive = await readArchive(index.model.id, evidence.repository);
  const claim = archive?.claims.find((record) => record.canonicalId === id);
  return claim === undefined ? null : archiveHref(index.model.id, evidence.repository, claim.id);
}

// A thing is looked up like the reference, so the rail opens there rather than on the map.
export const metadata: Metadata = { title: 'Things' };

export default async function TodayThingRoute({
  params,
  searchParams,
}: {
  readonly params: Promise<Params>;
  readonly searchParams: Promise<SearchParams>;
}) {
  const { workspace: id } = await params;
  const native = await readCanonicalModelIndex(id);
  if (native === null) notFound();
  const query = await searchParams;
  const key = firstParam(query.id);
  const thing = native.get(tokenToId(key) ?? key);
  const original =
    thing?.kind === 'evidence' && thing.data.label === 'Inferred'
      ? await archivedOriginal(native, thing.id)
      : null;
  return (
    <WorkspaceShell
      workspace={native.model}
      nav={await readModelWorkspaceNav(native, { section: 'reference' })}
      actions={<TodaySearch />}
      overlays={<ModelTodayOverlays index={native} depth={1} />}
      title="Things"
    >
      {thing === null ? (
        <Text as="p" tone="muted">
          Nothing here goes by that name.
        </Text>
      ) : (
        <ModelTodayThing index={native} id={thing.id} archiveHref={original} />
      )}
    </WorkspaceShell>
  );
}
