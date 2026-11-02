import 'server-only';

import type {
  BindingRecord,
  Gap,
  LocalSummary,
  ScanDocument,
  SemanticRecord,
  Source,
} from '@/domain/scan/scan.generated';

import { type JavaUnit, resolveJavaType } from './java-declarations';
import { scanValidator } from './scan-format';
import { sourceDigest } from './source-index';
import type { SourceIndex } from './source-index-types';
import type { ConfigurationBinding } from './spring-configuration-types';
import { springProgramBindings } from './spring-program-bindings';
import { springRoutes, type SpringRoute } from './spring-routes';
import { collectSpringSchemas } from './spring-schema-bindings';
import type { RouteSchemaUse } from './spring-schema-profiles';
import { springTypeReference, type SpringTypeReference } from './spring-schema-types';
import { springSecurity } from './spring-security';
import { springInterceptors } from './spring-security-interceptors';

interface FrameworkInput {
  readonly units: readonly JavaUnit[];
  readonly sources: readonly Source[];
  readonly indexes?: readonly SourceIndex[];
  readonly semantic?: readonly SemanticRecord[];
  readonly summaries?: readonly LocalSummary[];
  readonly gaps?: readonly Gap[];
  readonly resourceBindings?: readonly (BindingRecord | ConfigurationBinding)[];
}

function emptyRecords(): Record<
  | 'rules'
  | 'derivations'
  | 'obligations'
  | 'receipts'
  | 'contracts'
  | 'effects'
  | 'actors'
  | 'surfaces'
  | 'controls'
  | 'actions'
  | 'outcomes'
  | 'executions'
  | 'journeys'
  | 'dependencies'
  | 'closures',
  readonly never[]
> {
  return {
    rules: [],
    derivations: [],
    obligations: [],
    receipts: [],
    contracts: [],
    effects: [],
    actors: [],
    surfaces: [],
    controls: [],
    actions: [],
    outcomes: [],
    executions: [],
    journeys: [],
    dependencies: [],
    closures: [],
  };
}

function qualifiedReference(reference: SpringTypeReference, unit: JavaUnit): string {
  if (reference.container === 'array' && reference.name === 'array') {
    return `${qualifiedReference(reference.arguments[0] ?? reference, unit)}[]`;
  }
  const name = resolveJavaType(reference.name, unit);
  const typeArguments = reference.arguments.map((argument) => qualifiedReference(argument, unit));
  return typeArguments.length === 0 ? name : `${name}<${typeArguments.join(',')}>`;
}

function references(reference: SpringTypeReference): readonly SpringTypeReference[] {
  return [reference, ...reference.arguments.flatMap(references)];
}

function routeUses(route: SpringRoute, units: readonly JavaUnit[]): readonly RouteSchemaUse[] {
  const unit = units.find((candidate) =>
    candidate.types.some((type) =>
      type.methods.some((method) => method.source === route.method.declaration_source_id),
    ),
  );
  if (!unit) return [];
  const inputs = [
    ...route.parameters
      .filter((parameter) => parameter.location === 'body')
      .map((parameter): RouteSchemaUse => ({
        routeId: route.id,
        typeName: parameter.type,
        direction: 'request',
        validationGroups: parameter.validation_groups,
        views: parameter.json_views,
      })),
    {
      routeId: route.id,
      typeName: route.method.return_type,
      direction: 'response' as const,
      validationGroups: [],
      views: route.response_json_views,
    },
  ];
  return inputs.flatMap((input) =>
    references(springTypeReference(input.typeName)).map((reference) => ({
      ...input,
      typeName: qualifiedReference(reference, unit),
    })),
  );
}

/** Enumerate evidence references, never infer facts from their human-readable descriptions. */
function frameworkSourceIds(value: unknown): readonly string[] {
  if (typeof value === 'string') return value.startsWith('source:') ? [value] : [];
  if (Array.isArray(value)) return value.flatMap(frameworkSourceIds);
  if (typeof value !== 'object' || value === null) return [];
  return Object.values(value).flatMap(frameworkSourceIds);
}

/** Compact source-declared bindings; the full execution index remains in immutable shards. */
export async function springFrameworkDocument(input: FrameworkInput): Promise<ScanDocument> {
  const routes = springRoutes(input.units);
  const schemas = collectSpringSchemas(
    input.units,
    routes.flatMap((route) => routeUses(route, input.units)),
  );
  const boundRoutes = routes.map((route) => ({
    ...route,
    schema_binding_ids: schemas
      .filter((schema) => schema.profiles.some((profile) => profile.routeId === route.id))
      .map((schema) => schema.id),
  }));
  const framework = [
    ...boundRoutes,
    ...schemas,
    ...springSecurity(input.units),
    ...springInterceptors(input.units),
  ];
  const bindings = [
    ...springProgramBindings({
      indexes: input.indexes ?? [],
      units: input.units,
      executionSources: (input.semantic ?? [])
        .filter((record) => record.kind === 'semantic_node' && record.nodeKind === 'function')
        .map((record) => record.source),
    }),
    ...(input.resourceBindings ?? []),
  ];
  const evidence = {
    semantic: input.semantic ?? [],
    summaries: input.summaries ?? [],
    gaps: input.gaps ?? [],
  };
  const wanted = new Set(frameworkSourceIds([framework, bindings, evidence]));
  const sources = input.sources.filter((source) => wanted.has(source.id));
  const hosts = [...new Set(sources.map((source) => source.host))].map((host) => ({
    kind: 'host',
    id: host,
    component: 'scope:spring-framework:source',
    environment: 'unknown',
    support: sources
      .filter((source) => source.host === host)
      .slice(0, 1)
      .map((source) => source.id),
  }));
  const parse = await scanValidator();
  const document = {
    format: 'scan/v1',
    id: `scan:spring:${sourceDigest(JSON.stringify([framework, bindings, evidence]))}`,
    sources,
    hosts,
    framework,
    bindings,
    ...evidence,
    ...emptyRecords(),
  };
  return parse(document);
}
