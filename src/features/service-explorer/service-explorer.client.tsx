'use client';

import { useEffect } from 'react';

import { explorerServiceOverview } from '@/application/explorer-service-overview';
import type { ExplorerManifest } from '@/domain/service-explorer';
import { Callout } from '@/ui/callout';
import { Stack } from '@/ui/stack';

import { ExplorerHeader } from './explorer-header';
import { ExplorerStage } from './explorer-stage';
import { useExplorerLocation } from './use-explorer-location';
import { useExplorerPage } from './use-explorer-page';

export function ServiceExplorer({
  manifest,
  base,
}: {
  readonly manifest: ExplorerManifest;
  readonly base: string;
}) {
  const { place, navigate, handleBack } = useExplorerLocation(manifest);
  const service = manifest.services.find((item) => item.id === place.component);
  const loaded = useExplorerPage(manifest, base, place.file);
  const page =
    loaded.page && place.file === service?.overview
      ? explorerServiceOverview(loaded.page, service)
      : loaded.page;
  const node = page?.nodes.find((item) => item.id === place.selected);
  const inspection = useExplorerPage(manifest, base, node?.target ?? null);
  const error = loaded.error ?? inspection.error;
  const data = inspection.page;
  useEffect(() => {
    if (
      loaded.error === 'Page is outside the selected explorer manifest' &&
      service !== undefined &&
      place.file !== service.overview
    ) {
      navigate({ ...place, file: service.overview, selected: null });
    }
  }, [loaded.error, service, place, navigate]);
  if (!service) {
    return (
      <Callout title="No service projection">
        Publish validated explorer data for this workspace.
      </Callout>
    );
  }
  return (
    <Stack gap={4}>
      <ExplorerHeader
        manifest={manifest}
        onBack={() => {
          handleBack({ component: service.id, file: service.overview, selected: null });
        }}
        onNavigate={navigate}
        place={place}
        service={service}
        incoming={page?.incoming}
      />
      {error === null ? null : (
        <Callout title="Evidence unavailable" tone="warning">
          {error}
        </Callout>
      )}
      <ExplorerStage
        page={page}
        data={data}
        selected={place.selected}
        onClose={() => {
          navigate({ ...place, selected: null });
        }}
        onSelect={(id) => {
          const entry = service.entries.find((item) => item.id === id);
          const target = page?.nodes.find((item) => item.id === id)?.target;
          if (place.file === service.overview && entry) {
            navigate({ ...place, file: entry.file, selected: null });
          } else if (page?.kind === 'overview' && target !== undefined && target !== null) {
            navigate({ ...place, file: target, selected: null });
          } else navigate({ ...place, selected: id });
        }}
        onOpen={(target) => {
          navigate({ ...place, file: target, selected: null });
        }}
      />
    </Stack>
  );
}
