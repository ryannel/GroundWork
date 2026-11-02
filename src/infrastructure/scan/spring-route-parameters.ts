import 'server-only';

import type { JavaAnnotation, JavaMethod, JavaParameter } from './java-declarations';
import { springAnnotation, springMappingAnnotation } from './spring-route-methods';
import { springLiteral, springStrings } from './spring-route-values';
import { annotationClasses, springViews } from './spring-schema-annotations';

export interface SpringParameter {
  readonly name: string;
  readonly java_name: string;
  readonly type: string;
  readonly location: 'header' | 'query' | 'path' | 'body' | 'unbound';
  readonly required?: boolean;
  readonly default_value?: string;
  readonly source_id: string;
  readonly validation_groups: readonly string[];
  readonly json_views: readonly string[];
}

const LOCATIONS = {
  RequestHeader: 'header',
  RequestParam: 'query',
  PathVariable: 'path',
  RequestBody: 'body',
} as const;

export function springParameters(method: JavaMethod): readonly SpringParameter[] {
  return method.parameters.map(parameterBinding);
}

function parameterBinding(parameter: JavaParameter): SpringParameter {
  const profile = parameterProfile(parameter);
  const entry = Object.entries(LOCATIONS).find(([annotation]) =>
    springAnnotation(parameter.annotations, annotation),
  );
  if (!entry) {
    return {
      name: parameter.name,
      java_name: parameter.name,
      type: parameter.type,
      location: 'unbound',
      source_id: parameter.source,
      ...profile,
    };
  }
  const [name, location] = entry;
  const annotation = springAnnotation(parameter.annotations, name);
  const values = annotation?.arguments ?? {};
  const defaultValue = springLiteral(values.defaultValue ?? '');
  return {
    name: springLiteral(values.name ?? values.value ?? '') ?? parameter.name,
    java_name: parameter.name,
    type: parameter.type,
    location,
    required: defaultValue === undefined && values.required !== 'false',
    ...(defaultValue === undefined ? {} : { default_value: defaultValue }),
    source_id: parameter.source,
    ...profile,
  };
}

export interface SpringMapping {
  readonly methods: readonly string[];
  readonly paths: readonly string[];
  readonly source: string;
  readonly unresolved: boolean;
}

export function springMapping(annotations: readonly JavaAnnotation[]): SpringMapping | undefined {
  const mapping = springMappingAnnotation(annotations);
  if (!mapping) return undefined;
  const name = mapping.name.split('.').at(-1) ?? '';
  const paths = springStrings(mapping.arguments.path ?? mapping.arguments.value);
  const methods =
    name === 'RequestMapping'
      ? requestMethods(mapping.arguments.method)
      : [name.replace('Mapping', '').toUpperCase()];
  return {
    methods,
    paths: paths && paths.length > 0 ? paths : [''],
    source: mapping.source,
    unresolved: paths === undefined,
  };
}

function requestMethods(value: string | undefined): readonly string[] {
  if (value === undefined || value === '') return ['ANY'];
  return value
    .replaceAll(/[{}\s]/gu, '')
    .split(',')
    .map((method) => method.split('.').at(-1) ?? method);
}

function parameterProfile(
  parameter: JavaParameter,
): Pick<SpringParameter, 'validation_groups' | 'json_views'> {
  const validated = springAnnotation(parameter.annotations, 'Validated');
  const valid = springAnnotation(parameter.annotations, 'Valid');
  let groups = validated ? annotationClasses(validated.arguments.value) : [];
  if (groups.length === 0 && (validated !== undefined || valid !== undefined)) {
    groups = ['jakarta.validation.groups.Default'];
  }
  return { validation_groups: groups, json_views: springViews(parameter.annotations) };
}
