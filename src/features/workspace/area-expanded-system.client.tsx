'use client';

import type { ReactElement } from 'react';

import {
  type CardRow,
  type CardSectionKind,
  cardLayout,
} from '@/application/area-map/card-geometry';
import {
  componentKind,
  resourceCaption,
  resourceLocation,
  resourceSummary,
} from '@/application/area-map/component-summary';
import type {
  AreaComponentView,
  AreaResourceView,
  AreaSystemView,
} from '@/application/workspace-area';
import {
  type CardTone,
  type CardSelection,
  ComponentCard,
  ComponentCardApiRow,
  ComponentCardContents,
  ComponentCardDetails,
  ComponentCardHeader,
  ComponentCardHeaderActions,
  ComponentCardResourceRow,
  ComponentCardSection,
  ComponentCardSharedRow,
} from '@/ui/canvas/component-card';
import { SystemBoundaryHeader } from '@/ui/canvas/system-card';
import { CanvasBoundary } from '@/ui/connected-canvas.client';
import type { IconName } from '@/ui/icon';

import type { AreaComponentBox } from './area-system-shape';

interface ExpandedSystem extends AreaSystemView {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly componentBoxes: readonly AreaComponentBox[];
}

const KIND: Readonly<Record<string, { readonly icon: IconName; readonly tone: CardTone }>> = {
  service: { icon: 'service', tone: 'api' },
  website: { icon: 'ui', tone: 'app' },
  job: { icon: 'job', tone: 'job' },
  database: { icon: 'database', tone: 'data' },
  queue: { icon: 'topic', tone: 'events' },
  external: { icon: 'external', tone: 'neutral' },
};

const SECTION: Readonly<
  Record<
    CardSectionKind,
    {
      readonly label: string;
      readonly noun: string;
      readonly icon: IconName;
      readonly tone: CardTone;
    }
  >
> = {
  api: { label: 'API', noun: 'API groups', icon: 'endpoint', tone: 'api' },
  services: { label: 'Services', noun: 'services', icon: 'service', tone: 'api' },
  stores: { label: 'Owns data', noun: 'stores', icon: 'database', tone: 'data' },
  publishes: { label: 'Publishes to', noun: 'topics', icon: 'topic', tone: 'events' },
  shared: { label: 'Uses shared', noun: 'shared resources', icon: 'external', tone: 'neutral' },
};

function resourceIcon(resource: { readonly kind: string; readonly category?: string }): IconName {
  if (resource.kind === 'service') return 'service';
  if (resource.category === 'cache') return 'cache';
  return resource.kind === 'queue' || resource.kind === 'topic' ? 'topic' : 'database';
}

/** Namespaced names (prod.private.price.fees.update) keep their telling end. */
function shortName(name: string): string {
  const parts = name.split('.');
  return name.includes(' ') || parts.length <= 3 ? name : `…${parts.slice(-3).join('.')}`;
}

interface RowHandlers {
  readonly systems: readonly AreaSystemView[];
  readonly expanded: ReadonlySet<string>;
  readonly endpoint: string | undefined;
  readonly onSelectEndpoint: (id: string) => void;
  readonly onSelectResource: (id: string) => void;
}

function resourceRowDetail(resource: AreaComponentView, card: AreaComponentView): string {
  if (resource.kind !== 'service') {
    return `${resourceSummary(resource)}${resource.category === 'cache' ? ' cache' : ''}`;
  }
  const stores = new Set(
    card.attachments?.filter(({ kind }) => kind === 'database').map(({ id }) => id),
  );
  const uses = new Set(resource.resources.filter(({ id }) => stores.has(id)).map(({ use }) => use));
  return [...uses].join(' · ');
}

function cardRowKey(row: CardRow): string {
  if (row.kind === 'endpoint') return row.endpoint.id;
  return row.kind === 'api' ? row.surface.id : row.resource.id;
}

function CardRowView({
  row,
  handlers,
  card,
  localDetails,
}: {
  readonly row: CardRow;
  readonly handlers: RowHandlers;
  readonly card: AreaComponentView;
  readonly localDetails: boolean;
}) {
  if (row.kind === 'api') {
    const { surface } = row;
    return (
      <ComponentCardApiRow
        active={
          surface.id === handlers.endpoint ||
          surface.endpoints.some((port) => port.id === handlers.endpoint)
        }
        inspect={localDetails ? undefined : surface.endpoints[0]?.id}
        ports={surface.endpoints.map((port) => port.id)}
        onSelect={() => {
          handlers.onSelectEndpoint(surface.id);
        }}
        operations={surface.endpoints.length}
        path={surface.label === surface.protocol ? 'API' : surface.label}
        protocol={surface.protocol}
        versions={surface.versions.join(', ')}
      />
    );
  }
  if (row.kind === 'endpoint') {
    return (
      <ComponentCardApiRow
        active={row.endpoint.id === handlers.endpoint}
        inspect={localDetails ? undefined : row.endpoint.id}
        ports={[row.endpoint.id]}
        onSelect={() => {
          handlers.onSelectEndpoint(row.endpoint.id);
        }}
        operations={0}
        path={row.endpoint.signature}
        protocol=""
        versions=""
      />
    );
  }
  if (row.kind === 'resource') {
    const { resource } = row;
    return (
      <ComponentCardResourceRow
        active={resource.id === handlers.endpoint}
        detail={resourceRowDetail(resource, card)}
        icon={resourceIcon(resource)}
        name={resource.name}
        onSelect={() => {
          handlers.onSelectResource(resource.id);
        }}
        resource={resource.id}
        tone={resource.kind === 'queue' ? 'events' : 'data'}
      />
    );
  }
  return <SharedResourceRow resource={row.resource} handlers={handlers} />;
}

function SharedResourceRow({
  resource,
  handlers,
}: {
  readonly resource: AreaResourceView;
  readonly handlers: RowHandlers;
}) {
  const destination = resourceLocation(handlers.systems, resource.id);
  const collapsed = destination !== null && !handlers.expanded.has(destination.system.id);
  let location = 'Not placed on this map';
  let action = 'No map destination is recorded.';
  if (destination !== null) {
    const state = collapsed ? 'System collapsed' : 'Show on map';
    const expand = collapsed ? ' (expands system)' : '';
    const inside =
      destination.component.id === resource.id ? '' : `, inside ${destination.component.name}`;
    location = `${destination.system.name} · ${state}`;
    action = `Show in ${destination.system.name}${expand}${inside}.`;
  }
  return (
    <ComponentCardSharedRow
      active={resource.id === handlers.endpoint}
      disabled={destination === null}
      detail={`${resource.name} · ${resourceCaption(resource)}. ${action}`}
      icon={resourceIcon(resource)}
      location={location}
      name={shortName(resource.name)}
      tone={resource.kind === 'topic' ? 'events' : 'data'}
      onSelect={() => {
        handlers.onSelectResource(resource.id);
      }}
    />
  );
}

function componentHeaderActions(
  identity: ReactElement,
  name: string,
  inspect: string | undefined,
  selected: boolean,
  onDetails: (() => void) | undefined,
): ReactElement {
  if (!selected || (inspect === undefined && onDetails === undefined)) return identity;
  return (
    <ComponentCardHeaderActions>
      {identity}
      <ComponentCardDetails name={name} inspect={inspect} onOpen={onDetails} />
    </ComponentCardHeaderActions>
  );
}

function serviceInspector(component: AreaComponentView): string | undefined {
  return component.kind === 'service' && component.category !== 'group' ? component.id : undefined;
}

export function ComponentCluster({
  component,
  muted,
  active,
  highlighted = false,
  handlers,
  selection,
  localDetails = false,
  onOpen,
  onToggle,
}: {
  readonly component: AreaComponentBox;
  readonly muted: boolean;
  readonly active: boolean;
  readonly highlighted?: boolean;
  readonly handlers: RowHandlers;
  readonly selection?: CardSelection | undefined;
  readonly localDetails?: boolean | undefined;
  readonly onOpen: () => void;
  readonly onToggle: () => void;
}) {
  const layout = cardLayout(component, component.open);
  const kind = KIND[component.kind] ?? { icon: 'service', tone: 'neutral' };
  const inspect = serviceInspector(component);
  const identity = (
    <ComponentCardHeader
      icon={kind.icon}
      inspect={selection === undefined ? inspect : undefined}
      kind={componentKind(component)}
      name={component.name}
      summary={component.summary}
      tone={kind.tone}
      onOpen={onOpen}
      selection={selection}
    />
  );
  const header = componentHeaderActions(
    identity,
    component.name,
    localDetails ? undefined : inspect,
    selection !== undefined,
    localDetails && component.category !== 'group' ? onOpen : undefined,
  );
  return (
    <ComponentCard
      muted={muted}
      active={active}
      highlighted={highlighted}
      selection={selection}
      footer={layout.footer ? resourceSummary(component) : undefined}
      header={header}
    >
      {layout.contents.length === 0 ? null : (
        <ComponentCardContents
          items={layout.contents.map((item) => ({
            key: item.kind,
            icon: SECTION[item.kind].icon,
            tone: SECTION[item.kind].tone,
            label: SECTION[item.kind].noun,
            count: item.count,
          }))}
          name={component.name}
          onToggle={onToggle}
          open={layout.open}
        />
      )}
      {layout.sections.map((section) => (
        <ComponentCardSection
          count={section.rows.length}
          icon={SECTION[section.kind].icon}
          key={section.kind}
          label={SECTION[section.kind].label}
          tone={SECTION[section.kind].tone}
        >
          {section.rows.map((row) => (
            <CardRowView
              card={component}
              localDetails={localDetails}
              handlers={handlers}
              key={cardRowKey(row)}
              row={row}
            />
          ))}
        </ComponentCardSection>
      ))}
    </ComponentCard>
  );
}

/** An expanded system is a collapsible boundary around independently placed component clusters. */
export function AreaExpandedSystem({
  system,
  selection,
  componentSelection,
  systems,
  expanded,
  active,
  endpoint,
  onCollapse,
  onToggleComponent,
  onToggleOpen,
  onSelectEndpoint,
  onSelectResource,
}: {
  readonly system: ExpandedSystem;
  readonly selection: CardSelection;
  readonly componentSelection: (id: string) => CardSelection;
  readonly systems: readonly AreaSystemView[];
  readonly expanded: ReadonlySet<string>;
  readonly active: string | undefined;
  readonly endpoint: string | undefined;
  readonly onCollapse: () => void;
  readonly onToggleComponent: (id: string) => void;
  readonly onToggleOpen: (id: string) => void;
  readonly onSelectEndpoint: (id: string) => void;
  readonly onSelectResource: (id: string) => void;
}) {
  return (
    <>
      <CanvasBoundary
        height={system.height}
        hoverId={system.id}
        header={
          <SystemBoundaryHeader
            name={system.name}
            selection={selection}
            purpose={system.purpose}
            onCollapse={onCollapse}
          />
        }
        width={system.width}
        x={system.x}
        y={system.y}
      />
      {system.componentBoxes.map((component) => (
        <foreignObject
          height={component.height}
          data-component={component.id}
          key={component.id}
          width={component.width}
          x={system.x + component.x}
          y={system.y + component.y}
        >
          <ComponentCluster
            muted={false}
            active={
              active === component.id ||
              component.attachments?.some((resource) => resource.id === active) === true
            }
            component={component}
            selection={componentSelection(component.id)}
            localDetails
            handlers={{
              systems,
              expanded,
              endpoint:
                component.attachments?.some((resource) => resource.id === active) === true
                  ? active
                  : endpoint,
              onSelectResource,
              onSelectEndpoint: (id) => {
                if (active !== component.id) onToggleComponent(component.id);
                onSelectEndpoint(id);
              },
            }}
            onOpen={() => {
              onToggleComponent(component.id);
            }}
            onToggle={() => {
              onToggleOpen(component.id);
            }}
          />
        </foreignObject>
      ))}
    </>
  );
}
