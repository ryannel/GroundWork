// Citation locations come from the schema, including recursive steps; business JSON stays untouched.
import { appendChild, failureId, parseId } from '@/domain/ids';
import { CITATION_SHAPES, type CitationShape } from '@/domain/model/citations.generated';
import { modelList, modelRecord, modelText } from '@/domain/workspace-model';

export interface CitationContext {
  readonly entity: string;
  readonly path: readonly (string | number)[];
  readonly localPath: readonly (string | number)[];
  readonly handler: Readonly<Record<string, unknown>> | null;
}
export type CitationVisitor = (
  values: readonly unknown[],
  context: CitationContext,
) => readonly unknown[];

const ENTITIES = new Set([
  'WorkspaceFile',
  'DomainFile',
  'SystemFile',
  'ServiceComponent',
  'AppComponent',
  'StoreComponent',
  'TopicComponent',
  'Library',
  'External',
  'Interface',
  'RestInterface',
  'GraphqlInterface',
  'GrpcInterface',
  'SdkInterface',
  'Endpoint',
  'RestEntry',
  'GraphqlEntry',
  'GrpcEntry',
  'SdkEntry',
  'Message',
  'Subscription',
  'Job',
  'Interaction',
  'Operation',
  'Schema',
  'Screen',
  'Handler',
  'Step',
  'Field',
  'Region',
  'Failure',
  'Concept',
  'KeyTerm',
  'GraphFile',
  'Subgraph',
  'FlowFile',
  'FlowStep',
  'JourneyFile',
  'ProgrammeFile',
  'Area',
]);

function citationEntity(definition: string, id: string, parent: string): string {
  if (parseId(id) !== null || definition === 'WorkspaceFile') return id;
  return definition === 'Failure' ? failureId(parent, id) : appendChild(parent, id);
}
function contextOf(definition: string, value: unknown, context: CitationContext): CitationContext {
  const data = modelRecord(value);
  const id = modelText(data?.id);
  if (data === null || id === null || !ENTITIES.has(definition)) return context;
  const entity = citationEntity(definition, id, context.entity);
  return {
    ...context,
    entity,
    localPath: [],
    handler: definition === 'Handler' ? data : context.handler,
  };
}
function namedValue(
  definition: string,
  value: unknown,
  context: CitationContext,
  visitor: CitationVisitor,
): unknown {
  const shape = CITATION_SHAPES[definition];
  if (shape === undefined) return value;
  return mapShape(shape, value, contextOf(definition, value, context), visitor);
}
function mappedProperties(
  shape: CitationShape,
  value: unknown,
  context: CitationContext,
  visitor: CitationVisitor,
): unknown {
  const data = modelRecord(value);
  if (data === null || shape.props === undefined) return value;
  const replacements = shape.props.flatMap(([key, child]) =>
    key in data
      ? [
          [
            key,
            mapShape(
              child,
              data[key],
              { ...context, path: [...context.path, key], localPath: [...context.localPath, key] },
              visitor,
            ),
          ],
        ]
      : [],
  );
  return { ...data, ...Object.fromEntries(replacements) };
}
function mapShape(
  shape: CitationShape,
  value: unknown,
  context: CitationContext,
  visitor: CitationVisitor,
): unknown {
  if (shape.cites === true) return visitor(modelList(value), context);
  if (shape.ref !== undefined) return namedValue(shape.ref, value, context, visitor);
  const childShape = shape.items;
  const mapped =
    childShape === undefined || !Array.isArray(value)
      ? mappedProperties(shape, value, context, visitor)
      : value.map((child: unknown, index) =>
          mapShape(
            childShape,
            child,
            {
              ...context,
              path: [...context.path, index],
              localPath: [...context.localPath, index],
            },
            visitor,
          ),
        );
  return (shape.choices ?? []).reduce<unknown>(
    (current, choice) => mapShape(choice, current, context, visitor),
    mapped,
  );
}

/** Transform only schema-declared source citations, retaining every other value and declared id. */
export function mapSourceCitations(
  definition: string,
  value: unknown,
  entity: string,
  visitor: CitationVisitor,
): unknown {
  return namedValue(definition, value, { entity, path: [], localPath: [], handler: null }, visitor);
}
