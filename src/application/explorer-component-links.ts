import { stripPrefix } from '@/domain/ids';
import type { ExplorerManifest } from '@/domain/service-explorer';

import { serviceExplorerHref } from './explorer-location';

/** Bridge the legacy service prefix only when exactly one published technical identity matches. */
export function explorerComponentLinks(
  manifest: ExplorerManifest | null,
  components: readonly string[],
): Readonly<Record<string, string>> {
  if (manifest === null) return {};
  const links = components.flatMap((id): readonly (readonly [string, string])[] => {
    const matches = manifest.services.filter(
      (service) => service.id === id || service.id === stripPrefix(id, 'svc'),
    );
    const match = matches.length === 1 ? matches[0] : undefined;
    return match === undefined ? [] : [[id, serviceExplorerHref(manifest.workspace, match.id)]];
  });
  return Object.fromEntries(links);
}

export interface ExplorerRepositoryLink {
  readonly label: string;
  readonly href: string;
  readonly revision: string;
}
export function explorerRepositoryLinks(
  manifest: ExplorerManifest | null,
  repositories: readonly string[],
): readonly ExplorerRepositoryLink[] {
  if (manifest === null) return [];
  return repositories.flatMap((home) => {
    const repo = home.split('/').slice(0, 2).join('/');
    const selection = manifest.services.find((service) => service.repo === repo);
    return selection === undefined
      ? []
      : [
          {
            label: home,
            href: serviceExplorerHref(manifest.workspace, selection.id),
            revision: selection.commit.slice(0, 8),
          },
        ];
  });
}
