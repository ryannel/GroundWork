import 'server-only';

import type { JavaUnit } from './java-declarations';
import { springConstraintNonNull, type SpringConstraint } from './spring-schema-annotations';
import {
  springProfileClosure,
  springProfileUnresolved,
  type SpringDeclaration,
} from './spring-schema-inheritance';
import type { SpringDeclaredProperty } from './spring-schema-properties';

export interface RouteSchemaUse {
  readonly routeId: string;
  readonly typeName: string;
  readonly direction: 'request' | 'response';
  readonly validationGroups: readonly string[];
  readonly views: readonly string[];
  readonly defaultViewInclusion?: boolean;
}
export interface SpringSchemaProfile {
  readonly routeId: string;
  readonly direction: 'request' | 'response';
  readonly validationGroups: readonly string[];
  readonly views: readonly string[];
  readonly fields: readonly {
    readonly name: string;
    readonly included: boolean | 'unknown';
    readonly constraints: readonly SpringConstraint[];
    readonly nonNull: boolean | 'unknown';
  }[];
  readonly completeness: 'complete' | 'partial';
  readonly gaps: readonly string[];
}
interface ProfileContext {
  readonly unit: JavaUnit;
  readonly declarations: readonly SpringDeclaration[];
  readonly properties: readonly SpringDeclaredProperty[];
}

function included(
  property: SpringDeclaredProperty,
  route: RouteSchemaUse,
  context: ProfileContext,
): boolean | 'unknown' {
  let inclusion: boolean | 'unknown' = true;
  if (route.views.length > 0) {
    const views = springProfileClosure(route.views, context.unit, context.declarations);
    inclusion =
      property.views.length === 0
        ? (route.defaultViewInclusion ?? 'unknown')
        : property.views.some((view) => views.includes(view));
    const unresolved = springProfileUnresolved(route.views, context.unit, context.declarations);
    if (property.views.length > 0 && inclusion === false && unresolved.length > 0) {
      inclusion = 'unknown';
    }
  }
  return inclusion;
}

export function springSchemaProfile(
  route: RouteSchemaUse,
  context: ProfileContext,
): SpringSchemaProfile {
  const groups = springProfileClosure(route.validationGroups, context.unit, context.declarations);
  const fields = context.properties.map((property): SpringSchemaProfile['fields'][number] => {
    const constraints = property.constraints.filter((constraint) =>
      constraint.groups.some((group) => groups.includes(group)),
    );
    return {
      name: property.jsonName,
      included: included(property, route, context),
      constraints,
      nonNull: springConstraintNonNull(constraints, groups) ? true : 'unknown',
    };
  });
  const viewGaps = fields.some((field) => field.included === 'unknown')
    ? ['Default JsonView inclusion has not been established from ObjectMapper configuration.']
    : [];
  const inheritanceGaps = springProfileUnresolved(
    [...route.validationGroups, ...route.views],
    context.unit,
    context.declarations,
  ).map((profile) => `Profile inheritance is unresolved for ${profile}.`);
  const gaps = [...viewGaps, ...inheritanceGaps];
  return {
    routeId: route.routeId,
    direction: route.direction,
    validationGroups: groups,
    views: route.views,
    fields,
    completeness: gaps.length > 0 ? 'partial' : 'complete',
    gaps,
  };
}
