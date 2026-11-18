'use client';

import { useState } from 'react';

import { areaBoundaryBoxes, areaBoundaryOf } from '@/application/area-map/boundaries';
import { resourceLocation } from '@/application/area-map/component-summary';
import {
  areaSystemBounds,
  type AreaSystemBox,
  layoutAreaSystems,
} from '@/application/area-system-layout';
import type { AreaSystemView, AreaView } from '@/application/workspace-area';
import type { CardSelection } from '@/ui/canvas/component-card';
import { SystemCard } from '@/ui/canvas/system-card';
import { ConnectedCanvas } from '@/ui/connected-canvas.client';
import { TextLink } from '@/ui/text';

import { AreaBoundaryCard } from './area-boundary-card';
import { AreaComponentDetail } from './area-component-detail.client';
import { AreaExpandedSystem } from './area-expanded-system.client';
import { areaCanvasEdges } from './area-system-edges';
import { useAreaSystemSelection } from './area-system-selection';
import { type AreaComponentBox, systemShape } from './area-system-shape';

interface PlacedSystem extends AreaSystemView, AreaSystemBox {
  readonly componentBoxes: readonly AreaComponentBox[];
  readonly componentRelationships: AreaView['relationships'];
}

interface MapState {
  readonly expanded: ReadonlySet<string>;
  readonly selected: ReadonlyMap<string, string>;
  readonly open: ReadonlySet<string>;
}

function shapesOf(systems: readonly AreaSystemView[], state: MapState) {
  return new Map(
    systems.map((system) => [
      system.id,
      state.expanded.has(system.id)
        ? systemShape(system, state.open)
        : { width: 220, height: 150, components: [], relationships: [] },
    ]),
  );
}

function placed(
  systems: readonly AreaSystemView[],
  relationships: AreaView['relationships'],
  state: MapState,
): readonly PlacedSystem[] {
  const shapes = shapesOf(systems, state);
  const boxes = new Map(
    layoutAreaSystems(
      systems.map((system) => {
        const shape = shapes.get(system.id);
        return { id: system.id, width: shape?.width ?? 220, height: shape?.height ?? 150 };
      }),
      relationships,
    ).map((box) => [box.id, box]),
  );
  return systems.flatMap((system): readonly PlacedSystem[] => {
    const box = boxes.get(system.id);
    const shape = shapes.get(system.id);
    if (box === undefined || shape === undefined) return [];
    return [
      {
        ...system,
        ...box,
        componentBoxes: shape.components,
        componentRelationships: shape.relationships,
      },
    ];
  });
}

function CollapsedSystem({
  system,
  onExpand,
  selection,
}: {
  readonly system: PlacedSystem;
  readonly onExpand: () => void;
  readonly selection: CardSelection;
}) {
  return (
    <foreignObject
      data-component={system.id}
      height={system.height}
      width={system.width}
      x={system.x}
      y={system.y}
    >
      <SystemCard
        name={system.name}
        purpose={system.purpose}
        meta={`${String(system.components.length)} components`}
        onExpand={onExpand}
        selection={selection}
        details={
          <TextLink href={system.href} tone="quiet">
            System page →
          </TextLink>
        }
      />
    </foreignObject>
  );
}

function activeFocus(systems: readonly PlacedSystem[], selected: ReadonlyMap<string, string>) {
  for (const system of systems) {
    const active = selected.get(system.id);
    const component = system.componentBoxes.find(
      (candidate) =>
        candidate.id === active ||
        candidate.attachments?.some((resource) => resource.id === active) === true,
    );
    if (component !== undefined) {
      return {
        id: `${system.id}:${component.id}:${active ?? ''}`,
        x: system.x + component.x,
        y: system.y + component.y,
        width: component.width,
        height: component.height,
        readable: true,
      };
    }
  }
  return null;
}

function selectedComponent(
  systems: readonly PlacedSystem[],
  selected: ReadonlyMap<string, string>,
) {
  const selectedId = [...selected.values()][0];
  return systems
    .flatMap((system) =>
      system.componentBoxes.flatMap((component) => [component, ...(component.attachments ?? [])]),
    )
    .find((item) => item.id === selectedId);
}

function useToggleSet() {
  const [items, setItems] = useState<ReadonlySet<string>>(() => new Set());
  const toggle = (id: string): void => {
    setItems((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  return [items, setItems, toggle] as const;
}

/** A system opens with its cards closed, however they were left. */
function withoutSystem(open: ReadonlySet<string>, view: AreaView, id: string): ReadonlySet<string> {
  const system = view.systems.find((candidate) => candidate.id === id);
  const inside = new Set(system?.components.map((item) => item.id));
  return new Set([...open].filter((item) => !inside.has(item)));
}

/** A store or topic folded into a service card opens with that card. */
function ownerOf(view: AreaView, id: string): string {
  const component = view.systems
    .flatMap((system) => system.components)
    .find((item) => item.id === id);
  return component?.parentComponent ?? id;
}

/** Systems collapse to one node and expand into bounded component graphs without leaving the canvas. */
export function AreaSystemMap({ view }: { readonly view: AreaView }) {
  const systemSelection = useAreaSystemSelection(view.area.id);
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(() => new Set());
  const [selected, setSelected] = useState<ReadonlyMap<string, string>>(() => new Map());
  const [detail, setDetail] = useState<'grouped' | 'all'>('grouped');
  const [endpoint, setEndpoint] = useState<string>();
  const [opened, setOpened] = useState<{
    readonly id: string;
    readonly x: number;
    readonly y: number;
  }>();
  const [open, setOpen, toggleOpen] = useToggleSet();
  const systems = placed(
    view.systems.filter((system) => areaBoundaryOf(view, system.id) === undefined),
    view.relationships,
    { expanded, selected, open },
  );
  const boundaries = areaBoundaryBoxes(view, systems);
  const systemByEnd = new Map([
    ...systems.flatMap((system) => [
      [system.id, system.id] as const,
      ...system.components.map(({ id }) => [id, system.id] as const),
    ]),
    ...boundaries.map(({ id }) => [id, id] as const),
  ]);
  const edges = areaCanvasEdges({
    view,
    systems: [...systems, ...boundaries],
    expanded,
    detail,
    selected,
  });
  const bounds = areaSystemBounds([...systems, ...boundaries]);
  const size = {
    width: Math.max(bounds.width, ...edges.map((edge) => edge.x + 100)),
    height: Math.max(bounds.height, ...edges.map((edge) => edge.y + 48)),
  };
  const toggleSystem = (id: string): void => {
    if (expanded.has(id)) systemSelection.collapse(id);
    const system = systems.find((item) => item.id === id);
    if (system !== undefined) setOpened({ id, x: system.x, y: system.y });
    setSelected(new Map());
    setOpen((current) => withoutSystem(current, view, id));
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const toggleComponent = (system: string, component: string): void => {
    const owner = view.systems.find((candidate) =>
      candidate.components.some((item) => item.id === component),
    );
    const target = owner?.id ?? system;
    setExpanded((current) => new Set([...current, target]));
    setEndpoint(undefined);
    setSelected((current) =>
      current.get(target) === component ? new Map() : new Map([[target, component]]),
    );
  };
  const revealResource = (id: string): void => {
    const destination = resourceLocation(view.systems, id);
    if (destination === null) return;
    setExpanded((current) => new Set([...current, destination.system.id]));
    setOpen((current) => new Set([...current, destination.component.id]));
    setSelected(new Map([[destination.system.id, id]]));
    setEndpoint(id);
  };
  const boundary = view.boundaries?.find((node) => selected.get(node.id) === node.id);
  const inspected = boundary ?? selectedComponent(systems, selected);
  const openedSystem = systems.find((system) => system.id === opened?.id);
  const selectEdge = (id: string): void => {
    const relation = edges.find((edge) => edge.id === id)?.relations?.[0];
    if (relation === undefined) return;
    const destinationBoundary = areaBoundaryOf(view, relation.to);
    if (destinationBoundary !== undefined) {
      setSelected(new Map([[destinationBoundary.id, destinationBoundary.id]]));
      setEndpoint(relation.endpointId ?? undefined);
      return;
    }
    setExpanded((current) => new Set([...current, relation.toSystem]));
    setOpen((current) => new Set([...current, ownerOf(view, relation.to)]));
    setSelected(new Map([[relation.toSystem, relation.to]]));
    setEndpoint(relation.endpointId ?? undefined);
  };
  return (
    <ConnectedCanvas
      detail={detail}
      endpoint={endpoint}
      edges={edges.filter((edge) =>
        (edge.relations?.length ?? 0) > 0
          ? edge.relations?.some(({ fromSystem, toSystem, from, to }) =>
              systemSelection.includes(
                fromSystem,
                toSystem,
                ownerOf(view, from),
                ownerOf(view, to),
              ),
            ) === true
          : systemSelection.includes(
              systemByEnd.get(edge.from ?? ''),
              systemByEnd.get(edge.to ?? ''),
              edge.from,
              edge.to,
            ),
      )}
      focus={
        activeFocus(systems, selected) ??
        (openedSystem === undefined
          ? null
          : {
              ...openedSystem,
              id: JSON.stringify([openedSystem.id, expanded.has(openedSystem.id)]),
              height: 70,
              previousPosition: opened,
            })
      }
      height={size.height}
      hoverMembers={
        new Map(systems.map((system) => [system.id, system.components.map(({ id }) => id)]))
      }
      inspector={
        inspected === undefined ? undefined : (
          <AreaComponentDetail
            component={inspected}
            boundary={boundary}
            endpoint={endpoint}
            key={inspected.id}
            usedBy={view.systems
              .flatMap((system) => system.components)
              .filter((component) =>
                view.technicalRelationships.some(
                  (relation) =>
                    (relation.usageFrom ?? relation.from) === component.id &&
                    (relation.usageTo ?? relation.to) === inspected.id,
                ),
              )}
            onSelectEndpoint={setEndpoint}
            onClose={() => {
              setSelected(new Map());
            }}
          />
        )
      }
      label={`${view.area.name} system canvas`}
      onDetailChange={setDetail}
      onEdgeSelect={selectEdge}
      onReset={() => {
        setExpanded(new Set());
        systemSelection.clear();
        setOpen(new Set());
        setSelected(new Map());
        setEndpoint(undefined);
        setOpened(undefined);
      }}
      selected={inspected?.id}
      width={size.width}
    >
      {boundaries.map((box) => (
        <foreignObject
          key={box.id}
          data-boundary={box.id}
          x={box.x}
          y={box.y}
          width={box.width}
          height={box.height}
        >
          <AreaBoundaryCard
            boundary={box.boundary}
            muted={false}
            highlighted={selected.get(box.id) === box.id}
            onSelect={() => {
              setSelected(new Map([[box.id, box.id]]));
              setEndpoint(undefined);
            }}
          />
        </foreignObject>
      ))}
      {systems.map((system) =>
        expanded.has(system.id) ? (
          <AreaExpandedSystem
            systems={view.systems}
            expanded={expanded}
            active={selected.get(system.id)}
            endpoint={endpoint}
            key={system.id}
            onCollapse={() => {
              toggleSystem(system.id);
            }}
            onToggleComponent={(component) => {
              toggleComponent(system.id, component);
            }}
            onSelectEndpoint={setEndpoint}
            onSelectResource={revealResource}
            onToggleOpen={toggleOpen}
            system={system}
            selection={systemSelection.card(system.id)}
            componentSelection={(id) => systemSelection.card(system.id, id)}
          />
        ) : (
          <CollapsedSystem
            key={system.id}
            onExpand={() => {
              toggleSystem(system.id);
            }}
            system={system}
            selection={systemSelection.card(system.id)}
          />
        ),
      )}
    </ConnectedCanvas>
  );
}
