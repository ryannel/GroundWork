import type { SpringDeclaredProperty, SpringSchemaBinding } from '@/domain/scan/scan.generated';
import type { ExplorerLink, ExplorerNode } from '@/domain/service-explorer';

import { visualFile } from './visual-file';
import type { VisualContext } from './visual-types';

interface PropertyGraph {
  readonly nodes: readonly ExplorerNode[];
  readonly links: readonly ExplorerLink[];
  readonly gaps: readonly string[];
}
interface TypeMatch {
  readonly token: string;
  readonly schema: SpringSchemaBinding;
  readonly qualified: boolean;
}

function matches(context: VisualContext, property: SpringDeclaredProperty): TypeMatch[] {
  const tokens = [...new Set(property.type.match(/[A-Za-z_$][\w.$]*/gu))];
  const schemas = context.input.records.filter((record) => record.kind === 'schema_binding');
  return tokens.flatMap((token) => {
    const qualified = token.includes('.');
    const found = schemas.filter((schema) =>
      qualified ? schema.typeName === token : schema.typeName.split('.').at(-1) === token,
    );
    return found.map((schema) => ({ token, schema, qualified: qualified && found.length === 1 }));
  });
}

function fieldNode(schema: SpringSchemaBinding, property: SpringDeclaredProperty): ExplorerNode {
  return {
    id: `${schema.id}:field:${property.source}:${property.name}`,
    label: `${property.jsonName}: ${property.type}`,
    detail:
      'Declared source field. Required and nullable remain unknown. Nested source types require qualified evidence; effective wire and stored representations remain separate.',
    kind: 'schema',
    sourceIds: [property.source],
    target: null,
  };
}

function referenceNode(
  context: VisualContext,
  field: ExplorerNode,
  match: TypeMatch,
): ExplorerNode {
  return {
    id: `${field.id}:type:${match.token}:${match.schema.id}`,
    label: `${match.qualified ? 'Declared type' : 'Candidate'}: ${match.schema.typeName}`,
    detail: match.qualified
      ? 'Exact qualified source type declaration; no wire, caller/provider or deployment compatibility is established.'
      : 'Candidate source type only. Qualification is unresolved; all matching declarations remain available.',
    kind: 'schema',
    sourceIds: [...field.sourceIds, match.schema.source],
    target: visualFile(context, match.schema.id),
  };
}

function propertyGraph(
  context: VisualContext,
  schema: SpringSchemaBinding,
  property: SpringDeclaredProperty,
): PropertyGraph {
  const field = fieldNode(schema, property);
  const found = matches(context, property);
  const references = found.map((match) => referenceNode(context, field, match));
  const declaration: ExplorerLink = {
    id: `declares:${field.id}`,
    from: schema.id,
    to: field.id,
    label: 'declared source field',
    kind: 'data',
    sourceIds: field.sourceIds,
  };
  return {
    nodes: [field, ...references],
    links: [
      declaration,
      ...references.map((node, index): ExplorerLink => ({
        id: `type:${node.id}`,
        from: field.id,
        to: node.id,
        label:
          found[index]?.qualified === true
            ? 'qualified source type'
            : 'candidate type; qualification unresolved',
        kind: 'data',
        sourceIds: node.sourceIds,
      })),
    ],
    gaps: found.some((match) => !match.qualified)
      ? [
          `${property.jsonName}: nested type qualification unresolved; ${String(found.length)} source candidate(s) retained.`,
        ]
      : [],
  };
}

export function visualSpringProperties(
  context: VisualContext,
  schema: SpringSchemaBinding,
): PropertyGraph {
  const graphs = schema.properties.map((property) => propertyGraph(context, schema, property));
  return {
    nodes: graphs.flatMap((graph) => graph.nodes),
    links: graphs.flatMap((graph) => graph.links),
    gaps: graphs.flatMap((graph) => graph.gaps),
  };
}
