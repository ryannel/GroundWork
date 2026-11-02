import type { ReactNode } from 'react';

import { SHOW_ALL, SHOW_OVERVIEW } from '@/application/plan-viz-system-map-types';
import { Button } from '@/ui/button';
import { FilterChips } from '@/ui/filter-chips';
import { Cluster, Stack } from '@/ui/stack';
import { Text } from '@/ui/text';

import type { LineFilter, SystemMapState } from './use-system-map';

const LINES: readonly { readonly value: LineFilter; readonly label: string }[] = [
  { value: 'all', label: 'All connections' },
  { value: 'api', label: 'Calls' },
  { value: 'msg', label: 'Events' },
  { value: 'data', label: 'Data' },
];

function ControlGroup({
  label,
  children,
}: {
  readonly label: string;
  readonly children: ReactNode;
}) {
  return (
    <Stack gap={1}>
      <Text size="sm" tone="faint" caps>
        {label}
      </Text>
      {children}
    </Stack>
  );
}

/** Arrangement, detail and connections are separate choices over the same model. */
export function MapToolbar({ map }: { readonly map: SystemMapState }) {
  const handleView = map.setView;
  const handleFilter = map.setFilter;
  const handleInfra = map.toggleInfra;
  return (
    <Stack gap={2}>
      <Cluster gap={3} align="start" label="Map controls">
        {map.hasValueFlow ? (
          <ControlGroup label="View">
            <FilterChips
              label="Map view"
              value={map.view}
              onChange={handleView}
              choices={[
                { value: 'flow', label: 'Value flow' },
                { value: 'structure', label: 'System structure' },
              ]}
            />
          </ControlGroup>
        ) : null}
        <ControlGroup label="Detail">
          <FilterChips
            label="Map detail"
            value={map.show.parts ? 'components' : 'overview'}
            choices={[
              { value: 'overview', label: 'Overview' },
              { value: 'components', label: 'All components' },
            ]}
            onChange={(value) => {
              map.setShow(value === 'overview' ? SHOW_OVERVIEW : SHOW_ALL);
            }}
          />
        </ControlGroup>
        <ControlGroup label="Connections">
          <FilterChips
            label="Connection kind"
            value={map.filter}
            choices={LINES}
            onChange={handleFilter}
          />
        </ControlGroup>
        {map.infra.count === 0 ? null : (
          <ControlGroup label="Supporting services">
            <Button
              label={`${map.infra.shown ? 'Hide' : 'Show'} platform services`}
              pressed={map.infra.shown}
              onClick={handleInfra}
              size="sm"
            >
              Platform · {map.infra.count}
            </Button>
          </ControlGroup>
        )}
      </Cluster>
      <Text size="sm" tone="muted">
        {map.view === 'flow'
          ? 'Follow the plan’s stages from left to right. A system can contribute to several stages.'
          : 'Components are grouped by their recorded system. Expand a system to explore it.'}
      </Text>
    </Stack>
  );
}
