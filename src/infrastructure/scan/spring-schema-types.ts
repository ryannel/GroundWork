import 'server-only';

import { springAnnotationValues } from './spring-route-values';

export interface SpringTypeReference {
  readonly name: string;
  readonly arguments: readonly SpringTypeReference[];
  readonly container: 'array' | 'map' | 'value';
  readonly annotations: readonly string[];
}

/** Recurses over a compiler type expression; annotations stay attached to their type use. */
export function springTypeReference(expression: string): SpringTypeReference {
  const annotations: string[] = [];
  let clean = expression.trim();
  let annotation = /^@([\w.]+)(?:\([^)]*\))?\s*/u.exec(clean);
  while (annotation) {
    annotations.push(annotation[1] ?? '');
    clean = clean.slice(annotation[0].length);
    annotation = /^@([\w.]+)(?:\([^)]*\))?\s*/u.exec(clean);
  }
  if (clean.endsWith('[]')) {
    return {
      name: 'array',
      arguments: [springTypeReference(clean.slice(0, -2))],
      container: 'array',
      annotations,
    };
  }
  const opening = clean.indexOf('<');
  const name = opening === -1 ? clean : clean.slice(0, opening).trim();
  const typeArguments =
    opening === -1
      ? []
      : springAnnotationValues(clean.slice(opening + 1, -1)).map(springTypeReference);
  const shortName = name.split('.').at(-1) ?? name;
  let container: SpringTypeReference['container'] = 'value';
  if (['List', 'Set', 'Collection', 'Iterable'].includes(shortName)) container = 'array';
  if (['Map', 'SortedMap'].includes(shortName)) container = 'map';
  return { name, arguments: typeArguments, container, annotations };
}
