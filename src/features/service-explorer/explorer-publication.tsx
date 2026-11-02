import type { ExplorerCatalogue, ExplorerManifest } from '@/domain/service-explorer';
import { Callout } from '@/ui/callout';

import { ExplorerCorpus } from './explorer-corpus.client';
import { ServiceExplorer } from './service-explorer.client';

export function ExplorerPublication({
  catalogue,
  manifest,
}: {
  readonly catalogue: ExplorerCatalogue | null;
  readonly manifest: ExplorerManifest | null;
}) {
  if (catalogue !== null) return <ExplorerCorpus catalogue={catalogue} />;
  if (manifest !== null) {
    return <ServiceExplorer base="data/" key={manifest.snapshot} manifest={manifest} />;
  }
  return (
    <Callout title="No service evidence published">
      This workspace has no validated service explorer projection yet.
    </Callout>
  );
}
