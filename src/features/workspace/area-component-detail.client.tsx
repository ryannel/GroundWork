'use client';

import { componentKind } from '@/application/area-map/component-summary';
import type { AreaComponentView, AreaEndpointView } from '@/application/workspace-area';
import { Badge } from '@/ui/badge';
import { Button } from '@/ui/button';
import { Chip } from '@/ui/chip';
import {
  CanvasAttachment,
  CanvasAttachmentGrid,
  CanvasComponentDetail,
  CanvasContractGrid,
  CanvasDependencyArrow,
  CanvasInspectorSection,
} from '@/ui/connected-canvas.client';
import { Icon } from '@/ui/icon';
import { Cluster, Stack } from '@/ui/stack';
import { Text, TextLink } from '@/ui/text';

import { AreaApiSurface } from './area-map/area-api-surface.client';

function callerLabel(caller: AreaEndpointView['callers'][number]): string {
  return caller.systemName === null ? caller.name : `${caller.systemName} · ${caller.name}`;
}

function operationName(endpoint: AreaEndpointView): string {
  const signature = endpoint.signature.split(/\s+/u).at(1) ?? endpoint.signature;
  const part =
    signature.split(/[/?]/u).findLast((value) => value.length > 0 && !value.startsWith('{')) ??
    signature;
  const name = part.replaceAll(/([a-z])([A-Z])/gu, '$1 $2').replaceAll(/[-_]/gu, ' ');
  return name.charAt(0).toUpperCase() + name.slice(1);
}

function Contract({ label, schema }: { readonly label: string; readonly schema: string | null }) {
  return (
    <CanvasAttachment>
      <Stack gap={1}>
        <Text caps size="sm" tone="faint">
          {label}
        </Text>
        {schema === null ? (
          <Text size="sm" tone="faint">
            Schema not evidenced
          </Text>
        ) : (
          <Chip glyph="{}" id={schema} label={`${label} schema`} />
        )}
      </Stack>
    </CanvasAttachment>
  );
}

function EndpointDetail({ endpoint }: { readonly endpoint: AreaEndpointView }) {
  return (
    <CanvasInspectorSection>
      <Stack gap={1}>
        <Text caps size="sm" tone="faint">
          Selected endpoint
        </Text>
        <Text as="p" weight="strong">
          {operationName(endpoint)}
        </Text>
        <Text mono tone="accent">
          {endpoint.signature}
        </Text>
        <Text size="sm" tone="muted" clamp={3}>
          {endpoint.summary}
        </Text>
      </Stack>
      <Stack gap={1}>
        <Text caps size="sm" tone="faint">
          Called by
        </Text>
        {endpoint.callers.length === 0 ? (
          <Text size="sm" tone="faint">
            No caller was recorded in the scanned repositories.
          </Text>
        ) : (
          <Cluster gap={1}>
            {endpoint.callers.map((caller) => (
              <Chip glyph="▣" id={caller.id} key={caller.id} label={callerLabel(caller)} />
            ))}
          </Cluster>
        )}
      </Stack>
      <CanvasContractGrid>
        <Contract label="Request" schema={endpoint.request} />
        <Contract label="Response" schema={endpoint.response} />
      </CanvasContractGrid>
      {endpoint.explorer === null ? null : (
        <TextLink href={endpoint.explorer} tone="quiet">
          Follow implementation →
        </TextLink>
      )}
    </CanvasInspectorSection>
  );
}

function OutboundConnections({ component }: { readonly component: AreaComponentView }) {
  if (component.dependencies.length === 0) return null;
  return (
    <CanvasInspectorSection>
      <Stack gap={1}>
        <Text as="p" weight="strong">
          Depends on
        </Text>
        <Text size="sm" tone="muted">
          These arrows are also drawn on the map when their target is in this area.
        </Text>
      </Stack>
      {[
        ...new Map(
          component.dependencies.map((dependency) => [dependency.id, dependency]),
        ).values(),
      ].map((dependency) => (
        <CanvasDependencyArrow key={`${dependency.id}:${dependency.endpointId ?? ''}`}>
          <Stack gap={1}>
            <Chip
              glyph={dependency.system === null ? '◇' : '▣'}
              id={dependency.id}
              label={
                dependency.systemName === null
                  ? dependency.name
                  : `${dependency.systemName} · ${dependency.name}`
              }
            />
            {dependency.endpoint === null ? null : (
              <Text mono size="sm" tone="muted">
                {component.dependencies.filter((item) => item.id === dependency.id).length} recorded
                API calls
              </Text>
            )}
          </Stack>
        </CanvasDependencyArrow>
      ))}
    </CanvasInspectorSection>
  );
}

function Evidence({ component }: { readonly component: AreaComponentView }) {
  if (component.resources.length === 0) return null;
  return (
    <CanvasInspectorSection>
      <Text as="p" weight="strong">
        Resources
      </Text>
      <CanvasAttachmentGrid>
        {component.resources.map((resource) => (
          <CanvasAttachment key={`${resource.kind}:${resource.id}`}>
            <Stack gap={1}>
              <Text caps size="sm" tone="faint">
                {resource.use}
              </Text>
              <Chip
                glyph={resource.kind === 'topic' ? '⇢' : '▤'}
                id={resource.id}
                label={resource.name}
              />
              <Text size="sm" tone="muted">
                {resource.technology ?? 'Technology not recorded'}
              </Text>
            </Stack>
          </CanvasAttachment>
        ))}
      </CanvasAttachmentGrid>
    </CanvasInspectorSection>
  );
}

type ComponentUser = Pick<AreaComponentView, 'id' | 'name'> & {
  readonly resources?: AreaComponentView['resources'];
};

function ComponentUsers({
  component,
  users,
}: {
  readonly component: AreaComponentView;
  readonly users: readonly ComponentUser[];
}) {
  const groups = new Map<string, ComponentUser[]>();
  for (const user of users) {
    const uses = user.resources?.filter((resource) => resource.id === component.id) ?? [];
    const labels =
      component.kind === 'queue'
        ? uses.flatMap((resource) => {
            if (resource.use.startsWith('Publishes')) return ['Published by'];
            if (resource.use.startsWith('Consumes')) return ['Consumed by'];
            return [];
          })
        : [];
    for (const label of new Set(labels.length === 0 ? ['Used by'] : labels)) {
      groups.set(label, [...(groups.get(label) ?? []), user]);
    }
  }
  if (groups.size === 0) groups.set('Used by', []);
  return [...groups].map(([label, members]) => (
    <CanvasInspectorSection key={label}>
      <Text weight="strong">{label}</Text>
      {members.length === 0 ? (
        <Text size="sm" tone="faint">
          No users recorded in this area.
        </Text>
      ) : (
        members.map((caller) => (
          <Chip glyph="←" id={caller.id} key={caller.id} label={caller.name} />
        ))
      )}
    </CanvasInspectorSection>
  ));
}

function ComponentApi({
  component,
  endpoint,
  onSelect,
}: {
  readonly component: AreaComponentView;
  readonly endpoint: string | undefined;
  readonly onSelect: (id: string) => void;
}) {
  if (
    (component.kind === 'queue' || component.kind === 'database') &&
    component.endpoints.length === 0
  ) {
    return null;
  }
  return (
    <CanvasInspectorSection>
      <Stack gap={1}>
        <Text as="p" weight="strong">
          API surface
        </Text>
        <Text size="sm" tone="muted">
          Choose a resource group, then an operation to inspect its callers and contracts.
        </Text>
      </Stack>
      <AreaApiSurface component={component} onSelect={onSelect} selected={endpoint} />
    </CanvasInspectorSection>
  );
}

/** A readable component inspector; selecting it never changes the geometry or scale of the map. */
export function AreaComponentDetail({
  component,
  endpoint: endpointId,
  onClose,
  onSelectEndpoint,
  usedBy,
}: {
  readonly component: AreaComponentView;
  readonly endpoint: string | undefined;
  readonly onClose: () => void;
  readonly onSelectEndpoint: (id: string) => void;
  readonly usedBy: readonly ComponentUser[];
}) {
  const endpoint = component.endpoints.find((candidate) => candidate.id === endpointId);
  return (
    <CanvasComponentDetail
      footer={
        component.explorer === null ? null : (
          <TextLink href={component.explorer} tone="quiet">
            Open complete component scan →
          </TextLink>
        )
      }
      header={
        <Cluster spread>
          <Stack gap={1}>
            <Cluster gap={1}>
              <Badge tone="accent">{componentKind(component)}</Badge>
              <Text as="h3" weight="strong">
                {component.name}
              </Text>
            </Cluster>
            <Text size="sm" tone="muted">
              {component.summary}
            </Text>
            <Text size="sm" tone="faint">
              {component.technology ?? 'Technology not recorded'}
            </Text>
            {component.repository === null ? null : (
              <TextLink href={component.repository.href} tone="quiet">
                <Cluster gap={2}>
                  <Icon name="github" />
                  <Text size="sm">{component.repository.name}</Text>
                </Cluster>
              </TextLink>
            )}
          </Stack>
          <Button label={`Close ${component.name}`} onClick={onClose} size="sm" variant="quiet">
            Close
          </Button>
        </Cluster>
      }
    >
      {endpoint === undefined ? null : <EndpointDetail endpoint={endpoint} />}
      <ComponentApi component={component} endpoint={endpointId} onSelect={onSelectEndpoint} />
      <ComponentUsers component={component} users={usedBy} />
      <OutboundConnections component={component} />
      <Evidence component={component} />
    </CanvasComponentDetail>
  );
}
