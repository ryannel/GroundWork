'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';

import { checkedExplorerManifest } from '@/domain/explorer-publication-check';
import { stripPrefix } from '@/domain/ids';
import type { ExplorerCatalogue, ExplorerManifest } from '@/domain/service-explorer';
import { Callout } from '@/ui/callout';
import { Text } from '@/ui/text';

import { loadExplorerArtifact } from './load-artifact';
import { ServiceExplorer } from './service-explorer.client';

function subscribe(onChange: () => void): () => void {
  globalThis.addEventListener('popstate', onChange);
  globalThis.addEventListener('groundwork:explorer-location', onChange);
  return () => {
    globalThis.removeEventListener('popstate', onChange);
    globalThis.removeEventListener('groundwork:explorer-location', onChange);
  };
}
function search(): string {
  return globalThis.location.search;
}
function useSelection(
  catalogue: ExplorerCatalogue,
  id: string,
  base: string,
): { readonly manifest: ExplorerManifest | null; readonly error: string | null } {
  const [loaded, setLoaded] = useState<{
    readonly id: string;
    readonly manifest: ExplorerManifest | null;
    readonly error: string | null;
  }>({ id: '', manifest: null, error: null });
  const selection = catalogue.selections.find((item) => item.service.id === id);
  useEffect(() => {
    const controller = new AbortController();
    if (selection !== undefined) {
      void loadExplorerArtifact({
        base,
        artifact: selection.manifest,
        signal: controller.signal,
      })
        .then((raw) => {
          const manifest = checkedExplorerManifest(raw);
          if (
            manifest.snapshot !== catalogue.snapshot ||
            manifest.workspace !== catalogue.workspace
          ) {
            throw new Error('Explorer selection snapshot changed');
          }
          const service = manifest.services.find((item) => item.id === id);
          if (service === undefined) throw new Error('Explorer selection identity changed');
          if (!controller.signal.aborted) {
            setLoaded({
              id,
              manifest: {
                ...manifest,
                services: catalogue.selections.map((item) =>
                  item.service.id === id ? service : item.service,
                ),
              },
              error: null,
            });
          }
        })
        .catch((error: unknown) => {
          if (!controller.signal.aborted) {
            setLoaded({
              id,
              manifest: null,
              error: error instanceof Error ? error.message : 'Evidence unavailable',
            });
          }
        });
    }
    return () => {
      controller.abort();
    };
  }, [catalogue, selection, id, base]);
  return loaded.id === id ? loaded : { manifest: null, error: null };
}
export function ExplorerCorpus({ catalogue }: { readonly catalogue: ExplorerCatalogue }) {
  const base = catalogue.assetBase.startsWith('/')
    ? `../..${catalogue.assetBase}`
    : catalogue.assetBase;
  const query = useSyncExternalStore(subscribe, search, () => '');
  const requested = stripPrefix(new URLSearchParams(query).get('service'), 'svc');
  const selected =
    catalogue.selections.find((item) => item.service.id === requested) ?? catalogue.selections[0];
  const loaded = useSelection(catalogue, selected?.service.id ?? '', base);
  if (loaded.error !== null) {
    return (
      <Callout title="Evidence unavailable" tone="warning">
        {loaded.error}
      </Callout>
    );
  }
  if (loaded.manifest === null) return <Text as="p">Loading the selected scan evidence…</Text>;
  return <ServiceExplorer base={base} manifest={loaded.manifest} />;
}
