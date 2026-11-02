'use client';

import { useState } from 'react';

import type { ExplorerDrawing } from '@/shared/explorer-drawing';
import { ComponentCard, ComponentCardHeader } from '@/ui/canvas/component-card';
import { SystemCard, SystemBoundaryHeader } from '@/ui/canvas/system-card';
import { CanvasBoundary, CanvasSystemScope } from '@/ui/connected-canvas.client';
import { ExplorerCanvas } from '@/ui/explorer-canvas';
import { Stack } from '@/ui/stack';
import { Text } from '@/ui/text';

const drawing: ExplorerDrawing = {
  width: 700,
  height: 180,
  nodes: [
    {
      id: 'entry',
      lines: ['Receive request'],
      note: 'entry',
      shape: 'ellipse',
      tone: 'normal',
      x: 24,
      y: 32,
      width: 200,
      height: 90,
    },
    {
      id: 'decision',
      lines: ['Valid customer?'],
      note: 'branch',
      shape: 'diamond',
      tone: 'normal',
      x: 400,
      y: 32,
      width: 220,
      height: 90,
    },
  ],
  edges: [{ id: 'edge', path: 'M224,77 L400,77', label: 'control', x: 310, y: 65, dashed: false }],
};
export function ExplorerSpecimen() {
  const [selected, setSelected] = useState<string | null>(null);
  return (
    <ExplorerCanvas
      drawing={drawing}
      label="Service explorer diagram"
      onSelect={setSelected}
      selected={selected}
    />
  );
}

export function ComponentOverviewSpecimen() {
  const [selected, setSelected] = useState('');
  return (
    <Stack gap={3}>
      <svg width="400" height="230" aria-label="Compact system overview components">
        <CanvasSystemScope colour={3}>
          <CanvasBoundary
            x={1}
            y={1}
            width={398}
            height={228}
            header={<Text weight="strong">System · Price</Text>}
          />
          {['Price calculator', 'Price cache'].map((name, index) => (
            <foreignObject key={name} x={20 + index * 200} y={100} width={160} height={100}>
              <ComponentCard
                active={selected === name}
                header={
                  <ComponentCardHeader
                    compact
                    icon="service"
                    tone={index === 0 ? 'api' : 'data'}
                    kind={index === 0 ? 'Service' : 'Store'}
                    name={name}
                    summary="Select for details"
                    onOpen={() => {
                      setSelected(name);
                    }}
                  />
                }
              />
            </foreignObject>
          ))}
        </CanvasSystemScope>
      </svg>
      <svg width="400" height="110" aria-label="Dense plan component headers">
        {['Price calculator', 'Price admin'].map((name, index) => (
          <foreignObject key={name} x={index * 200} y={1} width={184} height={104}>
            <ComponentCard
              active={selected === name}
              header={
                <ComponentCardHeader
                  density="dense"
                  icon={index === 0 ? 'service' : 'ui'}
                  tone={index === 0 ? 'api' : 'app'}
                  kind={index === 0 ? 'Service' : 'App'}
                  name={name}
                  summary={
                    index === 0 ? 'Calculates the customer price' : 'Maintains market prices'
                  }
                  onOpen={() => {
                    setSelected(name);
                  }}
                />
              }
            />
          </foreignObject>
        ))}
      </svg>
    </Stack>
  );
}

export function SystemOverviewSpecimen() {
  const [expanded, setExpanded] = useState(false);
  const [selected, setSelected] = useState(false);
  return (
    <svg width="400" height={expanded ? 270 : 160} aria-label="Expandable system card">
      <CanvasSystemScope colour={3}>
        {expanded ? (
          <CanvasBoundary
            x={1}
            y={1}
            width={398}
            height={268}
            header={
              <SystemBoundaryHeader
                name="Price"
                purpose="Calculates what a customer pays."
                onCollapse={() => {
                  setExpanded(false);
                }}
              />
            }
          />
        ) : (
          <foreignObject x={1} y={1} width={280} height={150}>
            <SystemCard
              name="Price"
              purpose="Calculates what a customer pays."
              meta="12 components"
              onExpand={() => {
                setExpanded(true);
              }}
            />
          </foreignObject>
        )}
        {expanded ? (
          <foreignObject x={24} y={110} width={280} height={104}>
            <ComponentCard
              active={selected}
              header={
                <ComponentCardHeader
                  icon="service"
                  tone="api"
                  kind="Service"
                  name="Price calculator"
                  summary="Combines prices, taxes and discounts."
                  onOpen={() => {
                    setSelected(!selected);
                  }}
                />
              }
            />
          </foreignObject>
        ) : null}
      </CanvasSystemScope>
    </svg>
  );
}
