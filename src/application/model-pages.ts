import { entryFlowHref } from '@/application/entry-flow-paths';
import type { ModelIndex } from '@/application/model-index';
import { screenEntry, type PaletteEntry } from '@/application/plan-pages-search';
import { journeysHref, referenceHref } from '@/application/today-reader';
import { valueFlowsHref, workspaceHref } from '@/application/workspace-paths';

/** Page addresses come from declared containment, including systems whose implementation is unmapped. */
export function modelPageLinks(index: ModelIndex): Readonly<Record<string, string>> {
  return Object.fromEntries(
    index.entities
      .filter((node) => ['domain', 'system'].includes(node.kind))
      .map((node) => [node.id, index.href(node.id)]),
  );
}
export function modelWorkspaceScreens(index: ModelIndex): readonly PaletteEntry[] {
  const { id, name } = index.model;
  return [
    screenEntry({ href: workspaceHref(id), title: name, hint: 'Map' }),
    screenEntry({ href: valueFlowsHref(id), title: 'Value Flows', hint: name }),
    ...index.entities
      .filter((node) => ['domain', 'system'].includes(node.kind))
      .map((node) =>
        screenEntry({
          href: index.href(node.id),
          title: index.label(node.id),
          hint:
            node.kind === 'domain' ? 'Domain' : `System in ${index.label(node.place.domain ?? '')}`,
        }),
      ),
    screenEntry({ href: journeysHref(id), title: 'Journeys', hint: name }),
    screenEntry({ href: referenceHref(id), title: 'Reference', hint: name }),
    screenEntry({ href: entryFlowHref(id), title: 'Entry flows', hint: name }),
  ];
}
