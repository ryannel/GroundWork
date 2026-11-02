import 'server-only';

import type { SourceIndex } from './source-index-types';

const WILDCARDS: Readonly<Record<string, readonly string[]>> = {
  'org.springframework.web.bind.annotation': [
    'RestController',
    'ControllerAdvice',
    'RestControllerAdvice',
    'RequestMapping',
    'GetMapping',
    'PostMapping',
    'PutMapping',
    'PatchMapping',
    'DeleteMapping',
    'RequestBody',
    'RequestParam',
    'PathVariable',
    'RequestHeader',
    'ResponseStatus',
    'ExceptionHandler',
  ],
  'org.springframework.context.annotation': ['Configuration', 'Import', 'Bean'],
  'org.springframework.security.access.prepost': ['PreAuthorize', 'PostAuthorize'],
  'org.springframework.security.config.annotation.method.configuration': [
    'EnableMethodSecurity',
    'EnableGlobalMethodSecurity',
  ],
  'org.springframework.validation.annotation': ['Validated'],
  'jakarta.validation': ['Valid'],
  'javax.validation': ['Valid'],
  'com.fasterxml.jackson.annotation': [
    'JsonView',
    'JsonIgnore',
    'JsonProperty',
    'JsonTypeInfo',
    'JsonSubTypes',
    'JsonCreator',
    'JsonIgnoreProperties',
    'JsonInclude',
    'JsonFormat',
  ],
};

/** Resolve annotation identity from compiler imports; ambiguous wildcards stay unqualified. */
export function javaAnnotationName(index: SourceIndex, name: string): string {
  if (name.includes('.')) {
    return name;
  }
  const packageSpan = index.nodes[0]?.fields?.packageName?.[0];
  const packageName = packageSpan ? index.content.slice(packageSpan[0], packageSpan[1]) : '';
  const ownName = packageName === '' ? name : `${packageName}.${name}`;
  if (index.nodes.some((node) => node.kind === 'ANNOTATION_TYPE' && node.symbol === name)) {
    return ownName;
  }
  const imports = index.nodes
    .filter((node) => node.kind === 'IMPORT')
    .map((node) => node.symbol ?? '');
  const explicit = imports.find((entry) => entry.endsWith(`.${name}`));
  if (explicit !== undefined) return explicit;
  const wildcards = imports
    .filter((entry) => entry.endsWith('.*'))
    .map((entry) => entry.slice(0, -2));
  const unknown = wildcards.some((prefix) => WILDCARDS[prefix] === undefined);
  const candidates = wildcards.filter((prefix) => WILDCARDS[prefix]?.includes(name) === true);
  const prefix = !unknown && candidates.length === 1 ? candidates[0] : undefined;
  return prefix === undefined ? ownName : `${prefix}.${name}`;
}
