import type { ExplorerLocation } from '@/application/explorer-location';
import type { ExplorerService } from '@/domain/service-explorer';
import { Button } from '@/ui/button';
import { Select } from '@/ui/select';
import { Cluster } from '@/ui/stack';

export function ExplorerActions({
  service,
  place,
  onNavigate,
  onBack,
  incoming,
}: {
  readonly service: ExplorerService;
  readonly place: ExplorerLocation;
  readonly onNavigate: (place: ExplorerLocation) => void;
  readonly onBack: () => void;
  readonly incoming?: string | undefined;
}) {
  const handleEntry = (id: string) => {
    const entry = service.entries.find((item) => item.id === id);
    if (entry) onNavigate({ ...place, file: entry.file, selected: null });
  };
  return (
    <Cluster label="Service views">
      {place.file === service.overview && place.selected === null ? null : (
        <Button label="Back to previous view" onClick={onBack} variant="ghost">
          ← Back
        </Button>
      )}
      <Button
        onClick={() => {
          onNavigate({ ...place, file: service.overview, selected: null });
        }}
        pressed={place.file === service.overview}
      >
        {service.scope === 'repository' ? 'Code map' : 'Service map'}
      </Button>
      <Button
        onClick={() => {
          onNavigate({ ...place, file: service.callers, selected: null });
        }}
        pressed={place.file === service.callers}
      >
        {service.scope === 'repository' ? 'Published references' : 'Callers'}
      </Button>
      {incoming === undefined ? null : (
        <Button
          onClick={() => {
            onNavigate({ ...place, file: incoming, selected: null });
          }}
        >
          References in view
        </Button>
      )}
      {service.sourceIndex === undefined ? null : (
        <Button
          onClick={() => {
            if (service.sourceIndex !== undefined) {
              onNavigate({ ...place, file: service.sourceIndex, selected: null });
            }
          }}
          pressed={place.file === service.sourceIndex}
        >
          Source files
        </Button>
      )}
      {service.interpretationIndex === undefined ? null : (
        <Button
          onClick={() => {
            if (service.interpretationIndex !== undefined) {
              onNavigate({ ...place, file: service.interpretationIndex, selected: null });
            }
          }}
        >
          Inferred context
        </Button>
      )}
      <Select
        label="Endpoint or entry"
        onChange={handleEntry}
        options={[
          { value: '', label: 'Choose an endpoint, consumer or job' },
          ...service.entries.map((item) => ({ value: item.id, label: item.label })),
        ]}
        value={service.entries.find((item) => item.file === place.file)?.id ?? ''}
      />
    </Cluster>
  );
}
