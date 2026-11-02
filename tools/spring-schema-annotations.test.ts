import { describe, expect, it, vi } from 'vitest';

import {
  springConstraintNonNull,
  springConstraints,
  springJsonIgnored,
  springJsonName,
  springViews,
} from '@/infrastructure/scan/spring-schema-annotations';

vi.mock(import('server-only'), () => ({}));

describe('Spring source annotation semantics', () => {
  it('retains validation profiles rather than applying create constraints to patches', () => {
    const constraints = springConstraints([
      { name: 'NotNull', arguments: { groups: '{Views.Create.class, Views.Update.class}' } },
      { name: 'Min', arguments: { value: '0' } },
    ]);
    expect(constraints).toEqual([
      { annotation: 'NotNull', groups: ['Views.Create', 'Views.Update'], attributes: {} },
      {
        annotation: 'Min',
        groups: ['jakarta.validation.groups.Default'],
        attributes: { value: '0' },
      },
    ]);
    expect(springConstraintNonNull(constraints, ['Views.Create'])).toBe(true);
    expect(springConstraintNonNull(constraints, ['Views.Patch'])).toBe(false);
    expect(springConstraintNonNull(constraints.slice(1), ['Views.Create'])).toBe(false);
  });

  it('retains view declarations, explicit names and ignore false', () => {
    expect(
      springViews([{ name: 'JsonView', arguments: { value: '{Views.Update.class}' } }]),
    ).toEqual(['Views.Update']);
    expect(
      springJsonName('declared', [{ name: 'JsonProperty', arguments: { value: '"wire"' } }]),
    ).toBe('wire');
    expect(
      springJsonName('declared', [{ name: 'JsonProperty', arguments: { value: 'IMPORTED_NAME' } }]),
    ).toBe('declared');
    expect(springJsonIgnored([{ name: 'JsonIgnore', arguments: {} }])).toBe(true);
    expect(springJsonIgnored([{ name: 'JsonIgnore', arguments: { value: 'false' } }])).toBe(false);
  });

  it('preserves unresolved constraint values and unknown validation annotations', () => {
    expect(
      springConstraints([
        { name: 'Length', arguments: { max: 'FIRST_NAME_MAX_LENGTH' } },
        { name: 'Schema', arguments: { requiredMode: 'REQUIRED' } },
      ]),
    ).toEqual([
      {
        annotation: 'Length',
        groups: ['jakarta.validation.groups.Default'],
        attributes: { max: 'FIRST_NAME_MAX_LENGTH' },
      },
    ]);
  });
  it('does not treat unrelated annotations with the same simple name as framework declarations', () => {
    expect(springConstraints([{ name: 'example.NotNull', arguments: {} }])).toEqual([]);
    expect(
      springConstraints([{ name: 'com.fasterxml.jackson.annotation.NotNull', arguments: {} }]),
    ).toEqual([]);
    expect(
      springViews([{ name: 'example.JsonView', arguments: { value: 'Views.Create.class' } }]),
    ).toEqual([]);
    expect(springJsonIgnored([{ name: 'example.JsonIgnore', arguments: {} }])).toBe(false);
    expect(
      springConstraints([{ name: 'jakarta.validation.constraints.NotNull', arguments: {} }]),
    ).toHaveLength(1);
  });
});
