import 'server-only';

import type { JavaUnit } from './java-declarations';
import { springAnnotationGaps } from './spring-schema-gaps';
import { springInstantiate } from './spring-schema-generics';
import {
  springDeclaration,
  springInheritedDeclarations,
  type SpringDeclaration,
} from './spring-schema-inheritance';
import { springPolymorphism, type SpringPolymorphism } from './spring-schema-polymorphism';
import {
  springSchemaProfile,
  type RouteSchemaUse,
  type SpringSchemaProfile,
} from './spring-schema-profiles';
import {
  springDeclaredProperties,
  springLombokAccessors,
  type SpringDeclaredProperty,
} from './spring-schema-properties';
import { springTypeReference, type SpringTypeReference } from './spring-schema-types';

export interface SpringSchemaGap {
  readonly kind: string;
  readonly typeName: string;
  readonly detail: string;
}
export interface SpringSchemaBinding {
  readonly kind: 'schema_binding';
  readonly id: string;
  readonly typeName: string;
  readonly direction: 'source' | 'request' | 'response';
  readonly properties: readonly SpringDeclaredProperty[];
  readonly inheritedTypes: readonly string[];
  readonly genericArguments: readonly string[];
  readonly enumValues: readonly string[];
  readonly polymorphism: SpringPolymorphism | null;
  readonly completeness: 'complete' | 'partial';
  readonly gaps: readonly SpringSchemaGap[];
  readonly source: string;
  readonly support: readonly string[];
  readonly profiles: readonly SpringSchemaProfile[];
}

const BUILTINS = new Set([
  'String',
  'Boolean',
  'boolean',
  'Integer',
  'int',
  'Long',
  'long',
  'Short',
  'short',
  'Byte',
  'byte',
  'Double',
  'double',
  'Float',
  'float',
  'Character',
  'char',
  'BigDecimal',
  'BigInteger',
  'Instant',
  'LocalDate',
  'LocalDateTime',
  'OffsetDateTime',
  'ZonedDateTime',
  'UUID',
  'Object',
  'void',
]);

function referencedTypes(reference: SpringTypeReference): readonly string[] {
  const nested = reference.arguments.flatMap(referencedTypes);
  return reference.container === 'value' ? [reference.name, ...nested] : nested;
}
function missingTypes(
  declaration: SpringDeclaration,
  declarations: readonly SpringDeclaration[],
  properties: readonly SpringDeclaredProperty[],
): readonly SpringSchemaGap[] {
  const missing = new Set<string>();
  for (const property of properties) {
    const owner =
      declarations.find(
        (candidate) =>
          candidate.type.fields.some((field) => field.source === property.source) ||
          candidate.type.methods.some((method) => method.source === property.source),
      ) ?? declaration;
    for (const name of referencedTypes(springTypeReference(property.type))) {
      if (
        !BUILTINS.has(name.split('.').at(-1) ?? name) &&
        springDeclaration(name, owner.unit, declarations) === undefined
      ) {
        missing.add(name);
      }
    }
  }
  return [...missing].map((typeName) => ({
    kind: 'external_type',
    typeName,
    detail:
      'Type declaration is unavailable in the pinned source set; its fields and enum values remain unknown.',
  }));
}
function propertiesOf(
  declaration: SpringDeclaration,
  declarations: readonly SpringDeclaration[],
): readonly SpringDeclaredProperty[] {
  const inherited = springInheritedDeclarations(declaration, declarations).declarations;
  const properties = new Map<string, SpringDeclaredProperty>();
  for (const parent of inherited.toReversed()) {
    for (const property of springDeclaredProperties(parent.type)) {
      const inheritedProperty = properties.get(property.name);
      properties.set(
        property.name,
        inheritedProperty
          ? {
              ...property,
              constraints: [...inheritedProperty.constraints, ...property.constraints],
              views: [...new Set([...inheritedProperty.views, ...property.views])],
              annotations: [...inheritedProperty.annotations, ...property.annotations],
            }
          : property,
      );
    }
  }
  return [...properties.values()];
}
function binding(
  declaration: SpringDeclaration,
  declarations: readonly SpringDeclaration[],
  routes: readonly RouteSchemaUse[],
): SpringSchemaBinding {
  const inherited = springInheritedDeclarations(declaration, declarations);
  const properties = propertiesOf(declaration, declarations);
  const gaps: SpringSchemaGap[] = [
    ...missingTypes(declaration, declarations, properties),
    ...springAnnotationGaps(declaration.type.qualifiedName, properties),
    ...inherited.unresolved.map((typeName) => ({
      kind: 'external_parent',
      typeName,
      detail: 'Inherited declaration is unavailable; local fields are a partial source shape.',
    })),
    {
      kind: 'jackson_configuration',
      typeName: declaration.type.qualifiedName,
      detail:
        'Declared fields, accessors and annotations do not establish effective ObjectMapper visibility, naming, modules or constructor policy.',
    },
  ];
  const lombok = springLombokAccessors(declaration.type);
  if (lombok.length > 0) {
    gaps.push({
      kind: 'generated_accessors',
      typeName: declaration.type.qualifiedName,
      detail: `Source declares ${lombok.join(', ')}; generated methods and effective Jackson visibility are not present in this compiler input.`,
    });
  }
  const matching = routes.filter(
    (route) =>
      springDeclaration(route.typeName, declaration.unit, declarations)?.type.qualifiedName ===
      declaration.type.qualifiedName,
  );
  return {
    kind: 'schema_binding',
    id: `spring-schema:${declaration.type.qualifiedName}`,
    typeName: declaration.type.qualifiedName,
    direction: 'source',
    properties,
    inheritedTypes: [...declaration.type.extends, ...declaration.type.implements],
    genericArguments: [...declaration.type.extends, ...declaration.type.implements].flatMap(
      (name) => springTypeReference(name).arguments.map((argument) => argument.name),
    ),
    enumValues: declaration.type.enumValues,
    polymorphism: springPolymorphism(declaration.type.annotations),
    completeness: gaps.length > 0 ? 'partial' : 'complete',
    gaps,
    source: declaration.type.source,
    support: profileSupport(declaration, declarations, matching),
    profiles: matching.map((route) =>
      springSchemaProfile(route, { unit: declaration.unit, declarations, properties }),
    ),
  };
}

/** Native source shapes retain references rather than flattening missing parents or recursive DTOs. */
export function collectSpringSchemas(
  units: readonly JavaUnit[],
  routes: readonly RouteSchemaUse[] = [],
): readonly SpringSchemaBinding[] {
  const declarations = units.flatMap((unit) => unit.types.map((type) => ({ unit, type })));
  const unboundRoutes = routes.filter(
    (route) => springTypeReference(route.typeName).arguments.length === 0,
  );
  const source = declarations.map((declaration) =>
    binding(declaration, declarations, unboundRoutes),
  );
  const specialized = routes.flatMap((route) => specializedBinding(route, declarations));
  return [...source, ...specialized];
}

function specializedBinding(
  route: RouteSchemaUse,
  declarations: readonly SpringDeclaration[],
): readonly SpringSchemaBinding[] {
  const reference = springTypeReference(route.typeName);
  if (reference.arguments.length === 0) return [];
  const declaration = declarations.find(
    (candidate) =>
      candidate.type.qualifiedName === reference.name || candidate.type.name === reference.name,
  );
  if (!declaration) return [];
  const instantiated = {
    ...declaration,
    type: springInstantiate(declaration.type, route.typeName),
  };
  const result = binding(instantiated, declarations, [route]);
  const typeName = `${declaration.type.qualifiedName}<${reference.arguments.map((argument) => argument.name).join(',')}>`;
  return [
    {
      ...result,
      id: `${result.id}:${route.routeId}:${route.direction}`,
      typeName,
      genericArguments: reference.arguments.map((argument) => argument.name),
    },
  ];
}

function profileSupport(
  declaration: SpringDeclaration,
  declarations: readonly SpringDeclaration[],
  routes: readonly RouteSchemaUse[],
): readonly string[] {
  const inherited = springInheritedDeclarations(declaration, declarations);
  return [
    ...new Set([
      ...inherited.declarations.map((parent) => parent.type.source),
      ...routes
        .flatMap((route) => [...route.validationGroups, ...route.views])
        .flatMap((profile) => {
          const resolved = springDeclaration(profile, declaration.unit, declarations);
          return resolved
            ? springInheritedDeclarations(resolved, declarations).declarations.map(
                (parent) => parent.type.source,
              )
            : [];
        }),
    ]),
  ];
}
