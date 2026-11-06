import 'server-only';

import { modelWorkspaceCardOf } from '@/application/entry-flow-library';
import { libraryOf, type Library } from '@/application/workspace-library';

import { readModelIfCanonical } from './canonical-model';
import { readModelPlans } from './model-plans';
import { localWorkspaceDetails, workspaceRegistrations } from './workspace-folders';
import { readLoadedPlans } from './workspace-plans';
import { readWorkspaces } from './workspace-store';

/** The library joins both authored formats without sending a canonical overlay through legacy derivation. */
export async function readWorkspaceLibrary(): Promise<Library> {
  const [workspaces, links] = await Promise.all([readWorkspaces(), workspaceRegistrations()]);
  const today = new Date();
  const cards = await Promise.all(
    workspaces.map(async (workspace) => {
      const model = await readModelIfCanonical(workspace.id);
      const link = links.find((entry) => entry.id === workspace.id);
      if (model !== null) {
        return modelWorkspaceCardOf(model, await readModelPlans(workspace.id), link);
      }
      const plans = await readLoadedPlans(workspace.id);
      const library = libraryOf(
        [workspace],
        new Map([[workspace.id, plans]]),
        today,
        links,
        localWorkspaceDetails(),
      );
      const card = library.cards[0];
      if (card === undefined) throw new Error(`Workspace card missing for ${workspace.id}`);
      return card;
    }),
  );
  return {
    cards: cards.toSorted((a, b) =>
      a.isPrivate === b.isPrivate
        ? a.name.localeCompare(b.name)
        : Number(a.isPrivate) - Number(b.isPrivate),
    ),
  };
}
