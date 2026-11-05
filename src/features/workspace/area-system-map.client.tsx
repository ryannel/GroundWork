'use client';

import { useState } from 'react';

import { resourceLocation } from '@/application/area-map/component-summary';
import {
  areaSystemBounds,
  type AreaSystemBox,
  layoutAreaSystems,
} from '@/application/area-system-layout';
import type { AreaSystemView, AreaView } from '@/application/workspace-area';
import type { SystemNarrative } from '@/domain/system-narrative';
import { SystemCard } from '@/ui/canvas/system-card';
import { ConnectedCanvas } from '@/ui/connected-canvas.client';
import { TextLink } from '@/ui/text';

import { AreaComponentDetail } from './area-component-detail.client';
import { AreaExpandedSystem } from './area-expanded-system.client';
import { areaCanvasEdges } from './area-system-edges';
import { type AreaComponentBox, systemShape } from './area-system-shape';

interface PlacedSystem extends AreaSystemView, AreaSystemBox {
  readonly story?: SystemNarrative;
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
        ? systemShape(system, state.open, system.narratives?.stories[0])
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
  const context = new Map(
    systems.flatMap((system) =>
      state.expanded.has(system.id)
        ? (system.narratives?.stories[0]?.relatedSystems ?? [])
            .filter((id) => !state.expanded.has(id) && systems.some((item) => item.id === id))
            .map((id) => [id, system.id] as const)
        : [],
    ),
  );
  const boxes = new Map(
    layoutAreaSystems(
      systems
        .filter((system) => !context.has(system.id))
        .map((system) => {
          const shape = shapes.get(system.id);
          const hasContext = [...context.values()].includes(system.id);
          return {
            id: system.id,
            width: shape?.width ?? 220,
            height: (shape?.height ?? 150) + (hasContext ? 240 : 0),
          };
        }),
      relationships
        .map((relation) => ({
          ...relation,
          from: context.get(relation.from) ?? relation.from,
          to: context.get(relation.to) ?? relation.to,
        }))
        .filter((relation) => relation.from !== relation.to),
    ).map((box) => [box.id, box]),
  );
  for (const [id, owner] of context) {
    const parent = boxes.get(owner);
    if (parent === undefined) continue;
    const peers = [...context].filter(([, value]) => value === owner).map(([key]) => key);
    const index = peers.indexOf(id);
    boxes.set(id, {
      id,
      x: parent.x + 24 + index * 340,
      y: parent.y + 24,
      width: 300,
      height: 150,
      rank: parent.rank,
    });
  }
  return systems.flatMap((system): readonly PlacedSystem[] => {
    const box = boxes.get(system.id);
    const shape = shapes.get(system.id);
    const story = system.narratives?.stories[0];
    if (box === undefined || shape === undefined) return [];
    return [
      {
        ...system,
        ...(story === undefined ? {} : { story }),
        ...box,
        ...([...context.values()].includes(system.id)
          ? { y: box.y + 240, height: shape.height }
          : {}),
        componentBoxes: shape.components,
        componentRelationships: shape.relationships,
      },
    ];
  });
}

function CollapsedSystem({
  system,
  onExpand,
}: {
  readonly system: PlacedSystem;
  readonly onExpand: () => void;
}) {
  return (
    <foreignObject height={system.height} width={system.width} x={system.x} y={system.y}>
      <SystemCard
        name={system.name}
        purpose={system.purpose}
        meta={`${String(system.components.length)} components`}
        onExpand={onExpand}
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
  const [flows, setFlows] = useState<ReadonlyMap<string, string>>(() => new Map());
  const [onlyFlows, setOnlyFlows, toggleOnlyFlow] = useToggleSet();
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(() => new Set());
  const [selected, setSelected] = useState<ReadonlyMap<string, string>>(() => new Map());
  const [detail, setDetail] = useState<'grouped' | 'all'>('grouped');
  const [endpoint, setEndpoint] = useState<string>();
  const [opened, setOpened] = useState<string>();
  const [open, setOpen, toggleOpen] = useToggleSet();
  const systems = placed(view.systems, view.relationships, {
    expanded,
    selected,
    open,
  });
  const highlights = new Map(
    view.systems.map((system) => {
      const flow = system.narratives?.stories.find((story) => story.id === flows.get(system.id));
      return [
        system.id,
        flow === undefined
          ? undefined
          : new Set(flow.stages.flatMap((stage) => [stage.component, ...stage.supporting])),
      ];
    }),
  );
  const drawn = systems.map((system) => ({
    ...system,
    componentBoxes:
      onlyFlows.has(system.id) && highlights.get(system.id) !== undefined
        ? system.componentBoxes.filter((box) => highlights.get(system.id)?.has(box.id) === true)
        : system.componentBoxes,
  }));
  const edges = areaCanvasEdges({ view, systems: drawn, expanded, detail, selected }).map(
    (edge) => {
      const focused = [...highlights.values()].filter((ids) => ids !== undefined);
      return focused.length === 0 ||
        focused.some((ids) => ids.has(edge.from ?? '') && ids.has(edge.to ?? ''))
        ? edge
        : { ...edge, context: true };
    },
  );
  const bounds = areaSystemBounds(systems);
  const size = {
    width: Math.max(bounds.width, ...edges.map((edge) => edge.x + 100)),
    height: Math.max(bounds.height, ...edges.map((edge) => edge.y + 48)),
  };
  const toggleSystem = (id: string): void => {
    setOpened(expanded.has(id) ? undefined : id);
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
    setOnlyFlows(new Set());
    setOpen((current) => new Set([...current, destination.component.id]));
    setSelected(new Map([[destination.system.id, id]]));
    setEndpoint(id);
  };
  const inspected = selectedComponent(systems, selected);
  const openedSystem = systems.find((system) => system.id === opened && expanded.has(system.id));
  const contextHeight = (openedSystem?.story?.relatedSystems?.length ?? 0) > 0 ? 240 : 0;
  const selectEdge = (id: string): void => {
    const relation = edges.find((edge) => edge.id === id)?.relations?.[0];
    if (relation === undefined) return;
    setExpanded((current) => new Set([...current, relation.toSystem]));
    setOpen((current) => new Set([...current, ownerOf(view, relation.to)]));
    setSelected(new Map([[relation.toSystem, relation.to]]));
    setEndpoint(relation.endpointId ?? undefined);
  };
  return (
    <ConnectedCanvas
      detail={detail}
      endpoint={endpoint}
      edges={edges}
      focus={
        activeFocus(systems, selected) ??
        (openedSystem === undefined
          ? null
          : {
              ...openedSystem,
              y: openedSystem.y - contextHeight,
              height: openedSystem.height + contextHeight,
              fit: true,
            })
      }
      height={size.height}
      inspector={
        inspected === undefined ? undefined : (
          <AreaComponentDetail
            component={inspected}
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
        setFlows(new Map());
        setOnlyFlows(new Set());
        setExpanded(new Set());
        setOpen(new Set());
        setSelected(new Map());
        setEndpoint(undefined);
        setOpened(undefined);
      }}
      selected={inspected?.id}
      width={size.width}
    >
      {drawn.map((system) =>
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
            flow={flows.get(system.id) ?? ''}
            highlighted={highlights.get(system.id)}
            onlyFlow={onlyFlows.has(system.id)}
            onOnlyFlow={() => {
              toggleOnlyFlow(system.id);
              setSelected(new Map());
            }}
            onFlowChange={(id) => {
              setFlows((current) => new Map([...current, [system.id, id]]));
              setSelected(new Map());
            }}
            onSelectEndpoint={setEndpoint}
            onSelectResource={revealResource}
            onToggleOpen={toggleOpen}
            system={system}
          />
        ) : (
          <CollapsedSystem
            key={system.id}
            onExpand={() => {
              toggleSystem(system.id);
            }}
            system={system}
          />
        ),
      )}
    </ConnectedCanvas>
  );
}
