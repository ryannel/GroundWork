import type { Shape } from '@/domain/scan/scan.generated';
import type { CurrentRecord } from '@/domain/scan-explorer/current-contracts';
import type {
  ExplorerField,
  ExplorerNode,
  ExplorerPage,
  ExplorerLink,
} from '@/domain/service-explorer';

import { visualFile } from './visual-file';
import { visualPage } from './visual-page';
import { visualSpringProperties } from './visual-spring-properties';
import type { VisualContext } from './visual-types';

type Schema = Extract<CurrentRecord, { readonly kind: 'schema_binding' | 'contract' }>;

function references(shape: Shape): readonly string[] {
  switch (shape.kind) {
    case 'reference': {
      return [shape.target];
    }
    case 'object': {
      return shape.fields.flatMap((field) => references(field.shape));
    }
    case 'array': {
      return references(shape.item);
    }
    case 'map': {
      return [...references(shape.key), ...references(shape.value)];
    }
    case 'tuple': {
      return shape.items.flatMap(references);
    }
    case 'union': {
      return shape.alternatives.flatMap(references);
    }
    default: {
      return [];
    }
  }
}

function fields(schema: Schema): ExplorerField[] {
  if (schema.kind === 'schema_binding') {
    return schema.properties.map((property) => ({
      name: property.jsonName,
      type: property.type,
      required: 'unknown',
      nullable: 'unknown',
      sourceIds: [property.source],
    }));
  }
  if (schema.shape.kind !== 'object') return [];
  return schema.shape.fields.map((field) => ({
    name: field.name,
    type: field.shape.spelling,
    required: field.presence === 'required' ? 'yes' : 'no',
    nullable: field.nullable ? 'yes' : 'no',
    sourceIds: schema.support,
  }));
}

export function visualSchema(context: VisualContext, schema: Schema): ExplorerPage {
  const title = schema.kind === 'schema_binding' ? schema.typeName : schema.shape.spelling;
  const sourceIds = schema.kind === 'schema_binding' ? [schema.source] : schema.support;
  const nested = schema.kind === 'contract' ? [...new Set(references(schema.shape))] : [];
  const properties =
    schema.kind === 'schema_binding'
      ? visualSpringProperties(context, schema)
      : { nodes: [], links: [], gaps: [] };
  const nodes: ExplorerNode[] = [
    schemaRoot(schema, title, sourceIds),
    ...properties.nodes,
    ...nested
      .filter((id) => id !== schema.id)
      .map(
        (id) =>
          ({
            id,
            label:
              context.input.records
                .filter((record) => record.kind === 'contract')
                .find((record) => record.id === id)?.shape.spelling ?? id,
            detail: 'Exact source type reference',
            kind: 'schema',
            sourceIds,
            target: visualFile(context, id),
          }) satisfies ExplorerNode,
      ),
  ];
  return visualPage(context, {
    kind: 'data',
    title,
    description:
      'Source field declarations. Request validation groups, serialisers and stored representations retain their own uncertainty.',
    nodes,
    links: [
      ...properties.links,
      ...nested.map((id, index): ExplorerLink => ({
        id: `reference:${String(index)}`,
        from: schema.id,
        to: id,
        label: 'source type reference',
        kind: 'data',
        sourceIds,
      })),
    ],
    fields: fields(schema),
    gaps:
      schema.kind === 'schema_binding'
        ? [...schema.gaps.map((gap) => gap.detail), ...properties.gaps]
        : ['Source DTO constraints do not establish effective wire or persistence policy'],
    completeSelection:
      schema.kind === 'schema_binding'
        ? schema.completeness === 'complete' && properties.gaps.length === 0
        : true,
  });
}

function schemaRoot(schema: Schema, title: string, sourceIds: readonly string[]): ExplorerNode {
  return {
    id: schema.id,
    label: title.split('.').at(-1) ?? title,
    detail:
      'Declared source shape; effective wire or persisted representation is not established by this declaration',
    kind: 'schema',
    sourceIds,
    target: null,
  };
}
