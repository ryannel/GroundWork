import 'server-only';

import { modelWorkspaceCardOf } from '@/application/entry-flow-library';
import type { Library } from '@/application/workspace-card';

import { readCanonicalModelIndex } from './model-index';
import { readModelPlanRows } from './model-plan-rows';
import { localWorkspaceDetails, workspaceRegistrations } from './workspace-folders';

/** Registrations remain visible while their data is being consolidated, without reading an old fact engine. */
export async function readWorkspaceLibrary(): Promise<Library> {
  const links = await workspaceRegistrations();
  const loaded = await Promise.all(
    links.map(async (link) => {
      const index = await readCanonicalModelIndex(link.id);
      if (index === null) return { pending: { id: link.id, name: link.name } };
      const { rows } = await readModelPlanRows(index);
      return { card: modelWorkspaceCardOf(index, rows, link, localWorkspaceDetails()) };
    }),
  );
  const cards = loaded
    .flatMap((item) => item.card ?? [])
    .toSorted((a, b) =>
      a.isPrivate === b.isPrivate
        ? a.name.localeCompare(b.name)
        : Number(a.isPrivate) - Number(b.isPrivate),
    );
  const pending = loaded.flatMap((item) => item.pending ?? []);
  return { cards, ...(pending.length === 0 ? {} : { pending }) };
}
