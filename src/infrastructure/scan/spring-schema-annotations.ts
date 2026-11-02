import 'server-only';

/** Annotation expressions are compiler-declared strings, never a complete-file search. */
export interface SpringSchemaAnnotation {
  readonly name: string;
  readonly arguments: Readonly<Record<string, string>>;
}

export interface SpringConstraint {
  readonly annotation: string;
  readonly groups: readonly string[];
  readonly attributes: Readonly<Record<string, string>>;
}

const CONSTRAINTS = new Set([
  'NotNull',
  'NotEmpty',
  'NotBlank',
  'Null',
  'Size',
  'Length',
  'Min',
  'Max',
  'DecimalMin',
  'DecimalMax',
  'Positive',
  'PositiveOrZero',
  'Negative',
  'NegativeOrZero',
  'Pattern',
  'Email',
  'Digits',
  'Past',
  'PastOrPresent',
  'Future',
  'FutureOrPresent',
  'AssertTrue',
  'AssertFalse',
]);

export function annotationName(annotation: SpringSchemaAnnotation): string {
  const name = annotation.name.split('.').at(-1) ?? annotation.name;
  if (name === annotation.name) return name;
  if (CONSTRAINTS.has(name)) {
    const packages =
      name === 'Length'
        ? ['org.hibernate.validator.constraints']
        : [
            'jakarta.validation.constraints',
            'javax.validation.constraints',
            'org.hibernate.validator.constraints',
          ];
    return packages.some((prefix) => annotation.name === `${prefix}.${name}`)
      ? name
      : annotation.name;
  }
  const known = [
    'com.fasterxml.jackson.annotation',
    'lombok',
    'io.swagger.v3.oas.annotations.media',
  ];
  if (known.some((prefix) => annotation.name === `${prefix}.${name}`)) return name;
  if (
    annotation.name === 'jakarta.validation.Valid' ||
    annotation.name === 'javax.validation.Valid'
  ) {
    return name;
  }
  return annotation.name;
}

/** Values remain source expressions so unresolved imported constants cannot become literals. */
export function annotationClasses(expression: string | undefined): readonly string[] {
  if (expression === undefined || expression === '') return [];
  return expression
    .replaceAll(/[{}]/gu, '')
    .split(',')
    .map((value) => value.trim().replace(/\.class$/u, ''))
    .filter((value) => value.length > 0);
}

export function springConstraints(
  annotations: readonly SpringSchemaAnnotation[],
): readonly SpringConstraint[] {
  return annotations
    .filter((annotation) => CONSTRAINTS.has(annotationName(annotation)))
    .map((annotation) => ({
      annotation: annotation.name,
      groups:
        annotationClasses(annotation.arguments.groups).length > 0
          ? annotationClasses(annotation.arguments.groups)
          : ['jakarta.validation.groups.Default'],
      attributes: Object.fromEntries(
        Object.entries(annotation.arguments).filter(
          ([name]) => name !== 'groups' && name !== 'message' && name !== 'payload',
        ),
      ),
    }));
}

export function springViews(annotations: readonly SpringSchemaAnnotation[]): readonly string[] {
  const view = annotations.find((annotation) => annotationName(annotation) === 'JsonView');
  return annotationClasses(view?.arguments.value);
}

export function springJsonName(
  name: string,
  annotations: readonly SpringSchemaAnnotation[],
): string {
  const property = annotations.find((annotation) => annotationName(annotation) === 'JsonProperty');
  const value = property?.arguments.value;
  return value !== undefined && value.startsWith('"') && value.endsWith('"')
    ? value.slice(1, -1)
    : name;
}

export function springJsonIgnored(annotations: readonly SpringSchemaAnnotation[]): boolean {
  return annotations.some(
    (annotation) =>
      annotationName(annotation) === 'JsonIgnore' && annotation.arguments.value !== 'false',
  );
}

export function springConstraintNonNull(
  constraints: readonly SpringConstraint[],
  groups: readonly string[],
): boolean {
  return constraints.some(
    (constraint) =>
      ['NotNull', 'NotEmpty', 'NotBlank'].includes(
        constraint.annotation.split('.').at(-1) ?? constraint.annotation,
      ) && constraint.groups.some((group) => groups.includes(group)),
  );
}
