import { resourceLocation } from '@/application/area-map/component-summary';
import {
  AREA_HEADER,
  AREA_INSET as INSET,
  type ConnectionScope,
} from '@/application/area-map/landscape-calls';
import { valueFlowLayout } from '@/application/area-map/value-flow-layout';
import { areaWithoutInfrastructure, type AreaView } from '@/application/workspace-area';
import type { AreaMapNode } from '@/application/workspace-landscape-areas';
import type { LandscapeValueFlow } from '@/domain/landscape';
import type { CardSelection } from '@/ui/canvas/component-card';
import { SystemBoundaryHeader } from '@/ui/canvas/system-card';
import { CanvasBoundary, CanvasSystemScope } from '@/ui/connected-canvas-parts';
import { Stack } from '@/ui/stack';
import { Text, TextLink } from '@/ui/text';

import { ValueNode } from './area-value-map.client';

export interface AreaDrawingState {
  readonly expanded: ReadonlySet<string>;
  readonly cards: ReadonlySet<string>;
  readonly selected?: string | null;
  readonly endpoint?: string | null;
}

function narrativeOf(view: AreaView): LandscapeValueFlow {
  if (view.valueFlow !== undefined) return view.valueFlow;
  return {
    title: view.area.name,
    summary: view.area.purpose,
    confidence: view.area.confidence ?? 'low',
    reasoning: '',
    limitations: [],
    bands: [],
    connections: [],
  };
}

export function landscapeHoverId(area: string, system: string, node?: string): string {
  return JSON.stringify([area, system, node]);
}

export function drawingOf(view: AreaView, state: AreaDrawingState) {
  const cards = new Set(state.cards);
  for (const system of view.systems) {
    for (const group of system.componentGroups ?? []) {
      if (group.members.some((member) => cards.has(member))) cards.add(`card:${group.id}`);
    }
    for (const component of system.components) {
      if (component.parentComponent !== undefined && state.cards.has(component.id)) {
        cards.add(component.parentComponent);
      }
    }
  }
  const canvas = areaWithoutInfrastructure(view);
  const layout = valueFlowLayout(canvas, narrativeOf(canvas), state.expanded, cards, true);
  return {
    ...layout,
    width: layout.width + INSET * 2,
    height: layout.height + AREA_HEADER + INSET * 2,
  };
}

type Drawing = ReturnType<typeof drawingOf>;

export function systemFrame(area: AreaMapNode, drawing: Drawing | null | undefined, id: string) {
  const box =
    drawing?.groups.find((group) => group.id === id) ??
    drawing?.nodes.find((node) => node.collapsed && node.systemId === id);
  if (box === undefined) return null;
  return {
    x: area.x + INSET + box.x,
    y: area.y + AREA_HEADER + INSET + box.y,
    width: box.width,
    height: 70,
  };
}

function toggled(set: ReadonlySet<string>, id: string): ReadonlySet<string> {
  const next = new Set(set);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  return next;
}

export function LandscapeAreaDrawing({
  area,
  view,
  drawing,
  state,
  selectionFor,
  closeScope,
  update,
}: {
  readonly area: AreaMapNode;
  readonly view: AreaView;
  readonly drawing: Drawing;
  readonly state: AreaDrawingState;
  readonly selectionFor: (scope: ConnectionScope) => CardSelection;
  readonly closeScope: (scope: ConnectionScope) => void;
  readonly update: (state: AreaDrawingState) => void;
}) {
  const systems = new Map(
    view.systems.map((system, index) => [system.id, { system, colour: (index % 13) + 1 }]),
  );
  const revealResource = (id: string): void => {
    const destination = resourceLocation(view.systems, id);
    if (destination === null) return;
    update({
      ...state,
      expanded: new Set([...state.expanded, destination.system.id]),
      cards: new Set([...state.cards, destination.component.id]),
      selected: id,
      endpoint: id,
    });
  };
  return (
    <g transform={`translate(${String(area.x + INSET)} ${String(area.y + AREA_HEADER + INSET)})`}>
      {drawing.groups.map((group) => (
        <CanvasSystemScope key={group.id} colour={systems.get(group.id)?.colour ?? 1}>
          <CanvasBoundary
            {...group}
            hoverId={landscapeHoverId(area.id, group.id)}
            header={
              <SystemBoundaryHeader
                name={group.name}
                actions={
                  <TextLink href={systems.get(group.id)?.system.href ?? area.href}>
                    View whole system
                  </TextLink>
                }
                purpose={group.purpose}
                selection={selectionFor({ area: area.id, system: group.id })}
                onCollapse={() => {
                  closeScope({ area: area.id, system: group.id });
                  update({
                    ...state,
                    expanded: toggled(state.expanded, group.id),
                  });
                }}
              />
            }
          />
        </CanvasSystemScope>
      ))}
      {drawing.headings.map((heading) => (
        <foreignObject
          key={`${heading.id}:${String(heading.x)}:${String(heading.y)}`}
          x={heading.x}
          y={heading.y}
          width={heading.width}
          height={heading.height}
        >
          <Stack gap={1}>
            <Text as="h3" size="lg" weight="strong">
              {heading.title}
            </Text>
            <Text size="sm" tone="muted">
              {heading.summary}
            </Text>
          </Stack>
        </foreignObject>
      ))}
      {drawing.nodes.map((node) => (
        <CanvasSystemScope key={node.id} colour={systems.get(node.systemId)?.colour ?? 1}>
          <ValueNode
            node={node}
            hoverId={landscapeHoverId(area.id, node.systemId, node.collapsed ? undefined : node.id)}
            systems={view.systems}
            expanded={state.expanded}
            purpose={systems.get(node.systemId)?.system.purpose}
            active={node.members.includes(state.selected ?? '')}
            muted={!node.collapsed && node.supporting}
            highlighted={false}
            endpoint={
              node.members.includes(state.selected ?? '')
                ? (state.endpoint ?? undefined)
                : undefined
            }
            selection={selectionFor({
              area: area.id,
              system: node.systemId,
              ...(node.collapsed ? {} : { component: node.id }),
            })}
            onExpand={() => {
              update({ ...state, expanded: toggled(state.expanded, node.systemId) });
            }}
            onSelect={() => {
              update({ ...state, selected: node.id, endpoint: null });
            }}
            onToggle={() => {
              update({ ...state, cards: toggled(state.cards, node.id) });
            }}
            onSelectEndpoint={(id) => {
              update({ ...state, selected: node.id, endpoint: id });
            }}
            onSelectResource={revealResource}
          />
        </CanvasSystemScope>
      ))}
    </g>
  );
}
