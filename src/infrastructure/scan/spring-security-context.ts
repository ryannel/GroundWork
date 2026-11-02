import 'server-only';

import { type JavaAnnotation, type JavaUnit, resolveJavaType } from './java-declarations';
import { annotationClasses } from './spring-schema-annotations';
import type { SpringEnforcementStep } from './spring-security-chain';

const BOOT = new Set([
  'org.springframework.boot.autoconfigure.SpringBootApplication',
  'org.springframework.boot.autoconfigure.EnableAutoConfiguration',
]);

/** Configuration declarations remain evidence of source configuration, never active security. */
export function springSecurityContext(
  units: readonly JavaUnit[],
): readonly SpringEnforcementStep[] {
  return units.flatMap((unit) =>
    unit.types.flatMap((type) =>
      type.annotations.flatMap((annotation) => contextStep(annotation, unit, units)),
    ),
  );
}

function contextStep(
  annotation: JavaAnnotation,
  unit: JavaUnit,
  units: readonly JavaUnit[],
): readonly SpringEnforcementStep[] {
  if (BOOT.has(annotation.name)) {
    const exclusion = annotation.arguments.exclude ?? annotation.arguments.excludeName;
    return exclusion === undefined
      ? []
      : [
          {
            stage: 'configuration_exclusion',
            source_ids: [annotation.source],
            detail: `${annotation.name} excludes ${exclusion}; exclusion does not establish a replacement security filter chain or method-security enablement.`,
          },
        ];
  }
  if (annotation.name !== 'org.springframework.context.annotation.Import') return [];
  return annotationClasses(annotation.arguments.value).map((name) => {
    const qualified = resolveJavaType(name, unit);
    const local = units.some((entry) =>
      entry.types.some((type) => type.qualifiedName === qualified),
    );
    const availability = local
      ? 'Imported declaration is present in the selected source.'
      : 'Imported configuration source and its transitive dependency configuration are unavailable in the selected source.';
    return {
      stage: 'configuration_import',
      source_ids: [annotation.source],
      detail: `Imports ${qualified}. ${availability} This declaration does not establish active security or deployment.`,
    };
  });
}
