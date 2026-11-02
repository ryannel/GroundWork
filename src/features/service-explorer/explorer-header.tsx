import type { ExplorerLocation } from '@/application/explorer-location';
import type { ExplorerManifest, ExplorerService } from '@/domain/service-explorer';
import { PageHeader } from '@/ui/page-header';
import { Select } from '@/ui/select';
import { Cluster, Stack } from '@/ui/stack';
import { Text } from '@/ui/text';

import { ExplorerActions } from './explorer-actions';

export function ExplorerHeader({
  manifest,
  service,
  place,
  onNavigate,
  onBack,
  incoming,
}: {
  readonly manifest: ExplorerManifest;
  readonly service: ExplorerService;
  readonly place: ExplorerLocation;
  readonly onNavigate: (place: ExplorerLocation) => void;
  readonly onBack: () => void;
  readonly incoming?: string | undefined;
}) {
  const handleService = (id: string) => {
    const next = manifest.services.find((item) => item.id === id);
    if (next) onNavigate({ component: next.id, file: next.overview, selected: null });
  };
  return (
    <Stack gap={4}>
      <Cluster spread>
        <Select
          label={service.scope === 'repository' ? 'Captured code' : 'Service'}
          onChange={handleService}
          options={manifest.services.map((item) => ({ value: item.id, label: item.name }))}
          value={service.id}
        />
        <Text mono size="sm" tone="faint">
          {service.repo} · {service.commit.slice(0, 8)}
        </Text>
      </Cluster>
      <PageHeader
        description={service.purpose.statement}
        meta={
          <Text size="sm" tone="muted">
            Inferred purpose · {service.purpose.confidence} confidence ·{' '}
            {service.entryCount ?? service.entries.length}{' '}
            {service.scope === 'repository' ? 'recognised entries' : 'published entries'}
            {service.scope === 'repository'
              ? ' · Captured repository scope; runtime grouping unverified'
              : ''}
          </Text>
        }
        title={service.name}
      />
      {service.scope === 'repository' && service.entryCount === 0 ? (
        <Text as="p" tone="muted">
          No entry bindings were recognised in this capture. This does not establish that the code
          has no API. Browse its source files and inferred context.
        </Text>
      ) : null}
      <ExplorerActions
        incoming={incoming}
        onBack={onBack}
        onNavigate={onNavigate}
        place={place}
        service={service}
      />
    </Stack>
  );
}
