import 'server-only';

import {
  entryFlowPageOf,
  entryFlowPlanId,
  type EntryFlowPage,
} from '@/application/entry-flow-page';
import type { SearchParams } from '@/shared/search-params';

import { readCanonicalModelIndex } from './model-index';
import { readSelectedPlanContext } from './model-plan-context';
import { readModelPlanEntries } from './model-plans';

/** Only the selected plan is projected, using its real slug and native frozen/open policy. */
export async function readEntryFlowPage(
  id: string,
  query: SearchParams,
  root?: string,
): Promise<EntryFlowPage | null> {
  const current = await readCanonicalModelIndex(id, root);
  if (current === null) return null;
  const entries = await readModelPlanEntries(id, root);
  const selected = entries.find((entry) => entry.plan.meta.id === entryFlowPlanId(query));
  const context =
    selected === undefined
      ? undefined
      : await readSelectedPlanContext(id, selected.slug, root, current);
  if (context === null) return null;
  return entryFlowPageOf(
    current.model,
    entries.map((entry) => entry.plan),
    query,
    current,
    context,
  );
}
