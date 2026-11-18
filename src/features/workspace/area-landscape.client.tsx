'use client';

import { useEffect, useEffectEvent, useId, useMemo, useRef, useState } from 'react';

import {
  AREA_HEADER,
  type ConnectionScope,
  focusedLandscapeGroups,
  type IntegrationArrow,
  landscapeConnectionsInScope,
  landscapeIntegrationArrows,
  landscapeIntegrationDestination,
  landscapeIntegrationGroups,
  mergeLandscapeCaptions,
  revealTarget,
  sameConnectionScope,
  scopeContains,
} from '@/application/area-map/landscape-calls';
import { unpackAreaMapView } from '@/application/area-map/transport';
import { orthogonalRouteCost } from '@/application/area-routing/route';
import type { AreaView } from '@/application/workspace-area';
import {
  type AreaIntegration,
  type AreaLandscapeView,
  type AreaMapNode,
  expandedAreaLandscape,
  landscapeIntegrations,
} from '@/application/workspace-landscape-areas';
import { plural } from '@/shared/text';
import { Button } from '@/ui/button';
import {
  CanvasEdge,
  CanvasEdgeCaptionControl,
  CanvasEdgeLabel,
  Markers,
} from '@/ui/canvas/canvas-edge';
import { SystemBoundaryHeader, SystemCard } from '@/ui/canvas/system-card';
import { CanvasBoundary } from '@/ui/connected-canvas-parts';
import { NetworkMap } from '@/ui/network-map.client';
import { Stack } from '@/ui/stack';
import { Text, TextLink } from '@/ui/text';

import {
  type AreaDrawingState,
  drawingOf,
  LandscapeAreaDrawing,
  landscapeHoverId,
  systemFrame,
} from './area-landscape-drawing';
import { isAreaMapPayload } from './area-map.client';

type AreaLoad = AreaView | 'loading' | 'failed';
const ignore = (): void => undefined;
const CLOSED: AreaDrawingState = { expanded: new Set(), cards: new Set() };
const EMPTY_SIZE = { width: 460, height: 160 };

function layoutOf(
  view: AreaLandscapeView,
  expanded: ReadonlySet<string>,
  loaded: ReadonlyMap<string, AreaLoad>,
  states: ReadonlyMap<string, AreaDrawingState>,
) {
  const drawings = new Map(
    [...expanded].map((id) => {
      const area = loaded.get(id);
      const state = states.get(id) ?? CLOSED;
      const drawing =
        typeof area === 'object' && area.systems.length > 0 ? drawingOf(area, state) : null;
      return [id, drawing] as const;
    }),
  );
  const sizes = new Map([...drawings].map(([id, drawing]) => [id, drawing ?? EMPTY_SIZE]));
  const records = landscapeIntegrations(view.integrations);
  const layout = expandedAreaLandscape(view, sizes, (candidate) => {
    const groups = focusedLandscapeGroups(landscapeIntegrationGroups(candidate, drawings, records));
    const routes: Pick<IntegrationArrow, 'points'>[] = [];
    const merged = mergeLandscapeCaptions(candidate, groups, undefined, expanded, (rollups) => {
      routes.push(...rollups);
    });
    const { arrows } = landscapeIntegrationArrows(merged.view, drawings, merged.groups);
    return (
      orthogonalRouteCost([...routes, ...arrows], 3) + (merged.groups.length - arrows.length) * 1000
    );
  });
  return { layout, drawings };
}

function AreaStatus({
  load,
  retry,
}: {
  readonly load: AreaLoad | undefined;
  readonly retry: () => void;
}) {
  if (load === 'failed') {
    return (
      <Stack gap={1}>
        <Text size="sm">Could not load the area map.</Text>
        <Button size="sm" onClick={retry}>
          Retry
        </Button>
      </Stack>
    );
  }
  return (
    <Text as="p" size="sm" tone="muted">
      {typeof load === 'object' ? 'No system map yet.' : 'Loading the area map…'}
    </Text>
  );
}

type IntegrationGroups = ReturnType<typeof landscapeIntegrationGroups>;

function IntegrationArrows({
  edges,
  highlighted,
  select,
}: {
  readonly edges: readonly IntegrationArrow[];
  readonly highlighted: ReadonlySet<string> | null;
  readonly select: (id: string) => void;
}) {
  const marker = useId().replaceAll(':', '');
  return (
    <g aria-label="Recorded integrations">
      <Markers marker={marker} />
      {edges.map((edge) => (
        <CanvasEdge
          key={edge.id}
          edge={edge}
          marker={marker}
          bidirectional={edge.bidirectional === true}
          lit={highlighted?.has(edge.id) === true}
          muted={highlighted !== null && !highlighted.has(edge.id)}
          onEnter={ignore}
          onLeave={ignore}
          onSelect={select}
        />
      ))}
      {edges.map((edge) => (
        <CanvasEdgeCaptionControl
          key={edge.id}
          edge={edge}
          lit={highlighted?.has(edge.id) === true}
          muted={highlighted !== null && !highlighted.has(edge.id)}
          onSelect={select}
        />
      ))}
    </g>
  );
}

function SelectedIntegrationArrow({ edge }: { readonly edge: IntegrationArrow }) {
  const marker = useId().replaceAll(':', '');
  return (
    <g aria-label="Selected integration">
      <Markers marker={marker} />
      <CanvasEdge
        edge={edge}
        marker={marker}
        lit
        muted={false}
        onEnter={ignore}
        onLeave={ignore}
        onSelect={undefined}
      />
      <CanvasEdgeLabel edge={edge} lit muted={false} />
    </g>
  );
}

function integrationGroupLabel(
  item: IntegrationGroups[number],
  focus: AreaMapNode | undefined,
): string {
  const ends = `${item.from.name} ↔ ${item.to.name}`;
  const peer = item.from.id === focus?.id ? item.to.name : item.from.name;
  const title = focus !== undefined && [item.from.id, item.to.id].includes(focus.id) ? peer : ends;
  return `${item.caption ?? ''} · ${title}`;
}

function hoverScopes(
  id: string,
  drawings: ReadonlyMap<string, ReturnType<typeof drawingOf> | null>,
): readonly ConnectionScope[] {
  for (const [area, drawing] of drawings) {
    if (drawing === null) continue;
    const node = drawing.nodes.find(
      (item) => landscapeHoverId(area, item.systemId, item.collapsed ? undefined : item.id) === id,
    );
    if (node !== undefined && !node.collapsed) {
      return node.members.map((component) => ({ area, system: node.systemId, component }));
    }
    const system =
      node?.systemId ?? drawing.groups.find((group) => landscapeHoverId(area, group.id) === id)?.id;
    if (system !== undefined) return [{ area, system }];
  }
  return [{ area: id }];
}

function highlightedLandscapeEdges(
  scopes: readonly ConnectionScope[],
  groups: IntegrationGroups,
  merged: ReadonlyMap<string, string>,
): ReadonlySet<string> {
  const matching = new Set(
    groups
      .filter(({ members }) =>
        scopes.some((scope) => landscapeConnectionsInScope(members, [scope]).length > 0),
      )
      .map(({ id }) => id),
  );
  return new Set([
    ...matching,
    ...[...merged].flatMap(([edge, group]) => (matching.has(group) ? [edge] : [])),
  ]);
}

function useConnectionFocus(
  view: AreaLandscapeView,
  groups: IntegrationGroups,
  member: string | null,
) {
  const [picked, setPicked] = useState<readonly ConnectionScope[]>([]);
  const scopes = useMemo(
    () => picked.filter(({ area }) => view.nodes.some(({ id }) => id === area)),
    [view.nodes, picked],
  );
  const first = scopes[0];
  const focused = view.nodes.find(({ id }) => id === first?.area);
  const visible = useMemo(() => {
    const scoped = groups.flatMap((group) => {
      const members = landscapeConnectionsInScope(group.members, scopes);
      return members.length === 0 ? [] : [{ ...group, members }];
    });
    return focusedLandscapeGroups(scoped, first);
  }, [groups, scopes, first]);
  const selected = visible.find((item) => item.members.some(({ id }) => id === member));
  const routed = useMemo(
    () => (selected === undefined ? visible : [selected]),
    [selected, visible],
  );
  return {
    area: focused,
    scopes,
    visible,
    selected,
    routed,
    toggle: (scope: ConnectionScope): void => {
      setPicked((current) =>
        current.some((item) => sameConnectionScope(item, scope))
          ? current.filter((item) => !sameConnectionScope(item, scope))
          : [
              ...current.filter(
                (item) => !scopeContains(item, scope) && !scopeContains(scope, item),
              ),
              scope,
            ],
      );
    },
    close: (scope: ConnectionScope): void => {
      setPicked((current) =>
        current.filter((item) => !scopeContains(scope, item) || sameConnectionScope(scope, item)),
      );
    },
  };
}

function IntegrationList({
  groups,
  group,
  focus,
  select,
  open,
  clear,
}: {
  readonly groups: IntegrationGroups;
  readonly group: IntegrationGroups[number] | undefined;
  readonly focus: AreaMapNode | undefined;
  readonly clear: () => void;
  readonly select: (id: string) => void;
  readonly open: (integration: AreaIntegration) => void;
}) {
  if (groups.length === 0) {
    return focus === undefined ? null : (
      <Text as="p">No recorded connections for the selected cards.</Text>
    );
  }
  return (
    <details open={group !== undefined || focus !== undefined ? true : undefined}>
      <summary>{plural(groups.length, 'recorded integration group')}</summary>
      <Stack gap={1}>
        {group === undefined ? null : (
          <Button size="sm" onClick={clear}>
            Clear integration selection
          </Button>
        )}
        {groups.map((item) => (
          <div key={item.id} data-integration-group={item.id}>
            <Button
              size="sm"
              pressed={item === group}
              onClick={() => {
                select(item.id);
              }}
            >
              {integrationGroupLabel(item, focus)}
            </Button>
          </div>
        ))}
        {group?.members.map((member) => (
          <div key={member.id} data-integration-member={member.id}>
            <Button
              size="sm"
              onClick={() => {
                open(member);
              }}
            >
              {member.detail} · {member.kind} · {member.signature}
            </Button>
          </div>
        ))}
      </Stack>
    </details>
  );
}

function showIntegration(
  current: ReadonlyMap<string, AreaDrawingState>,
  call: AreaIntegration,
): ReadonlyMap<string, AreaDrawingState> {
  const result = new Map(current);
  for (const [area, system] of [
    [call.callerArea, call.callerSystem],
    [call.providerArea, call.providerSystem],
  ] as const) {
    const prior = result.get(area) ?? CLOSED;
    result.set(area, { ...prior, expanded: new Set([...prior.expanded, system]) });
  }
  if (call.callerEndpoint !== undefined) {
    const caller = result.get(call.callerArea) ?? CLOSED;
    result.set(call.callerArea, { ...caller, cards: new Set([...caller.cards, call.caller]) });
  }
  const target = revealTarget(call);
  const state = result.get(target.area) ?? CLOSED;
  return result.set(target.area, {
    ...state,
    cards: new Set([...state.cards, target.component]),
    selected: target.component,
    endpoint: target.row,
  });
}

async function areaDetail(response: Response, area: string, href: string): Promise<AreaView> {
  if (!response.ok) throw new Error('Area map unavailable');
  const body: unknown = await response.json();
  if (!isAreaMapPayload(body, area) || body.workspace.href !== href) {
    throw new Error('Unexpected area map');
  }
  return unpackAreaMapView(body);
}

function useLandscapeDetails(view: AreaLandscapeView, expanded: ReadonlySet<string>) {
  const [loaded, setLoaded] = useState<ReadonlyMap<string, AreaLoad>>(() => new Map());
  const load = (node: AreaMapNode): void => {
    const save = (result: AreaLoad): void => {
      setLoaded((current) => new Map(current).set(node.id, result));
    };
    save('loading');
    void fetch(`${node.href}map.json`)
      .then(async (response) => {
        save(await areaDetail(response, node.id, view.href));
      })
      .catch(() => {
        save('failed');
      });
  };
  const loadExpanded = useEffectEvent(() => {
    for (const node of view.nodes) {
      if (expanded.has(node.id) && !loaded.has(node.id)) load(node);
    }
  });
  useEffect(() => {
    loadExpanded();
  }, [expanded]);
  return { loaded, load };
}

function selectionChanged(
  integration: AreaIntegration | null,
  area: string,
  prior: AreaDrawingState | undefined,
  next: AreaDrawingState,
): boolean {
  if (integration === null || next.endpoint === prior?.endpoint) return false;
  const target = revealTarget(integration);
  if (next.endpoint === target.row) return false;
  return typeof next.endpoint === 'string' || target.area === area;
}

function PlacementIssues({ issues }: { readonly issues: readonly string[] }) {
  if (issues.length === 0) return null;
  return (
    <details>
      <summary>Placement issues</summary>
      <ul>
        {issues.map((issue) => (
          <li key={issue}>{issue}</li>
        ))}
      </ul>
    </details>
  );
}

function SelectedIntegrationDetail({
  integration,
  reveal,
}: {
  readonly integration: AreaIntegration | undefined;
  readonly reveal: (integration: AreaIntegration) => void;
}) {
  if (integration === undefined) return null;
  return (
    <Stack gap={1}>
      <Text as="p" weight="strong" mono>
        {integration.signature}
      </Text>
      <Text as="p" size="sm" tone="muted">
        {integration.detail}
      </Text>
      <Button
        size="sm"
        onClick={() => {
          reveal(integration);
        }}
      >
        Reveal on map
      </Button>
    </Stack>
  );
}

/** Expanded areas and their contents share the overview's coordinates and viewport. */
interface SystemPosition {
  readonly area: string;
  readonly system: string;
  readonly open: boolean;
  readonly previousPosition: { readonly x: number; readonly y: number };
}

function landscapeSystemFocus(
  layout: AreaLandscapeView,
  drawings: ReadonlyMap<string, ReturnType<typeof drawingOf> | null>,
  anchor: SystemPosition | undefined,
) {
  if (anchor === undefined) return null;
  const area = layout.nodes.find(({ id }) => id === anchor.area);
  if (area === undefined) return null;
  const frame = systemFrame(area, drawings.get(area.id), anchor.system);
  return frame === null
    ? null
    : {
        ...frame,
        id: JSON.stringify([anchor.area, anchor.system, anchor.open]),
        previousPosition: anchor.previousPosition,
      };
}

/** The areas of activity, each expanding in place to the systems and integrations behind it. */
export function AreaLandscape({ view }: { readonly view: AreaLandscapeView }) {
  const [exchange, setExchange] = useState<string | null>(null);
  const [groupMember, setGroupMember] = useState<string | null>(null);
  const [selection, setSelection] = useState<AreaIntegration | null>(null);
  const member = selection?.id ?? null;
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(() => new Set());
  const { loaded, load } = useLandscapeDetails(view, expanded);
  const [states, setStates] = useState<ReadonlyMap<string, AreaDrawingState>>(() => new Map());
  const records = useMemo(() => landscapeIntegrations(view.integrations), [view.integrations]);
  const active = records.find(({ id }) => id === member);
  const wrapper = useRef<HTMLDivElement>(null);
  const [systemAnchor, setSystemAnchor] = useState<SystemPosition>();
  const moved = useRef<string | null>(null);
  const { layout, drawings } = useMemo(
    () => layoutOf(view, expanded, loaded, states),
    [view, expanded, loaded, states],
  );
  useEffect(() => {
    if (moved.current === null) return;
    const node = wrapper.current?.querySelector<HTMLElement>(
      `[data-network-node="${CSS.escape(moved.current)}"]`,
    );
    if (member === null) {
      node?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    }
    node?.querySelector<HTMLElement>('button')?.focus({ preventScroll: true });
    moved.current = null;
  }, [expanded, member]);
  const groups = useMemo(
    () => landscapeIntegrationGroups(layout, drawings, records),
    [layout, drawings, records],
  );
  const connectionFocus = useConnectionFocus(view, groups, groupMember);
  const toggle = (node: AreaMapNode): void => {
    moved.current = node.id;
    setSystemAnchor(undefined);
    if (expanded.has(node.id)) connectionFocus.close({ area: node.id });
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(node.id)) next.delete(node.id);
      else next.add(node.id);
      return next;
    });
  };
  const { visible: visibleGroups } = connectionFocus;
  const { selected: group, routed, area: focusedArea } = connectionFocus;
  const merged = useMemo(
    () => mergeLandscapeCaptions(layout, routed, focusedArea?.id, expanded),
    [layout, routed, focusedArea, expanded],
  );
  const activeGroup = groups.find((item) => item.members.some(({ id }) => id === member));
  const { arrows: integrationArrows, selected: selectedArrow } = useMemo(() => {
    const expandedRollup =
      activeGroup !== undefined &&
      expanded.has(activeGroup.from.id) &&
      expanded.has(activeGroup.to.id);
    const selected =
      active === undefined || activeGroup === undefined || expandedRollup
        ? undefined
        : { group: activeGroup, member: active };
    return landscapeIntegrationArrows(merged.view, drawings, merged.groups, selected);
  }, [merged, active, activeGroup, drawings, expanded]);
  const openAreas = (calls: readonly AreaIntegration[]): void => {
    const ids = new Set(
      calls.flatMap(({ callerArea, providerArea }) => [callerArea, providerArea]),
    );
    setExpanded((current) => new Set([...current, ...ids]));
  };
  const clearIntegration = (): void => {
    if (selection !== null) {
      setStates((current) => {
        const target = revealTarget(selection);
        const state = current.get(target.area);
        return state?.endpoint === target.row
          ? new Map(current).set(target.area, { ...state, selected: null, endpoint: null })
          : current;
      });
    }
    setGroupMember(null);
    setSelection(null);
    setExchange(null);
  };
  const selectGroup = (id: string): void => {
    const target = visibleGroups.find((item) => item.id === id);
    if (selection !== null && target !== activeGroup) clearIntegration();
    setGroupMember(target?.members[0]?.id ?? null);
  };
  const selectionFor = (scope: ConnectionScope) => ({
    pressed: connectionFocus.scopes.some((item) => sameConnectionScope(item, scope)),
    toggle: () => {
      clearIntegration();
      connectionFocus.toggle(scope);
    },
  });
  const openIntegration = (integration: AreaIntegration): void => {
    setSystemAnchor(undefined);
    setSelection(integration);
    setGroupMember(integration.id);
    openAreas([integration]);
    setStates((current) => showIntegration(current, integration));
  };
  const exchangeMembers = new Set(exchange === null ? [] : view.exchanges[exchange]);
  const selectedCalls = records.filter(({ id }) => exchangeMembers.has(id));
  const destination =
    active === undefined ? null : landscapeIntegrationDestination(layout, drawings, active);
  const integrationFocus =
    destination === null ? null : { ...destination, id: JSON.stringify([member]), readable: true };
  const focus = landscapeSystemFocus(layout, drawings, systemAnchor) ?? integrationFocus;
  return (
    <div ref={wrapper}>
      <SelectedIntegrationDetail integration={active} reveal={openIntegration} />
      <PlacementIssues issues={view.placementIssues} />
      {exchange !== null && member === null ? (
        <Stack gap={1}>
          {selectedCalls.map((call) => (
            <Button
              key={call.id}
              size="sm"
              label={`Explore ${call.signature}`}
              onClick={() => {
                openIntegration(call);
              }}
            >
              {call.signature}
            </Button>
          ))}
        </Stack>
      ) : null}
      <NetworkMap
        label="Areas of activity and the major relationships between them"
        view={merged.view}
        focus={focus}
        filtering={connectionFocus.scopes.length > 0}
        interactiveEdges={new Set([...Object.keys(view.exchanges), ...merged.merged.keys()])}
        bidirectionalEdges={merged.bidirectional}
        muteEdges={group !== undefined && ![...merged.merged.values()].includes(group.id)}
        onEdge={(id) => {
          clearIntegration();
          if (view.exchanges[id] === undefined) selectGroup(merged.merged.get(id) ?? '');
          else setExchange(id);
        }}
        hoverEdges={(id) =>
          highlightedLandscapeEdges(hoverScopes(id, drawings), routed, merged.merged)
        }
        renderOverlay={(highlighted) => (
          <>
            <IntegrationArrows
              edges={integrationArrows}
              highlighted={highlighted}
              select={selectGroup}
            />
            {selectedArrow === null ? null : <SelectedIntegrationArrow edge={selectedArrow} />}
          </>
        )}
        renderExpanded={(node) => {
          if (!expanded.has(node.id)) return null;
          const drawing = drawings.get(node.id);
          const area = loaded.get(node.id);
          return (
            <g data-area-boundary={node.id}>
              <CanvasBoundary
                {...node}
                headerHeight={AREA_HEADER}
                hoverId={node.id}
                header={
                  <div data-network-node={node.id}>
                    <SystemBoundaryHeader
                      kind="Area"
                      name={node.name}
                      purpose={node.purpose}
                      onCollapse={() => {
                        toggle(node);
                      }}
                      selection={selectionFor({ area: node.id })}
                      actions={<TextLink href={node.href}>Drill down</TextLink>}
                    />
                  </div>
                }
              />
              {drawing && typeof area === 'object' ? (
                <LandscapeAreaDrawing
                  area={node}
                  view={area}
                  drawing={drawing}
                  state={states.get(node.id) ?? CLOSED}
                  selectionFor={selectionFor}
                  closeScope={connectionFocus.close}
                  update={(state) => {
                    const prior = states.get(node.id) ?? CLOSED;
                    const system = [...prior.expanded, ...state.expanded].find(
                      (id) => prior.expanded.has(id) !== state.expanded.has(id),
                    );
                    if (system !== undefined) {
                      const previousPosition = systemFrame(node, drawing, system);
                      if (previousPosition !== null) {
                        setSystemAnchor({
                          area: node.id,
                          system,
                          open: state.expanded.has(system),
                          previousPosition,
                        });
                      }
                    }
                    if (selectionChanged(selection, node.id, prior, state)) setSelection(null);
                    setStates((current) => new Map(current).set(node.id, state));
                  }}
                />
              ) : (
                <foreignObject
                  x={node.x + 16}
                  y={node.y + AREA_HEADER + 8}
                  width={node.width - 32}
                  height={node.height - AREA_HEADER - 8}
                >
                  <AreaStatus
                    load={area}
                    retry={() => {
                      load(node);
                    }}
                  />
                </foreignObject>
              )}
            </g>
          );
        }}
        renderNode={(node, muted) => (
          <SystemCard
            kind="Area"
            name={node.name}
            purpose={node.purpose}
            meta={plural(node.systemCount, 'system')}
            details={<TextLink href={node.href}>Drill down</TextLink>}
            selection={selectionFor({ area: node.id })}
            muted={muted}
            onExpand={() => {
              toggle(node);
            }}
          >
            <Stack gap={1}>
              {node.activities.map((activity) => (
                <Text key={activity} size="sm" tone="muted" clamp={1}>
                  {activity}
                </Text>
              ))}
            </Stack>
          </SystemCard>
        )}
      />
      <IntegrationList
        groups={visibleGroups}
        group={group}
        focus={connectionFocus.area}
        select={selectGroup}
        open={openIntegration}
        clear={clearIntegration}
      />
    </div>
  );
}
