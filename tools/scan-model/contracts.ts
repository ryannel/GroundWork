import type { ModelIndex } from '@/application/model-index';
import type { ContractData } from '@/domain/model/contracts.generated';
import {
  modelList,
  modelRecord,
  type ModelEntity,
  type ModelRepository,
} from '@/domain/workspace-model';

type Route = ContractData<'evidence', 'AspNetRouteBinding'>;

interface ContractObservation {
  readonly values: Readonly<Record<string, string>>;
  readonly cites: readonly string[];
}

function evidenceCites(entity: ModelEntity): readonly string[] {
  return modelList(entity.data.cites).flatMap((cite) => {
    const source = modelRecord(cite);
    return source?.kind === 'evidence' && typeof source.id === 'string' ? [source.id] : [];
  });
}

function schemaIds(index: Pick<ModelIndex, 'entities'>): ReadonlyMap<string, ReadonlySet<string>> {
  const bindings = new Map<string, Set<string>>();
  for (const schema of index.entities.filter(({ kind }) => kind === 'schema')) {
    for (const evidence of evidenceCites(schema)) {
      const candidates = bindings.get(evidence) ?? new Set<string>();
      candidates.add(schema.id);
      bindings.set(evidence, candidates);
    }
  }
  return bindings;
}

function singleSchema(
  contracts: readonly string[],
  ids: ReadonlyMap<string, ReadonlySet<string>>,
): string | null {
  if (contracts.length !== 1) return null;
  const [contract] = contracts;
  const candidates = contract === undefined ? undefined : ids.get(contract);
  return candidates?.size === 1 ? (candidates.values().next().value ?? null) : null;
}

function observation(
  entry: ModelEntity,
  route: Route,
  ids: ReadonlyMap<string, ReadonlySet<string>>,
): ContractObservation | null {
  const values: Record<string, string> = {};
  const request = singleSchema(route.input_contract_ids, ids);
  const response = singleSchema(route.output_contract_ids, ids);
  if (request !== null && entry.data.request === undefined) values.request = request;
  if (response !== null && entry.data.response === undefined) values.response = response;
  return Object.keys(values).length === 0 ? null : { values, cites: [route.id] };
}

/** Fill only the unique contract directly joined by an observed route and a declared schema. */
export function routeContracts(
  index: Pick<ModelIndex, 'entities'>,
  repository: Pick<ModelRepository, 'records'>,
): ReadonlyMap<string, ContractObservation> {
  const routes = repository.records.flatMap(({ family, data }) =>
    family === 'framework' && data.kind === 'aspnet_route_binding' ? [data] : [],
  );
  if (routes.length === 0) return new Map();
  const ids = schemaIds(index);
  const results = new Map<string, ContractObservation>();
  for (const entry of index.entities.filter(({ kind }) => kind === 'endpoint')) {
    const cited = new Set(evidenceCites(entry));
    const matches = routes.filter(
      (route) =>
        route.template === entry.data.path &&
        new Set<unknown>(route.httpMethods).has(entry.data.method) &&
        cited.has(route.id),
    );
    const [route] = matches;
    if (route === undefined || matches.length !== 1) continue;
    const next = observation(entry, route, ids);
    if (next !== null) results.set(entry.id, next);
  }
  return results;
}
