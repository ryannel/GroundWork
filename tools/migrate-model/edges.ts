import { appendChild, buildId, parseId, rootId } from '@/domain/ids';
import { modelList, modelRecord, modelText } from '@/domain/workspace-model';

import type { MigrationCitations } from './citations';
import { fingerprint, type MigrationReview } from './review';

type Node = Readonly<Record<string, unknown>>;
interface Scope {
  readonly folder: string;
  readonly source: Node;
  readonly contracts: Node;
  readonly citations: MigrationCitations;
}
interface Detail {
  readonly from: string;
  readonly to: string;
  readonly kind: string;
  readonly site: string;
  readonly cites: readonly unknown[];
}
interface EdgeSystem {
  readonly system: Node;
  readonly contracts: Node;
  readonly handlers: readonly Node[];
}
function nodes(value: unknown): readonly Node[] {
  return modelList(value).flatMap((item) => {
    const node = modelRecord(item);
    return node === null ? [] : [node];
  });
}
function providersOf(scopes: readonly Scope[]): ReadonlyMap<string, string> {
  const providers = new Map<string, string>();
  for (const scope of scopes) {
    const entries = nodes(scope.contracts.interfaces).flatMap((contract) => {
      const provider =
        modelText(contract.component) ??
        modelText(contract.service) ??
        modelText(contract.external) ??
        modelText(contract.system);
      return nodes(contract.endpoints ?? contract.entries).map((entry) => [entry.id, provider]);
    });
    const messages = nodes(scope.contracts.messages).map((message) => [message.id, message.topic]);
    for (const [id, provider] of [...entries, ...messages]) {
      if (typeof id === 'string' && typeof provider === 'string') providers.set(id, provider);
    }
  }
  return providers;
}
function operationDetails(
  scopes: readonly Scope[],
  systems: ReadonlyMap<string, EdgeSystem>,
): readonly Detail[] {
  const gateways = new Map(
    scopes.flatMap((scope) =>
      nodes(scope.contracts.graphs).map((graph) => [graph.id, graph.gateway]),
    ),
  );
  return [...systems.values()].flatMap((system) =>
    nodes(system.contracts.operations).flatMap((operation) => {
      const from = modelText(operation.component);
      const to = modelText(gateways.get(operation.graph));
      const site = modelText(operation.id);
      return from === null || to === null || site === null
        ? []
        : [{ from, to, site, kind: 'call', cites: modelList(operation.cites) }];
    }),
  );
}
function effects(
  step: Node,
  from: string,
  site: string,
  cites: readonly unknown[],
): readonly Detail[] {
  const targets = [
    ['read', step.from],
    ['write', step.to],
    ['call', step.call],
    ['publish', step.publish],
  ] as const;
  return targets.flatMap(([kind, value]) => {
    const to = modelText(value);
    return to === null || step[kind] === undefined
      ? []
      : [{ from, to: rootId(to), kind, site, cites }];
  });
}
function childSteps(step: Node): readonly unknown[] {
  return [
    ...['steps', 'then', 'else', 'try', 'catch', 'finally'].flatMap((key) => modelList(step[key])),
    ...nodes(step.parallel).flatMap((lane) => modelList(lane.steps)),
    ...modelList(modelRecord(step.retry)?.exhausted),
  ];
}
function stepDetails(
  values: unknown,
  from: string,
  parent: string,
  inherited: readonly unknown[],
): readonly Detail[] {
  return nodes(values).flatMap((step) => {
    const id = modelText(step.id);
    if (id === null || id === '') return [];
    const site = appendChild(parent, id);
    const cites = step.cites === undefined ? inherited : modelList(step.cites);
    return [
      ...effects(step, from, site, cites),
      ...stepDetails(childSteps(step), from, site, cites),
    ];
  });
}
function handlerDetails(handler: Node): readonly Detail[] {
  const from = modelText(handler.component);
  const id = modelText(handler.id);
  return from === null || id === null
    ? []
    : stepDetails(handler.steps, from, id, modelList(handler.cites));
}
function storeDetails(scope: Scope): readonly Detail[] {
  return nodes(scope.contracts.stores).flatMap((store) => {
    const to = modelText(store.id);
    if (to === null) return [];
    return nodes(store.access).flatMap((access) => {
      const from = modelText(access.svc) ?? modelText(access.component);
      if (from === null) return [];
      return ['read', 'write']
        .filter((kind) => access.mode === kind || access.mode === 'readwrite')
        .map((kind) => ({
          from,
          to,
          kind,
          site: to,
          cites: scope.citations.convert(access, scope.citations.convert(store)),
        }));
    });
  });
}
function messageDetails(scope: Scope): readonly Detail[] {
  return nodes(scope.contracts.messages).flatMap((message) => {
    const to = modelText(message.id);
    if (to === null) return [];
    const producer = modelText(message.producer);
    const cites = scope.citations.convert(message);
    const consumers = modelList(message.consumers).flatMap((from) =>
      typeof from === 'string' ? [{ from, to, kind: 'consume', site: to, cites }] : [],
    );
    return [
      ...(producer === null ? [] : [{ from: producer, to, kind: 'publish', site: to, cites }]),
      ...consumers,
    ];
  });
}
function relationshipOf(detail: Detail): Node {
  return {
    id: buildId(
      'rel',
      `migrated-${fingerprint([detail.from, detail.to, detail.kind]).slice(0, 24)}`,
    ),
    from: detail.from,
    to: detail.to,
    kind: detail.kind,
    says: `Recorded ${detail.kind} access to ${detail.to}.`,
    reason: 'The cited contract records this relationship; no matching handler effect is recorded.',
    cites: detail.cites,
  };
}
function isCovered(
  candidate: Detail,
  detail: readonly Detail[],
  subscriptions: readonly Node[],
): boolean {
  if (candidate.kind === 'consume') {
    return subscriptions.some(
      (sub) => sub.component === candidate.from && sub.message === candidate.to,
    );
  }
  return detail.some(
    (record) =>
      record.from === candidate.from &&
      record.to === candidate.to &&
      record.kind === candidate.kind,
  );
}
function placementOf(scopes: readonly Scope[]): ReadonlyMap<string, string> {
  return new Map(
    scopes.flatMap((scope) =>
      nodes(scope.source.components).flatMap((component) => {
        if (typeof component.id !== 'string' || typeof scope.source.id !== 'string') return [];
        const prefix = parseId(component.id)?.prefix;
        if (prefix === 'ext') return [];
        return [[component.id, prefix === 'sys' ? component.id : scope.source.id] as const];
      }),
    ),
  );
}
function componentSource(id: string, placements: ReadonlyMap<string, string>): boolean {
  return placements.has(id) && ['svc', 'app', 'st', 'top'].includes(parseId(id)?.prefix ?? '');
}
function relationshipsOf(
  scopes: readonly Scope[],
  systems: ReadonlyMap<string, EdgeSystem>,
  review: MigrationReview,
  placements: ReadonlyMap<string, string>,
): { readonly relations: readonly Node[]; readonly backed: readonly Detail[] } {
  const detail = [...systems.values()].flatMap((system) => system.handlers.flatMap(handlerDetails));
  const subscriptions = [...systems.values()].flatMap((system) =>
    nodes(system.contracts.subscriptions),
  );
  const relations = new Map<string, Node>();
  const backed = [...detail];
  for (const candidate of scopes.flatMap((scope) => [
    ...storeDetails(scope),
    ...messageDetails(scope),
  ])) {
    if (isCovered(candidate, detail, subscriptions)) continue;
    if (candidate.cites.length === 0 || !componentSource(candidate.from, placements)) {
      review.add('review-edges', `contract-edge/${fingerprint(candidate)}`, candidate, {
        edge: candidate,
        reason: 'Missing citation or declared component source.',
      });
    } else {
      const relation = relationshipOf(candidate);
      relations.set(String(relation.id), relation);
      backed.push({ ...candidate, site: String(relation.id) });
    }
  }
  return { relations: [...relations.values()], backed };
}
function reviewReason(matches: readonly Detail[], internal: boolean): string {
  if (matches.length === 0) return 'No cited handler or contract backing.';
  if (internal) return 'Internal component relationship remains in its exact detail.';
  return 'No mapped destination system or summary label.';
}
function dispositionRecord(value: unknown, key: string): readonly Node[] {
  const node = modelRecord(modelRecord(value)?.[key]);
  return node === null ? [] : [node];
}
function connectionsOf(
  scope: Scope,
  backed: readonly Detail[],
  providers: ReadonlyMap<string, string>,
  placements: ReadonlyMap<string, string>,
  review: MigrationReview,
): { readonly connections: readonly Node[]; readonly reviewed: readonly Node[] } {
  const connections = new Map<string, Node>();
  const dispositions: unknown[] = [];
  const summaries = nodes(scope.source.components).flatMap((component) =>
    nodes(component.talks_to).map((summary) => ({ from: modelText(component.id) ?? '', summary })),
  );
  for (const { from, summary } of summaries) {
    const to = modelText(summary.to) ?? '';
    const matches = backed.filter(
      (edge) =>
        edge.from === from && (providers.get(edge.to) ?? edge.to) === to && edge.cites.length > 0,
    );
    const target = placements.get(to);
    const says =
      modelText(summary.says) ??
      modelText(summary.does) ??
      modelText(summary.why) ??
      modelText(summary.via);
    if (target !== undefined && target !== scope.source.id && says !== null && matches.length > 0) {
      const connection = {
        to: target,
        says,
        backs: [...new Set(matches.map((edge) => edge.site))].toSorted((a, b) =>
          a.localeCompare(b),
        ),
      };
      connections.set(fingerprint(connection), connection);
    } else {
      dispositions.push(
        review.add('review-edges', `summary/${from}/${fingerprint(summary)}`, summary, {
          from,
          edge: summary,
          evidence: matches,
          reason: reviewReason(matches, target === scope.source.id),
        }),
      );
    }
  }
  return {
    connections: [
      ...connections.values(),
      ...dispositions.flatMap((row) => dispositionRecord(row, 'connection')),
    ],
    reviewed: dispositions.flatMap((row) => dispositionRecord(row, 'relationship')),
  };
}
/** Reconcile only explicit declarations and cited effects. Unproved summaries stay review rows. */
export function reconcileEdges(
  scopes: readonly Scope[],
  systems: ReadonlyMap<string, EdgeSystem>,
  review: MigrationReview,
): ReadonlyMap<string, Node> {
  const operations = operationDetails(scopes, systems);
  const providers = new Map([
    ...providersOf(scopes),
    ...operations.map((operation) => [operation.site, operation.to] as const),
  ]);
  const placements = placementOf(scopes);
  const { relations, backed } = relationshipsOf(scopes, systems, review, placements);
  const result = new Map<string, Node>();
  for (const scope of scopes) {
    const native = systems.get(scope.folder);
    if (native === undefined) continue;
    const { connections, reviewed } = connectionsOf(
      scope,
      [...backed, ...operations],
      providers,
      placements,
      review,
    );
    const relationships = [
      ...relations.filter((relation) => placements.get(String(relation.from)) === scope.source.id),
      ...reviewed,
    ];
    result.set(scope.folder, {
      ...native.system,
      ...(connections.length === 0 ? {} : { connections }),
      ...(relationships.length === 0 ? {} : { relationships }),
    });
  }
  return result;
}
