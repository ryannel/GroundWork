import { describe, expect, it, vi } from 'vitest';

import {
  springAnnotationValues,
  springLiteral,
  springPath,
  springStrings,
} from '@/infrastructure/scan/spring-route-values';

vi.mock(import('server-only'), () => ({}));

describe('Spring annotation values', () => {
  it('keeps strings and nested annotations together', () => {
    expect(
      springAnnotationValues('value = {"a,b", "c"}, required = false, nested = @X(a = "b,c")'),
    ).toEqual(['value = {"a,b", "c"}', 'required = false', 'nested = @X(a = "b,c")']);
  });
  it('does not infer string constants or expressions', () => {
    expect(springStrings('PREFIX')).toBeUndefined();
    expect(springStrings('"a" + "b"')).toBeUndefined();
    expect(springLiteral('42')).toBeUndefined();
  });
  it('reads literal alternatives and composes changed prefixes', () => {
    expect(springStrings('{"/a", "/b"}')).toEqual(['/a', '/b']);
    expect(springStrings()).toEqual([]);
    expect(springPath('/v2/', '/people/{id}')).toBe('/v2/people/{id}');
    expect(springPath('', '')).toBe('/');
  });
});
