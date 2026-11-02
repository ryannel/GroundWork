import 'server-only';

import { annotationName } from './spring-schema-annotations';
import type { SpringSchemaGap } from './spring-schema-bindings';
import type { SpringDeclaredProperty } from './spring-schema-properties';

const DECLARATIVE = new Set([
  'Valid',
  'JsonView',
  'JsonProperty',
  'JsonIgnore',
  'Schema',
  'Deprecated',
  'Override',
  'Getter',
  'Setter',
  'Builder',
  'JsonInclude',
  'JsonFormat',
  'JsonAlias',
]);

export function springAnnotationGaps(
  typeName: string,
  properties: readonly SpringDeclaredProperty[],
): readonly SpringSchemaGap[] {
  return properties.flatMap((property) =>
    property.annotations
      .filter(
        (annotation) =>
          !DECLARATIVE.has(annotationName(annotation)) &&
          !property.constraints.some((constraint) => constraint.annotation === annotation.name),
      )
      .map((annotation) => ({
        kind: 'annotation_semantics',
        typeName,
        detail: `${property.name} declares @${annotation.name}; extension annotation semantics are retained as source and are not interpreted as standard validation constraints.`,
      })),
  );
}
