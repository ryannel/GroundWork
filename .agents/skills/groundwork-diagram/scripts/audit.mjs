// Read-only triage. Reuse the application's graph and projection, not a second relationship parser.
import { createHash } from 'node:crypto';

import { platformComponents } from '@/application/area-map/platform';
import { valueFlowConnections } from '@/application/area-map/value-flow-connections';
import { valueFlowLayout } from '@/application/area-map/value-flow-layout';
import { defaultValueFlowConnections } from '@/application/area-map/value-flow-visibility';
import { modelAreaViewOf } from '@/application/model-area';
import { readCanonicalModelIndex } from '@/infrastructure/model-index';

const [workspaceId, ...extra] = process.argv.slice(2);
if (!workspaceId || extra.length > 0) throw new Error('Usage: audit.mjs <registered-workspace-id>');
const index = await readCanonicalModelIndex(workspaceId);
if (!index) throw new Error(`No consolidated model for ${workspaceId}.`);
const workspace = index.model;
const landscape = workspace.landscape;
const systems = workspace.domains.flatMap((domain) => domain.systems);
const technical = index.edges();
const incident = (id, edges) => edges.filter((edge) => edge.from === id || edge.to === id);
const compact = (node) => ({
  id: node.id,
  name: node.component.name,
  system: node.systemId,
});

// Connectivity here is undirected for triage, never a claim of execution or data lineage.
function groups(nodes, edges) {
  const remaining = new Set(nodes.map((node) => node.id));
  const result = [];
  while (remaining.size > 0) {
    const reached = new Set([remaining.values().next().value]);
    for (const id of reached) {
      const neighbours = incident(id, edges).map((edge) =>
        edge.from === id ? edge.to : edge.from,
      );
      for (const other of neighbours) {
        if (remaining.has(other)) reached.add(other);
      }
    }
    for (const id of reached) remaining.delete(id);
    result.push([...reached].toSorted());
  }
  return result;
}

function projection(view, expanded) {
  const drawing = valueFlowLayout(view, view.valueFlow, new Set(expanded));
  const edges = valueFlowConnections(
    view.valueFlow,
    drawing.nodes,
    view.technicalRelationships,
    platformComponents(view),
  );
  const selected = defaultValueFlowConnections(
    edges,
    drawing.nodes,
    view.valueFlow.summaries,
    view.valueFlow.overview,
  );
  const visible = edges.filter((edge) => selected.has(edge.id));
  const core = new Set(
    visible.filter((edge) => !edge.supporting).flatMap((edge) => [edge.from, edge.to]),
  );
  const fullGroups = groups(drawing.nodes, edges);
  const disconnected = groups(drawing.nodes, visible)
    .filter((group) => !group.some((id) => core.has(id)))
    .map((group) => ({
      nodes: drawing.nodes.filter((node) => group.includes(node.id)).map(compact),
      allConnectionsReachCore: fullGroups.some(
        (full) => full.includes(group[0]) && full.some((id) => core.has(id)),
      ),
    }));
  return {
    expanded,
    nodes: drawing.nodes.length,
    defaultConnections: visible.length,
    allConnections: edges.length,
    noProjectedCore: core.size === 0,
    isolated: drawing.nodes.filter((node) => incident(node.id, visible).length === 0).map(compact),
    disconnectedFromCore: disconnected,
  };
}

function areaStatus(detail, view) {
  if (!detail) return 'missing-detail';
  if (!detail.valueFlow) return 'missing-value-flow';
  if (!view?.valueFlow) return 'invalid-value-flow-references';
  return 'projected';
}

function componentStatus(relationships) {
  return relationships.length > 0 ? 'has-structured-relationships' : 'needs-relationship-review';
}

const areas = (landscape?.areas ?? []).map((area) => {
  const detail = landscape.details?.find((entry) => entry.area === area.id);
  const view = modelAreaViewOf(index, area.id);
  const status = areaStatus(detail, view);
  return {
    id: area.id,
    name: area.name,
    status,
    systems: detail?.systems ?? [],
    projections:
      status === 'projected'
        ? [
            [],
            ...view.systems.map((system) => [system.id]),
            view.systems.map((system) => system.id),
          ]
            .filter(
              (set, index, all) =>
                all.findIndex((other) => JSON.stringify(other) === JSON.stringify(set)) === index,
            )
            .map((expanded) => projection(view, expanded))
        : [],
  };
});

const roster = systems.map((system) => ({
  id: system.id,
  name: system.name,
  areas: areas.filter((area) => area.systems.includes(system.id)).map((area) => area.id),
  components: system.components.map((component) => {
    const relationships = incident(component.id, technical);
    return {
      id: component.id,
      name: component.name,
      kind: component.kind,
      purpose: component.does ?? null,
      status: componentStatus(relationships),
      relationships: relationships.map((edge) => ({
        from: edge.from,
        to: edge.to,
        kind: edge.kind,
        via: edge.via,
        evidence: edge.cites,
      })),
    };
  }),
}));

console.log(
  JSON.stringify(
    {
      format: 1,
      workspace: workspaceId,
      generated: new Date().toISOString(),
      basis: createHash('sha256').update(JSON.stringify({ workspace, landscape })).digest('hex'),
      scope:
        'Current registered production model and saved area value-flow projections; no source or pixel audit.',
      limitations: [
        'Structured links can be declared, inferred from flows or configured; their existence does not prove execution.',
        'No relationship in this model is a review signal, not proof of no relationship in source or deployment.',
        'Areas without valid value flows have no projection audit. Zero findings does not mean visually approved.',
        'Resource-row expansion, all expansion combinations, routing and source freshness require separate review.',
      ],
      totals: {
        systems: roster.length,
        components: roster.reduce((sum, system) => sum + system.components.length, 0),
        systemsWithoutArea: roster.filter((system) => system.areas.length === 0).length,
        componentsNeedingRelationshipReview: roster
          .flatMap((system) => system.components)
          .filter((component) => component.status === 'needs-relationship-review').length,
        areas: areas.length,
        areasWithProjectionAudit: areas.filter((area) => area.status === 'projected').length,
      },
      systems: roster,
      areas,
    },
    null,
    2,
  ),
);
