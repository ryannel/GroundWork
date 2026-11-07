import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { tokenToId } from '@/domain/ids';
import { ModelTodayThing, ModelTodayOverlays, TodaySearch } from '@/features/plan';
import { WorkspaceShell } from '@/features/workspace';
import { readCanonicalModelIndex } from '@/infrastructure/model-index';
import { readModelWorkspaceNav } from '@/infrastructure/model-workspace-nav';
import { firstParam, type SearchParams } from '@/shared/search-params';
import { Text } from '@/ui/text';

interface Params {
  readonly workspace: string;
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
        <ModelTodayThing index={native} id={thing.id} />
      )}
    </WorkspaceShell>
  );
}
