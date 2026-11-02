import 'server-only';

import {
  explorerComponentLinks,
  explorerRepositoryLinks,
  type ExplorerRepositoryLink,
} from '@/application/explorer-component-links';

import { readExplorerCatalogue } from './service-explorer-catalogue';
import { readExplorerManifest } from './service-explorer-files';

export async function readExplorerNavigation(
  workspace: string,
  scope: { readonly components: readonly string[]; readonly repositories: readonly string[] },
): Promise<{
  readonly components: Readonly<Record<string, string>>;
  readonly repositories: readonly ExplorerRepositoryLink[];
}> {
  const catalogue = await readExplorerCatalogue(workspace);
  const manifest =
    catalogue === null
      ? await readExplorerManifest(workspace)
      : {
          format: 'service-explorer/v1' as const,
          workspace,
          snapshot: catalogue.snapshot,
          services: catalogue.selections.map((item) => item.service),
          artifacts: [],
        };
  return {
    components: explorerComponentLinks(manifest, scope.components),
    repositories: explorerRepositoryLinks(manifest, scope.repositories),
  };
}
