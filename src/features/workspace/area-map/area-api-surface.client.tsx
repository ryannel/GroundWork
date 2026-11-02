'use client';

import { apiSurface, surfaceLabel } from '@/application/area-map/api-surface';
import type { AreaComponentView } from '@/application/workspace-area';
import { Button } from '@/ui/button';
import { CanvasEndpointChoice } from '@/ui/connected-canvas.client';
import { Text } from '@/ui/text';

interface SurfaceProps {
  readonly component: AreaComponentView;
  readonly selected: string | undefined;
  readonly onSelect: (id: string) => void;
}

function SurfaceList({ component, onSelect }: SurfaceProps) {
  return (
    <>
      {apiSurface(component.endpoints).map((surface) => (
        <CanvasEndpointChoice
          active={false}
          key={surface.id}
          onClick={() => {
            onSelect(surface.id);
          }}
        >
          <Text weight="strong">{surfaceLabel(surface)}</Text>
          <Text size="sm" tone="faint">
            {surface.endpoints.length} operations · inspect
          </Text>
        </CanvasEndpointChoice>
      ))}
    </>
  );
}

/** Operations are only shown after a person chooses an API resource group. */
export function AreaApiSurface({ component, selected, onSelect }: SurfaceProps) {
  if (component.endpoints.length === 0) {
    return <Text tone="faint">No published API endpoints were evidenced in this scan.</Text>;
  }
  const surface = apiSurface(component.endpoints).find(
    (group) => group.id === selected || group.endpoints.some((port) => port.id === selected),
  );
  if (surface === undefined) {
    return <SurfaceList component={component} selected={selected} onSelect={onSelect} />;
  }
  return (
    <>
      <Text weight="strong">{surfaceLabel(surface)}</Text>
      <Button
        size="sm"
        onClick={() => {
          onSelect('');
        }}
      >
        All API groups
      </Button>
      {surface.endpoints.map((endpoint) => (
        <CanvasEndpointChoice
          active={endpoint.id === selected}
          key={endpoint.id}
          onClick={() => {
            onSelect(endpoint.id);
          }}
        >
          <Text mono size="sm" tone="accent">
            {endpoint.signature}
          </Text>
          <Text size="sm" tone="faint">
            {endpoint.callers.length} recorded callers
          </Text>
        </CanvasEndpointChoice>
      ))}
    </>
  );
}
