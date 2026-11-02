import {
  recordedDataAccess,
  resourceConsumers,
  resourcePublishers,
} from '@/application/area-map/resources';
import type { Model } from '@/application/plan/derive';
import type { LandscapeSystemRelationship } from '@/domain/landscape';

/** Request direction and exact identities survive projection; handler bodies and guards stay in the evidence explorer. */
export interface AreaTechnicalRelationship extends LandscapeSystemRelationship {
  /** Saved overview wording while component contracts are deferred until exploration. */
  readonly summary?: string;
  readonly directed?: boolean;
  readonly supporting?: boolean;
  readonly usageFrom?: string;
  readonly usageTo?: string;
  readonly fromSystem: string;
  readonly toSystem: string;
  readonly via: string | null;
  readonly evidenced: boolean;
  readonly endpointId?: string | null;
  readonly topicId?: string;
  readonly evidence?: 'handler' | 'flow' | 'declared' | 'configuration';
  /** Captured handler and flow-step identities supporting this relationship. */
  readonly evidenceIds?: readonly string[];
}

function graphMemberships(
  model: Model,
  owners: ReadonlyMap<string, string>,
  relationships: readonly AreaTechnicalRelationship[],
): readonly AreaTechnicalRelationship[] {
  const pairs = new Set(
    relationships.flatMap(({ from, to }) => [`${from}|${to}`, `${to}|${from}`]),
  );
  return model.asIs.subgraphs.flatMap((subgraph): readonly AreaTechnicalRelationship[] => {
    const graph = model.asIs.graphs.find((candidate) => candidate.id === subgraph.graph);
    if (graph === undefined) return [];
    const from = graph.gateway;
    const to = subgraph.service;
    if (from === to || pairs.has(`${from}|${to}`)) return [];
    const fromSystem = owners.get(from);
    const toSystem = owners.get(to);
    if (fromSystem === undefined || toSystem === undefined) return [];
    pairs.add(`${from}|${to}`);
    pairs.add(`${to}|${from}`);
    return [
      {
        id: `membership:${subgraph.id}`,
        from,
        to,
        fromSystem,
        toSystem,
        via: subgraph.id,
        endpointId: null,
        kind: 'membership',
        label: 'Recorded subgraph membership',
        detail:
          `${model.label(to)} is recorded as a subgraph of ${graph.name}. This records model membership, not live composition, deployment or a request. ${subgraph.summary ?? ''}`.trim(),
        evidenced: false,
        evidence: 'configuration',
        directed: false,
        supporting: true,
      },
    ];
  });
}

interface AreaSystemComponents {
  readonly id: string;
  readonly components: readonly { readonly id: string }[];
}

function evidenceOf(handlers: number, steps: number, configured = false) {
  if (configured) return 'configuration' as const;
  if (handlers > 0) return 'handler' as const;
  if (steps > 0) return 'flow' as const;
  return 'declared' as const;
}

/** Generated API wording can be reconstructed from identities already carried by an area map. */
export function apiRelationshipDetail(
  from: string,
  to: string,
  label: string,
  evidence: AreaTechnicalRelationship['evidence'],
): string {
  const description = `${from} calls ${to} at ${label}.`;
  if (evidence === 'configuration') {
    return `Configured graph routing: ${description} This does not establish a call on every request.`;
  }
  const note =
    evidence === 'declared'
      ? 'Declared dependency; no captured call site.'
      : 'Direction follows the initiating request, not its response.';
  return `${description} ${note}`;
}

function apiRelationships(
  model: Model,
  systemByComponent: ReadonlyMap<string, string>,
): AreaTechnicalRelationship[] {
  const calls = model.handlerEdges('asIs').filter((edge) => edge.kind === 'call');
  return model.edges('asIs', 'api').flatMap((edge): readonly AreaTechnicalRelationship[] => {
    const fromSystem = systemByComponent.get(edge.from);
    const toSystem = systemByComponent.get(edge.to);
    if (fromSystem === undefined || toSystem === undefined) return [];
    const endpoint = model.asIs.get(edge.via);
    const endpointId = endpoint?.$type === 'endpoint' ? endpoint.id : null;
    const label = endpoint?.$type === 'endpoint' ? endpoint.sig : model.label(edge.via ?? edge.to);
    const occurrences = calls.filter(
      (call) => call.from === edge.from && call.to === edge.to && call.target === edge.via,
    );
    const evidence = evidenceOf(occurrences.length, edge.steps.length, edge.fanout === true);
    return [
      {
        id: `technical:${edge.id}`,
        from: edge.from,
        to: edge.to,
        fromSystem,
        toSystem,
        via: edge.via,
        endpointId,
        label,
        kind: 'api',
        detail: apiRelationshipDetail(
          model.label(edge.from),
          model.label(edge.to),
          label,
          evidence,
        ),
        evidenced: evidence === 'handler' || evidence === 'flow',
        evidence,
      },
    ];
  });
}

function messageRelationships(
  model: Model,
  systemByComponent: ReadonlyMap<string, string>,
): AreaTechnicalRelationship[] {
  return model.asIs.messages.flatMap((message) => {
    const handlers = model.asIs.handlers.filter((handler) => handler.on === message.id);
    const consumers = new Set([
      ...model.consumersEffective(message.id, 'asIs').map((consumer) => consumer.svc),
      ...handlers.map((handler) => handler.component),
    ]);
    const relationships: AreaTechnicalRelationship[] = [];
    for (const publisher of resourcePublishers(model, message.id)) {
      const producer = publisher.from;
      const fromSystem = systemByComponent.get(producer);
      if (fromSystem === undefined) continue;
      relationships.push(
        ...[...consumers].flatMap((consumer): readonly AreaTechnicalRelationship[] => {
          const toSystem = systemByComponent.get(consumer);
          if (toSystem === undefined) return [];
          const receiving = handlers.filter((handler) => handler.component === consumer);
          const steps = model
            .consumePoints(message.id, 'asIs')
            .filter((step) => step.to === consumer);
          const receiverEvidence = evidenceOf(receiving.length, steps.length);
          const publisherEvidence = evidenceOf(
            publisher.handlers?.length ?? 0,
            publisher.steps.length,
          );
          const evidence = evidenceOf(
            receiving.length + (publisher.handlers?.length ?? 0),
            steps.length + publisher.steps.length,
          );
          return [
            {
              id: `technical:${message.id}:${producer}:${consumer}`,
              from: producer,
              to: consumer,
              usageFrom: consumer,
              usageTo: producer,
              fromSystem,
              toSystem,
              via: message.id,
              topicId: message.topic,
              label: message.name,
              kind: 'message',
              detail: `${model.label(producer)} has ${publisherEvidence === 'declared' ? 'a declared publication' : 'a captured publication'} of ${message.name} via ${model.label(message.topic)}; ${model.label(consumer)} has ${receiverEvidence === 'declared' ? 'a declared subscription' : 'a captured consumer'}. Delivery and deployed subscription state are not established.`,
              evidenced: evidence !== 'declared',
              evidence,
              evidenceIds: [
                ...new Set([
                  ...(publisher.handlers ?? []),
                  ...publisher.steps,
                  ...receiving.map((handler) => handler.id),
                  ...steps.map((step) => step.step),
                ]),
              ],
            },
          ];
        }),
      );
    }
    return relationships;
  });
}

/** Standard access wording is recoverable without transporting its repeated component names. */
export function resourceRelationshipDetail(from: string, to: string, label: string): string {
  return `${from} → ${to}: ${label}. Modelled access; deployed behaviour is not established.`;
}

function resourceRelationships(
  systems: readonly AreaSystemComponents[],
  model: Model,
): readonly AreaTechnicalRelationship[] {
  const owners = new Map(
    systems.flatMap((system) => system.components.map((component) => [component.id, system.id])),
  );
  const data = recordedDataAccess(model).map((edge) => ({
    from: edge.from,
    to: edge.to,
    via: edge.to,
    label:
      edge.mode === null
        ? 'Data access'
        : { read: 'Reads', write: 'Writes', readwrite: 'Reads and writes' }[edge.mode],
    kind: 'data' as const,
    evidence: evidenceOf(edge.handlers?.length ?? 0, edge.steps.length),
    evidenceIds: [...(edge.handlers ?? []), ...edge.steps],
  }));
  const messages = model.asIs.messages.flatMap((message) => [
    ...resourcePublishers(model, message.id).map((publisher) => ({
      from: publisher.from,
      to: message.topic,
      via: message.id,
      label: `Publishes ${message.name}`,
      kind: 'message' as const,
      evidence: evidenceOf(publisher.handlers?.length ?? 0, publisher.steps.length),
      evidenceIds: [...(publisher.handlers ?? []), ...publisher.steps],
    })),
    ...resourceConsumers(model, message.id).map((consumer) => ({
      from: message.topic,
      to: consumer,
      usageFrom: consumer,
      usageTo: message.topic,
      via: message.id,
      label: `Consumes ${message.name}`,
      kind: 'message' as const,
      evidence: 'declared' as const,
      evidenceIds: [],
    })),
  ]);
  return [...data, ...messages].flatMap((edge): readonly AreaTechnicalRelationship[] => {
    const fromSystem = owners.get(edge.from);
    const toSystem = owners.get(edge.to);
    if (fromSystem === undefined || toSystem === undefined) return [];
    return [
      {
        ...edge,
        id: `resource:${edge.from}:${edge.to}:${edge.via}`,
        fromSystem,
        toSystem,
        evidenced: edge.evidence !== 'declared',
        detail:
          edge.evidence === 'declared'
            ? resourceRelationshipDetail(model.label(edge.from), model.label(edge.to), edge.label)
            : `${model.label(edge.from)} → ${model.label(edge.to)}: ${edge.label}. Captured ${edge.evidence} evidence; delivery and deployed behaviour are not established.`,
      },
    ];
  });
}

/** Exact API and cross-system message relations; store ownership alone is deliberately not promoted to observed I/O. */
export function areaTechnicalRelationships(
  systems: readonly AreaSystemComponents[],
  model: Model | undefined,
): readonly AreaTechnicalRelationship[] {
  if (model === undefined) return [];
  const systemByComponent = new Map(
    systems.flatMap((system) => system.components.map((component) => [component.id, system.id])),
  );
  const relationships = [
    ...apiRelationships(model, systemByComponent),
    ...messageRelationships(model, systemByComponent).filter(
      (relation) => !systemByComponent.has(relation.topicId ?? ''),
    ),
    ...resourceRelationships(systems, model),
  ];
  return [...relationships, ...graphMemberships(model, systemByComponent, relationships)];
}
