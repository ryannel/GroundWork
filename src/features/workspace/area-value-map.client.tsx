'use client';

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import { areaBoundaryOf } from '@/application/area-map/boundaries';
import { resourceLocation } from '@/application/area-map/component-summary';
import { platformComponents } from '@/application/area-map/platform';
import {
  valueFlowConnections,
  type ValueFlowConnection,
} from '@/application/area-map/value-flow-connections';
import { valueFlowLayout, type ValueFlowNode } from '@/application/area-map/value-flow-layout';
import { routeValueFlows } from '@/application/area-map/value-flow-routing';
import { defaultValueFlowConnections } from '@/application/area-map/value-flow-visibility';
import type { AreaBoundaryView, AreaSystemView, AreaView } from '@/application/workspace-area';
import type { LandscapeValueFlow } from '@/domain/landscape';
import { replaceAddress } from '@/ui/address-bar';
import { Button } from '@/ui/button';
import type { CardSelection } from '@/ui/canvas/component-card';
import { SystemBoundaryHeader, SystemCard } from '@/ui/canvas/system-card';
import {
  CanvasBoundary,
  CanvasSystemScope,
  ConnectedCanvas,
  type ConnectedCanvasFocus,
} from '@/ui/connected-canvas.client';
import { Select } from '@/ui/select';
import { Cluster, Stack } from '@/ui/stack';
import { Text, TextLink } from '@/ui/text';

import { AreaBoundaryCard } from './area-boundary-card';
import { AreaComponentDetail } from './area-component-detail.client';
import { ComponentCluster } from './area-expanded-system.client';
import { AreaSystemMap } from './area-system-map.client';
import { useAreaSystemSelection } from './area-system-selection';
import { selectedFlowFrame } from './area-value-focus';

function systemPurpose(purpose: string, supporting: boolean): string {
  if (purpose !== '') return purpose;
  return supporting ? 'Purpose not described yet.' : 'Expand to follow the work inside';
}

export function ValueNode({
  node,
  boundary,
  purpose = '',
  active,
  muted,
  hoverId,
  ports,
  highlighted,
  onSelect,
  onExpand,
  selection,
  localDetails,
  onToggle,
  endpoint,
  onSelectEndpoint,
  onSelectResource,
  systems,
  expanded,
}: {
  readonly boundary?: AreaBoundaryView | undefined;
  readonly systems: readonly AreaSystemView[];
  readonly expanded: ReadonlySet<string>;
  readonly node: ValueFlowNode;
  readonly purpose: string | undefined;
  readonly active: boolean;
  readonly muted: boolean;
  readonly hoverId?: string;
  /** Report the endpoint row under the pointer with the hover id, for maps that light single endpoints. */
  readonly ports?: '' | undefined;
  readonly highlighted: boolean;
  readonly onSelect: () => void;
  readonly onExpand?: () => void;
  readonly selection?: CardSelection | undefined;
  readonly localDetails?: boolean | undefined;
  readonly onToggle: () => void;
  readonly endpoint: string | undefined;
  readonly onSelectEndpoint: (id: string) => void;
  readonly onSelectResource: (id: string) => void;
}) {
  const content = node.collapsed ? (
    <SystemCard
      name={node.system}
      purpose={systemPurpose(purpose, node.supporting)}
      onExpand={onExpand ?? onSelect}
      selection={selection}
      meta={`${
        node.activities !== undefined && node.activities.length > 3
          ? `+${String(node.activities.length - 3)} more flows · `
          : ''
      }${String(node.members.length)} components`}
      muted={muted}
      highlighted={highlighted}
    >
      {(node.activities ?? []).length === 0 ? null : (
        <Stack gap={1}>
          {(node.activities ?? []).slice(0, 3).map((activity) => (
            <Text key={activity} size="sm" tone="muted" clamp={1}>
              {activity}
            </Text>
          ))}
        </Stack>
      )}
    </SystemCard>
  ) : (
    <ComponentCluster
      component={{ ...node.component, ...node, compact: false, open: node.open === true }}
      active={active}
      muted={muted}
      highlighted={highlighted}
      onOpen={onSelect}
      selection={selection}
      localDetails={localDetails}
      onToggle={onToggle}
      handlers={{ endpoint, onSelectEndpoint, onSelectResource, systems, expanded }}
    />
  );
  return (
    <foreignObject
      data-component={hoverId ?? node.id}
      data-ports={ports}
      data-flow={highlighted ? '' : undefined}
      x={node.x}
      y={node.y}
      width={node.width}
      height={node.height}
    >
      {boundary === undefined ? (
        content
      ) : (
        <AreaBoundaryCard
          boundary={boundary}
          muted={muted}
          highlighted={highlighted}
          onSelect={onSelect}
        />
      )}
    </foreignObject>
  );
}

function selectedComponent(nodes: readonly ValueFlowNode[], selected: string | undefined) {
  const active = nodes.find((node) => node.members.includes(selected ?? ''));
  const inspected =
    active?.component.attachments?.find((resource) => resource.id === selected) ??
    active?.component;
  return { active, inspected };
}

function exploredConnection(
  edge: ValueFlowConnection,
  open: ReadonlySet<string>,
  selected: string | undefined,
): boolean {
  if (open.has(edge.from) || open.has(edge.to)) return true;
  return edge.relations.some((relation) => relation.from === selected || relation.to === selected);
}

function contextualConnection(
  edge: ValueFlowConnection,
  nodes: ReadonlyMap<string, ValueFlowNode>,
  expanded: ReadonlySet<string>,
) {
  return expanded.size > 0 && nodes.get(edge.from)?.systemId !== nodes.get(edge.to)?.systemId;
}

function selectedCoreConnections(
  narrative: LandscapeValueFlow,
  band: LandscapeValueFlow['bands'][number] | undefined,
): LandscapeValueFlow['connections'] {
  if (band === undefined) return [];
  const ids = new Set(band.nodes.map((node) => node.component));
  return narrative.connections.filter((edge) => ids.has(edge.from) && ids.has(edge.to));
}

function selectedFlowConnection(
  edge: ValueFlowConnection,
  connections: LandscapeValueFlow['connections'],
): LandscapeValueFlow['connections'][number] | undefined {
  return connections.find(
    (connection) =>
      connection.kind === edge.kind &&
      edge.relations.some(
        (relation) => relation.from === connection.from && relation.to === connection.to,
      ),
  );
}

function explorationFocus(
  layout: ReturnType<typeof valueFlowLayout>,
  frame: ConnectedCanvasFocus | undefined,
  opened: { readonly id: string; readonly x: number; readonly y: number } | undefined,
  automatic: boolean,
): ConnectedCanvasFocus | null {
  if (!automatic && opened === undefined) return null;
  const group = layout.groups.find(({ id }) => id === opened?.id);
  const card = group ?? layout.nodes.find((node) => node.collapsed && node.systemId === opened?.id);
  if (card !== undefined && opened !== undefined) {
    return {
      ...card,
      height: 70,
      id: JSON.stringify([opened.id, group !== undefined]),
      previousPosition: opened,
    };
  }
  if (frame !== undefined) return frame;
  return {
    id: 'value-start',
    x: 40,
    y: 0,
    width: 1100,
    height: 500,
    readable: true,
    minimumZoom: 0.85,
  };
}

function revisedFocus(focus: ConnectedCanvasFocus | null, revision: number) {
  return focus === null ? null : { ...focus, id: `${focus.id}:${String(revision)}` };
}

function valueCanvasFocus(
  active: ValueFlowNode | undefined,
  selected: string | undefined,
  focus: ConnectedCanvasFocus | null,
  revision: number,
): ConnectedCanvasFocus | null {
  return active === undefined
    ? revisedFocus(focus, revision)
    : { ...active, id: `${active.id}:${selected ?? ''}`, readable: true };
}

function canvasCaption(expanded: boolean): string {
  return expanded
    ? 'Select systems to filter connections. Select a shared resource to reveal it, including inside a collapsed system.'
    : 'Select systems to filter connections. Expand a system to see its components.';
}

function FlowSummary({
  band,
  systems,
  actions,
}: {
  readonly band: LandscapeValueFlow['bands'][number] | undefined;
  readonly systems: readonly string[];
  readonly actions: ReactNode;
}) {
  if (band === undefined) return null;
  return (
    <Stack gap={1}>
      <Cluster spread>
        <Text weight="strong">{band.title}</Text>
        {actions}
      </Cluster>
      <Text size="sm" tone="muted">
        {band.summary}
      </Text>
      <Text size="sm" tone="accent">
        Highlighted systems: {systems.join(' · ')}. Accent lines show this flow; other work stays
        faint.
      </Text>
    </Stack>
  );
}

function flowContext(
  band: LandscapeValueFlow['bands'][number] | undefined,
  nodes: readonly ValueFlowNode[],
  ids: ReadonlySet<string> | undefined,
  actions: ReactNode,
) {
  const systems = [
    ...new Set(nodes.filter((node) => ids?.has(node.id) === true).map((node) => node.system)),
  ];
  return band === undefined ? undefined : (
    <FlowSummary band={band} systems={systems} actions={actions} />
  );
}

/** The work leads; system structure remains available at the same scale further down the canvas. */
function useFlowChoice(initial: string) {
  const [choice, setChoice] = useState({ initial, selected: initial });
  if (choice.initial !== initial) setChoice({ initial, selected: initial });
  useEffect(() => {
    const sync = (): void => {
      const selected = new URL(globalThis.location.href).searchParams.get('flow') ?? '';
      setChoice({ initial, selected });
    };
    globalThis.addEventListener('popstate', sync);
    return () => {
      globalThis.removeEventListener('popstate', sync);
    };
  }, [initial]);
  const choose = (selected: string): void => {
    setChoice({ initial, selected });
  };
  return [choice.selected, choose] as const;
}

function useDetailIntent(
  prepare: (() => Promise<boolean>) | undefined,
  detailReady: boolean | undefined,
) {
  const intent = useRef(0);
  const pendingAction = useRef<{ readonly intent: number; readonly run: () => void } | null>(null);
  const applyPending = (): void => {
    const pending = pendingAction.current;
    pendingAction.current = null;
    if (pending !== null && pending.intent === intent.current) pending.run();
  };
  useEffect(() => {
    if (detailReady === true) applyPending();
  }, [detailReady]);
  const afterReady = (action: () => void): void => {
    if (prepare === undefined || detailReady === true) {
      action();
      return;
    }
    const pending = { intent: intent.current, run: action };
    pendingAction.current = pending;
    void prepare().then((ready) => {
      if (ready && pendingAction.current === pending) applyPending();
    });
  };
  const retireDetail = (): void => {
    intent.current += 1;
  };
  return { retireDetail, afterReady };
}

function bandNodes(
  nodes: readonly ValueFlowNode[],
  band: LandscapeValueFlow['bands'][number] | undefined,
): ReadonlySet<string> | undefined {
  if (band === undefined) return undefined;
  return new Set(
    nodes
      .filter((node) =>
        node.members.some((id) => band.nodes.some((member) => member.component === id)),
      )
      .map((node) => node.id),
  );
}

export function AreaValueMap({
  view,
  narrative,
  prepare,
  detailReady,
  initialFlow = '',
}: {
  readonly view: AreaView;
  readonly narrative: LandscapeValueFlow;
  readonly detailReady?: boolean;
  readonly prepare?: () => Promise<boolean>;
  readonly initialFlow?: string;
}) {
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(() => new Set());
  const systemSelection = useAreaSystemSelection(view.area.id);
  const [technical, setTechnical] = useState(false);
  const [flowChoice, chooseFlow] = useFlowChoice(initialFlow);
  const band = useMemo(
    () => narrative.bands.find((item) => item.id === flowChoice),
    [narrative.bands, flowChoice],
  );
  const flow = band?.id ?? '';
  const [only, setOnly] = useState(false);
  const [allConnections, setAllConnections] = useState(false);
  const [selected, setSelected] = useState<string>();
  const [opened, setOpened] = useState<{
    readonly id: string;
    readonly x: number;
    readonly y: number;
  }>();
  const [endpoint, setEndpoint] = useState<string>();
  const [openCards, setOpenCards] = useState<ReadonlySet<string>>(() => new Set());
  const [frameRevision, setFrameRevision] = useState(0);
  const [automaticFocus, setAutomaticFocus] = useState(true);
  const { retireDetail, afterReady } = useDetailIntent(prepare, detailReady);
  const layout = useMemo(
    () => valueFlowLayout(view, narrative, expanded, openCards, true),
    [view, narrative, expanded, openCards],
  );
  const collapseSystem = (id: string): void => {
    systemSelection.collapse(id);
    setExpanded(new Set([...expanded].filter((system) => system !== id)));
    const group = layout.groups.find((item) => item.id === id);
    setOpened(group === undefined ? undefined : { id, x: group.x, y: group.y });
    setSelected(undefined);
  };
  const platform = useMemo(() => platformComponents(view), [view]);
  const connections = useMemo(
    () => valueFlowConnections(layout.nodes, view.technicalRelationships, platform),
    [layout.nodes, view.technicalRelationships, platform],
  );
  const colours = new Map(
    view.systems
      .toSorted((a, b) => a.id.localeCompare(b.id))
      .map((system, index) => [system.id, (index % 13) + 1]),
  );
  const nodesById = useMemo(
    () => new Map(layout.nodes.map((node) => [node.id, node])),
    [layout.nodes],
  );
  const defaultConnections = useMemo(
    () => defaultValueFlowConnections(connections, layout.nodes),
    [connections, layout.nodes],
  );
  const flowCore = useMemo(() => selectedCoreConnections(narrative, band), [narrative, band]);
  const focusIds = bandNodes(layout.nodes, band);
  const visible = useMemo(
    () =>
      connections.filter((edge) => {
        if (systemSelection.active) {
          const from = nodesById.get(edge.from);
          const to = nodesById.get(edge.to);
          return systemSelection.includes(
            from?.systemId,
            to?.systemId,
            from?.collapsed === false ? from.id : undefined,
            to?.collapsed === false ? to.id : undefined,
          );
        }
        return (
          allConnections ||
          defaultConnections.has(edge.id) ||
          exploredConnection(edge, openCards, selected) ||
          selectedFlowConnection(edge, flowCore) !== undefined
        );
      }),
    [
      connections,
      allConnections,
      defaultConnections,
      openCards,
      selected,
      flowCore,
      nodesById,
      systemSelection,
    ],
  );
  const routes = useMemo(
    () => routeValueFlows(visible, layout.nodes, layout.headings, layout.groups),
    [visible, layout.nodes, layout.headings, layout.groups],
  );
  const edges = routes.map((edge) => {
    const highlighted = selectedFlowConnection(edge, flowCore) !== undefined;
    const context =
      band === undefined
        ? !systemSelection.active && contextualConnection(edge, nodesById, expanded)
        : !highlighted;
    const secondary = context || edge.supporting;
    return {
      ...edge,
      supporting:
        !highlighted && edge.supporting && (!allConnections || edge.kind === 'membership'),
      highlighted,
      pattern: ({ api: 'solid', message: 'dotted', data: 'dashed', membership: 'dotted' } as const)[
        edge.kind
      ],
      context,
      quiet: edge.targetY !== undefined || (!allConnections && secondary),
      platform:
        edge.supporting && !allConnections && !systemSelection.active && edge.platform === true,
    };
  });
  const frame = selectedFlowFrame(
    layout,
    { flow, ids: focusIds, opened: opened?.id },
    routes.filter((edge) => selectedFlowConnection(edge, flowCore) !== undefined),
  );
  const focus = explorationFocus(layout, frame, opened, automaticFocus);
  const { active, inspected } = selectedComponent(layout.nodes, selected);
  const inspectedBoundary = areaBoundaryOf(view, inspected?.id);
  const changeFlow = (id: string): void => {
    retireDetail();
    setAutomaticFocus(false);
    chooseFlow(id);
    setOpened(undefined);
    setSelected(undefined);
    const url = new URL(globalThis.location.href);
    if (id === '') url.searchParams.delete('flow');
    else url.searchParams.set('flow', id);
    // Keep the route's URL current so its next refresh uses this same flow.
    replaceAddress(url);
  };
  const revealResource = (id: string): void => {
    const destination = resourceLocation(view.systems, id);
    if (destination === null) return;
    afterReady(() => {
      setExpanded((current) => new Set([...current, destination.system.id]));
      const card = (destination.system.componentGroups ?? narrative.cards)?.find(({ members }) =>
        members.includes(destination.component.id),
      );
      setOpenCards(
        (current) =>
          new Set([...current, card === undefined ? destination.component.id : `card:${card.id}`]),
      );
      setOnly(false);
      setSelected(id);
      setEndpoint(id);
    });
  };
  return (
    <Stack gap={3}>
      <Cluster>
        <Button
          variant="quiet"
          onClick={() => {
            if (technical) setTechnical(false);
            else {
              afterReady(() => {
                setTechnical(true);
              });
            }
          }}
        >
          {technical ? 'Value flows' : 'System structure'}
        </Button>
      </Cluster>
      {technical ? (
        <AreaSystemMap view={view} />
      ) : (
        <ConnectedCanvas
          controls={
            <Stack gap={2}>
              <Cluster>
                {narrative.bands.length < 2 ? null : (
                  <Select
                    label="Follow a value flow"
                    value={flow}
                    options={[
                      { value: '', label: 'All value flows' },
                      ...narrative.bands.map((item) => ({ value: item.id, label: item.title })),
                    ]}
                    onChange={changeFlow}
                  />
                )}
                <Button
                  pressed={allConnections}
                  onClick={() => {
                    if (allConnections) setAllConnections(false);
                    else {
                      afterReady(() => {
                        setAllConnections(true);
                      });
                    }
                  }}
                >
                  All connections
                </Button>
                <Text size="sm" tone="muted">
                  {allConnections
                    ? 'All recorded connections are shown. Select a component to follow its relationships.'
                    : 'Some connections are hidden to keep the map readable. Show all connections for the detail.'}
                </Text>
              </Cluster>
              <Cluster>
                {layout.groups.map((group) => (
                  <Button
                    key={group.id}
                    label={`Collapse ${group.name} from overview`}
                    onClick={() => {
                      collapseSystem(group.id);
                    }}
                  >
                    <span aria-hidden="true">−</span> Collapse {group.name}
                  </Button>
                ))}
              </Cluster>
            </Stack>
          }
          legend={[
            ...(band === undefined ? [] : [{ label: 'Selected flow', swatch: 'cur' as const }]),
            { label: 'Request', line: 'solid' },
            { label: 'Event delivery', line: 'dotted' },
            { label: 'Read / write', line: 'dashed' },
          ]}
          context={flowContext(
            band,
            layout.nodes,
            focusIds,
            <Cluster gap={1}>
              <Button
                size="sm"
                onClick={() => {
                  setOpened(undefined);
                  setSelected(undefined);
                  setAutomaticFocus(true);
                  setFrameRevision((value) => value + 1);
                }}
              >
                Fit flow
              </Button>
              <Button
                size="sm"
                variant="quiet"
                pressed={only}
                onClick={() => {
                  setOnly(!only);
                }}
              >
                Only this flow
              </Button>
              {layout.groups.map((group) => (
                <Button
                  size="sm"
                  key={group.id}
                  label={`Collapse ${group.name} from flow`}
                  onClick={() => {
                    collapseSystem(group.id);
                  }}
                >
                  Collapse {group.name}
                </Button>
              ))}
            </Cluster>,
          )}
          label={`${view.area.name} value flows`}
          width={layout.width}
          height={layout.height}
          edges={edges.filter((edge) => !only || band === undefined || edge.highlighted)}
          hoverMembers={
            new Map(
              view.systems.map((system) => [system.id, system.components.map(({ id }) => id)]),
            )
          }
          selected={selected}
          endpoint={endpoint}
          caption={canvasCaption(expanded.size > 0)}
          focus={valueCanvasFocus(active, selected, focus, frameRevision)}
          inspector={
            inspected === undefined ? undefined : (
              <AreaComponentDetail
                component={inspected}
                boundary={inspectedBoundary}
                endpoint={endpoint}
                usedBy={view.systems
                  .flatMap((system) => system.components)
                  .filter(
                    (component) =>
                      component.dependencies.some((dependency) => dependency.id === inspected.id) ||
                      component.resources.some((resource) => resource.id === inspected.id),
                  )}
                onSelectEndpoint={setEndpoint}
                onClose={() => {
                  setSelected(undefined);
                }}
              />
            )
          }
          onReset={() => {
            retireDetail();
            changeFlow('');
            setAutomaticFocus(true);
            setAllConnections(false);
            setExpanded(new Set());
            systemSelection.clear();
            setOpened(undefined);
            setOnly(false);
            setSelected(undefined);
            setOpenCards(new Set());
          }}
        >
          {layout.groups.map((group) => (
            <CanvasSystemScope key={group.id} colour={colours.get(group.id) ?? 1}>
              <CanvasBoundary
                {...group}
                hoverId={group.id}
                header={
                  <SystemBoundaryHeader
                    name={group.name}
                    purpose={group.purpose}
                    selection={systemSelection.card(group.id)}
                    actions={view.systems.flatMap((system) =>
                      system.id === group.id
                        ? [
                            <TextLink key={system.id} href={system.href}>
                              View whole system
                            </TextLink>,
                          ]
                        : [],
                    )}
                    onCollapse={() => {
                      collapseSystem(group.id);
                    }}
                  />
                }
              />
            </CanvasSystemScope>
          ))}
          {layout.headings
            .filter((item) => flow === '' || item.id !== flow)
            .filter((item) => !only || flow === '' || item.id === flow)
            .map((item) => (
              <foreignObject
                data-context={flow !== '' && item.id !== flow ? '' : undefined}
                key={`${item.id}:${String(item.x)}:${String(item.y)}`}
                x={item.x}
                y={item.y}
                width={item.width}
                height={item.height}
              >
                <Stack gap={1}>
                  <Text as="h3" size="lg" weight="strong">
                    {item.title}
                  </Text>
                  <Text tone="muted" size="sm">
                    {item.summary}
                  </Text>
                </Stack>
              </foreignObject>
            ))}
          {layout.nodes
            .filter((node) => !only || focusIds === undefined || focusIds.has(node.id))
            .map((node) => (
              <CanvasSystemScope key={node.id} colour={colours.get(node.systemId) ?? 1}>
                <ValueNode
                  systems={view.systems}
                  expanded={expanded}
                  node={node}
                  boundary={view.boundaries?.find((boundary) => boundary.id === node.component.id)}
                  purpose={view.systems.find((system) => system.id === node.systemId)?.purpose}
                  active={node.members.includes(selected ?? '')}
                  highlighted={focusIds?.has(node.id) === true}
                  muted={
                    (!node.collapsed && node.supporting) ||
                    (focusIds !== undefined && !focusIds.has(node.id))
                  }
                  selection={systemSelection.card(
                    node.systemId,
                    node.collapsed ? undefined : node.id,
                  )}
                  localDetails
                  onExpand={() => {
                    afterReady(() => {
                      setExpanded((current) => new Set([...current, node.systemId]));
                      setOpened({ id: node.systemId, x: node.x, y: node.y });
                      setSelected(undefined);
                    });
                  }}
                  onSelect={() => {
                    if (
                      view.boundaries?.some((boundary) => boundary.id === node.component.id) ===
                      true
                    ) {
                      afterReady(() => {
                        setSelected(node.component.id);
                        setEndpoint(undefined);
                      });
                      return;
                    }
                    setSelected(node.id);
                    setEndpoint(undefined);
                  }}
                  endpoint={node.members.includes(selected ?? '') ? endpoint : undefined}
                  onToggle={() => {
                    setOpenCards(
                      new Set(
                        openCards.has(node.id)
                          ? [...openCards].filter((id) => id !== node.id)
                          : [...openCards, node.id],
                      ),
                    );
                  }}
                  onSelectEndpoint={(id) => {
                    setSelected(node.id);
                    setEndpoint(id);
                  }}
                  onSelectResource={revealResource}
                />
              </CanvasSystemScope>
            ))}
        </ConnectedCanvas>
      )}
    </Stack>
  );
}
