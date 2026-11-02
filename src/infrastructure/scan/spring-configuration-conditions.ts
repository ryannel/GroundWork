import 'server-only';

import type { JavaAnnotation } from './java-declarations';
import type { ConfigurationBinding } from './spring-configuration-types';

const BEAN = 'org.springframework.boot.autoconfigure.condition.ConditionalOnBean';
const PROPERTY = 'org.springframework.boot.autoconfigure.condition.ConditionalOnProperty';

/** Activation annotations remain source declarations, never evaluated conditions. */
export function configurationConditions(owner: {
  readonly source: string;
  readonly annotations: readonly JavaAnnotation[];
}): ConfigurationBinding['conditions'] {
  return owner.annotations.flatMap((annotation) => {
    if (annotation.name !== BEAN && annotation.name !== PROPERTY) return [];
    return [
      {
        source: annotation.source,
        owner_source: owner.source,
        annotation_type: annotation.name,
        arguments: Object.entries(annotation.arguments).map(([name, expression]) => ({
          name,
          expression,
        })),
      },
    ];
  });
}

/** One exact declared property name links candidates without selecting a running bean. */
export function configurationPropertyLink(
  owner: { readonly source: string; readonly annotations: readonly JavaAnnotation[] },
  keys: ReadonlySet<string>,
): boolean {
  return configurationConditions(owner).some((condition) => {
    if (condition.annotation_type !== PROPERTY) return false;
    const name = condition.arguments.find(
      (argument) => argument.name === 'name' || argument.name === 'value',
    )?.expression;
    if (name === undefined || !/^"[^"\\]*"$/u.test(name)) return false;
    return keys.has(name.slice(1, -1));
  });
}
