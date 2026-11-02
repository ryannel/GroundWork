import 'server-only';

import type { JavaAnnotation, JavaUnit } from './java-declarations';
import { springMethods, springMethodAuthorisation } from './spring-route-methods';
import { springLiteral } from './spring-route-values';
import { springSecurityContext } from './spring-security-context';

export interface SpringSecurity {
  readonly kind: 'security_binding';
  readonly id: string;
  readonly source_ids: readonly string[];
  readonly mechanism: 'method_authorisation';
  readonly scope: string;
  readonly policies: readonly { readonly expression: string; readonly source_id: string }[];
  readonly activation: {
    readonly state: 'source_enabled' | 'unresolved' | 'disabled';
    readonly source_ids: readonly string[];
  };
  readonly authentication: readonly string[];
  readonly authorisation: readonly string[];
  readonly enforcement_chain: readonly {
    readonly stage: string;
    readonly source_ids: readonly string[];
    readonly detail: string;
  }[];
  readonly uncertainties: readonly string[];
}

function activation(
  units: readonly JavaUnit[],
  policy: JavaAnnotation,
): SpringSecurity['activation'] {
  const enabled = units.flatMap((unit) =>
    unit.types.flatMap((type) =>
      type.annotations.filter(
        (annotation) =>
          annotation.name ===
            'org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity' ||
          annotation.name ===
            'org.springframework.security.config.annotation.method.configuration.EnableGlobalMethodSecurity',
      ),
    ),
  );
  const active = enabled.map((annotation) => policyEnabled(annotation, policy));
  let state: SpringSecurity['activation']['state'] = 'unresolved';
  if (active.length > 0 && active.every((entry) => entry === false)) state = 'disabled';
  if (active.includes(true)) state = 'source_enabled';
  return {
    state,
    source_ids: enabled.map((annotation) => annotation.source),
  };
}

export function springSecurity(units: readonly JavaUnit[]): readonly SpringSecurity[] {
  const bindings = new Map<string, SpringSecurity>();
  const context = springSecurityContext(units);
  for (const method of springMethods(units)) {
    const policy = springMethodAuthorisation(method);
    if (!policy) continue;
    const enablement = activation(units, policy);
    const expression = springLiteral(policy.arguments.value ?? '') ?? policy.arguments.value ?? '';
    const id = `spring-security:${policy.source}`;
    bindings.set(id, {
      kind: 'security_binding',
      id,
      source_ids: [
        ...new Set([
          policy.source,
          ...enablement.source_ids,
          ...context.flatMap((step) => step.source_ids),
        ]),
      ],
      mechanism: 'method_authorisation',
      scope: method.controller.qualifiedName,
      policies: [{ expression, source_id: policy.source }],
      activation: enablement,
      authentication: [
        'Authentication is supplied by framework configuration outside this method policy.',
      ],
      authorisation: [expression],
      enforcement_chain: [
        ...context,
        { stage: 'method_policy', source_ids: [policy.source], detail: expression },
        ...(enablement.source_ids.length > 0
          ? [
              {
                stage: 'framework_enablement',
                source_ids: enablement.source_ids,
                detail: enablement.state,
              },
            ]
          : []),
      ],
      uncertainties: [
        'Source enablement does not establish runtime proxying, deployment or successful authorisation.',
        ...(enablement.state === 'unresolved'
          ? [
              'Method security enablement is not established by the selected source; external dependency configuration remains unresolved.',
            ]
          : []),
      ],
    });
  }
  return [...bindings.values()];
}

function enabledValue(value: string | undefined, defaultValue: boolean): boolean | undefined {
  if (value === undefined) return defaultValue;
  if (value === 'true') return true;
  if (value === 'false') return false;
  return undefined;
}

function policyEnabled(annotation: JavaAnnotation, policy: JavaAnnotation): boolean | undefined {
  if (policy.name.endsWith('RolesAllowed')) {
    return enabledValue(annotation.arguments.jsr250Enabled, false);
  }
  if (policy.name.endsWith('Secured')) {
    return enabledValue(annotation.arguments.securedEnabled, false);
  }
  return enabledValue(
    annotation.arguments.prePostEnabled,
    !annotation.name.endsWith('EnableGlobalMethodSecurity'),
  );
}
