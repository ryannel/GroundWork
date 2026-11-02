import { describe, expect, it, vi } from 'vitest';

import {
  javaDeclarations,
  type JavaType,
  type JavaUnit,
} from '@/infrastructure/scan/java-declarations';
import { indexSource } from '@/infrastructure/scan/source-index';
import { collectSpringSchemas } from '@/infrastructure/scan/spring-schema-bindings';
import {
  springInheritedDeclarations,
  springProfileClosure,
} from '@/infrastructure/scan/spring-schema-inheritance';
import { springPolymorphism } from '@/infrastructure/scan/spring-schema-polymorphism';
import { springDeclaredProperties } from '@/infrastructure/scan/spring-schema-properties';
import { springTypeReference } from '@/infrastructure/scan/spring-schema-types';

vi.mock(import('server-only'), () => ({}));

function type(name: string, overrides: Partial<JavaType> = {}): JavaType {
  return {
    name,
    qualifiedName: `example.${name}`,
    extends: [],
    implements: [],
    annotations: [],
    methods: [],
    fields: [],
    source: 'source',
    kind: 'class',
    enumValues: [],
    ...overrides,
  };
}
function unit(types: readonly JavaType[]): JavaUnit {
  return { path: 'Example.java', packageName: 'example', imports: [], types, source: 'source' };
}

describe('Spring declaration schemas', () => {
  it('preserves nested type-use validation, map values and array shape', () => {
    const reference = springTypeReference('Map<String, List<@Valid Customer[]>>');
    expect(reference.container).toBe('map');
    expect(reference.arguments[1]?.container).toBe('array');
    expect(reference.arguments[1]?.arguments[0]).toEqual({
      name: 'array',
      annotations: ['Valid'],
      container: 'array',
      arguments: [{ name: 'Customer', annotations: [], container: 'value', arguments: [] }],
    });
  });

  it('does not turn validation non-null into required JSON presence', () => {
    const declaration = type('Request', {
      fields: [
        {
          name: 'nested',
          type: 'Child',
          source: 'field',
          initializer: null,
          modifiers: ['private'],
          annotations: [{ name: 'NotNull', arguments: {}, source: 'annotation' }],
        },
      ],
    });
    const property = springDeclaredProperties(declaration)[0];
    expect(property?.presence).toBe('unknown');
    expect(property?.nullable).toBe('unknown');
    expect(property?.constraints[0]?.annotation).toBe('NotNull');
    expect(
      springDeclaredProperties({
        ...declaration,
        fields: declaration.fields.map((field) => ({ ...field, annotations: [] })),
      })[0]?.constraints,
    ).toEqual([]);
  });

  it('merges annotated source getters and honours explicit ignore', () => {
    const declaration = type('Request', {
      methods: [
        {
          name: 'getType',
          parameters: [],
          returnType: 'Kind',
          source: 'getter',
          summary: null,
          body: null,
          annotations: [{ name: 'NotNull', arguments: {}, source: 'annotation' }],
        },
      ],
    });
    expect(springDeclaredProperties(declaration)[0]).toMatchObject({
      name: 'type',
      access: 'declared_getter',
      constraints: [{ annotation: 'NotNull' }],
    });
    expect(
      springDeclaredProperties({
        ...declaration,
        methods: declaration.methods.map((method) => ({
          ...method,
          annotations: [{ name: 'JsonIgnore', arguments: {}, source: 'annotation' }],
        })),
      }),
    ).toEqual([]);
  });

  it('keeps missing parents and cycles bounded and expands validation inheritance', () => {
    const update = type('Views.Update', { extends: ['jakarta.validation.groups.Default'] });
    const customer = type('Views.UpdateCustomer', { extends: ['Views.Update'] });
    const cyclic = type('Cycle', { extends: ['Cycle', 'ExternalBaseResponse'] });
    const declarations = [update, customer, cyclic].map((declaration) => ({
      type: declaration,
      unit: unit([declaration]),
    }));
    expect(springProfileClosure(['Views.UpdateCustomer'], unit([]), declarations)).toContain(
      'Views.Update',
    );
    const found = springInheritedDeclarations(declarations[2]!, declarations);
    expect(found.declarations).toHaveLength(1);
    expect(found.unresolved).toEqual(['ExternalBaseResponse']);
  });

  it('preserves discriminator, default implementation and alternatives', () => {
    expect(
      springPolymorphism([
        {
          name: 'JsonTypeInfo',
          source: 'type',
          arguments: {
            use: 'JsonTypeInfo.Id.NAME',
            property: '"type"',
            defaultImpl: 'Corporate.class',
          },
        },
        {
          name: 'JsonSubTypes',
          source: 'subtypes',
          arguments: {
            value:
              '{@JsonSubTypes.Type(value = Corporate.class, name = "CORPORATE"), @JsonSubTypes.Type(value = Fleet.class, name = "FLEET")}',
          },
        },
      ]),
    ).toMatchObject({
      discriminator: 'type',
      defaultType: 'Corporate',
      subtypes: [
        { type: 'Corporate', name: 'CORPORATE' },
        { type: 'Fleet', name: 'FLEET' },
      ],
      unresolved: [],
    });
  });
  it('retains external-parent gaps and distinguishes create, update and patch profiles', () => {
    const create = type('Views.Create', { extends: ['jakarta.validation.groups.Default'] });
    const patch = type('Views.Patch', { extends: ['jakarta.validation.groups.Default'] });
    const request = type('Request', {
      extends: ['ExternalBaseResponse'],
      fields: [
        {
          name: 'market',
          type: 'Market',
          source: 'market',
          initializer: null,
          modifiers: ['private'],
          annotations: [
            { name: 'NotNull', arguments: { groups: 'Views.Create.class' }, source: 'not-null' },
          ],
        },
        {
          name: 'id',
          type: 'String',
          source: 'id',
          initializer: null,
          modifiers: ['private'],
          annotations: [
            { name: 'JsonView', arguments: { value: 'Views.Patch.class' }, source: 'view' },
          ],
        },
      ],
    });
    const bindings = collectSpringSchemas(
      [unit([create, patch, request])],
      [
        {
          routeId: 'create',
          typeName: 'Request',
          direction: 'request',
          validationGroups: ['Views.Create'],
          views: ['Views.Create'],
        },
        {
          routeId: 'patch',
          typeName: 'Request',
          direction: 'request',
          validationGroups: ['Views.Patch'],
          views: ['Views.Patch'],
          defaultViewInclusion: true,
        },
      ],
    );
    const schema = bindings.find((binding) => binding.typeName === 'example.Request');
    expect(schema?.completeness).toBe('partial');
    expect(schema?.gaps.map((gap) => gap.typeName)).toContain('ExternalBaseResponse');
    expect(schema?.gaps.map((gap) => gap.typeName)).toContain('Market');
    expect(schema?.profiles[0]?.fields).toEqual([
      {
        name: 'market',
        included: 'unknown',
        constraints: [{ annotation: 'NotNull', groups: ['Views.Create'], attributes: {} }],
        nonNull: true,
      },
      { name: 'id', included: false, constraints: [], nonNull: 'unknown' },
    ]);
    expect(schema?.profiles[1]?.fields[0]).toEqual({
      name: 'market',
      included: true,
      constraints: [],
      nonNull: 'unknown',
    });
    expect(schema?.profiles[1]?.fields[1]?.included).toBe(true);
  });
  it('substitutes declared generic wrappers and inherited fields without unfolding cycles', () => {
    const base = type('Base', {
      typeParameters: ['T'],
      fields: [
        {
          name: 'data',
          type: 'T',
          source: 'data',
          initializer: null,
          modifiers: ['private'],
          annotations: [],
        },
      ],
    });
    const wrapper = type('Wrapper', { extends: ['Base<Customer>'] });
    const customer = type('Customer', {
      fields: [
        {
          name: 'parent',
          type: 'Customer',
          source: 'parent',
          initializer: null,
          modifiers: ['private'],
          annotations: [],
        },
      ],
    });
    const bindings = collectSpringSchemas(
      [unit([base, wrapper, customer])],
      [
        {
          routeId: 'read',
          typeName: 'Base<Customer>',
          direction: 'response',
          validationGroups: [],
          views: [],
        },
      ],
    );
    expect(
      bindings.find((binding) => binding.typeName === 'example.Wrapper')?.properties[0]?.type,
    ).toBe('Customer');
    const generic = bindings.find((binding) => binding.typeName === 'example.Base<Customer>');
    expect(generic?.genericArguments).toEqual(['Customer']);
    expect(generic?.properties[0]?.type).toBe('Customer');
    expect(generic?.profiles[0]?.routeId).toBe('read');
    expect(generic?.gaps.some((gap) => gap.typeName === 'T')).toBe(false);
    expect(
      bindings.find((binding) => binding.typeName === 'example.Customer')?.properties,
    ).toHaveLength(1);
  });
  it('resolves actual nested view declarations and imported Default groups', () => {
    const views = unit([
      type('Update', {
        qualifiedName: 'example.Views.Update',
        kind: 'interface',
        extends: ['Default'],
      }),
      type('UpdateCustomer', {
        qualifiedName: 'example.Views.UpdateCustomer',
        kind: 'interface',
        extends: ['Update'],
      }),
    ]);
    const imported = { ...views, imports: ['jakarta.validation.groups.Default'] };
    const declarations = imported.types.map((declaration) => ({
      unit: imported,
      type: declaration,
    }));
    const profiles = springProfileClosure(['Views.UpdateCustomer'], imported, declarations);
    expect(profiles).toContain('Views.Update');
    expect(profiles).not.toContain('example.Update');
    expect(profiles).toContain('jakarta.validation.groups.Default');
    expect(springInheritedDeclarations(declarations[1]!, declarations).declarations).toHaveLength(
      2,
    );
  });
  it('keeps custom validation declarations with an explicit interpretation gap', () => {
    const request = type('Request', {
      fields: [
        {
          name: 'id',
          type: 'String',
          source: 'id',
          initializer: null,
          modifiers: [],
          annotations: [{ name: 'UUID', source: 'uuid', arguments: {} }],
        },
      ],
    });
    const schema = collectSpringSchemas([unit([request])])[0];
    expect(schema?.properties[0]?.annotations[0]?.name).toBe('UUID');
    expect(
      schema?.gaps.some(
        (gap) => gap.kind === 'annotation_semantics' && gap.detail.includes('@UUID'),
      ),
    ).toBe(true);
    expect(schema?.properties[0]?.constraints).toEqual([]);
  });
  it('retains inherited interface getter constraints when a concrete field declares the same property', () => {
    const contract = type('Contract', {
      kind: 'interface',
      methods: [
        {
          name: 'getType',
          returnType: 'String',
          parameters: [],
          source: 'getType',
          summary: null,
          body: null,
          annotations: [{ name: 'NotNull', arguments: {}, source: 'not-null' }],
        },
      ],
    });
    const concrete = type('Concrete', {
      implements: ['Contract'],
      fields: [
        {
          name: 'type',
          type: 'String',
          source: 'type',
          initializer: null,
          modifiers: ['private'],
          annotations: [],
        },
      ],
    });
    const schema = collectSpringSchemas([unit([contract, concrete])]).find(
      (binding) => binding.typeName === 'example.Concrete',
    );
    expect(schema?.properties[0]?.constraints[0]?.annotation).toBe('NotNull');
  });
  it('marks unresolved profile inheritance without inventing a qualified package type', () => {
    const request = type('Request');
    const profile = type('Views.Unknown', { extends: ['MissingParent'] });
    const binding = collectSpringSchemas(
      [unit([request, profile])],
      [
        {
          routeId: 'unknown',
          typeName: 'Request',
          direction: 'request',
          validationGroups: ['Views.Unknown'],
          views: [],
        },
      ],
    ).find((candidate) => candidate.typeName === 'example.Request');
    expect(binding?.profiles[0]?.validationGroups).not.toContain('example.MissingParent');
    expect(binding?.profiles[0]?.gaps).toContain(
      'Profile inheritance is unresolved for MissingParent.',
    );
    expect(binding?.profiles[0]?.completeness).toBe('partial');
  });
});

describe.skipIf(process.env.GROUNDWORK_NATIVE_PARSERS !== '1')(
  'compiled nested Spring profiles',
  () => {
    it('retains actual Views.Update/Patch identities without fabricating sibling package types', () => {
      const packageName = 'com.volvocars.ecom.customerservice.common';
      const index = indexSource({
        path: 'Views.java',
        language: 'java',
        content: `package ${packageName};
      import jakarta.validation.groups.Default;
      import jakarta.validation.constraints.NotNull;
      import jakarta.validation.constraints.Min;
      interface Views {
        interface Update extends Default {}
        interface Patch extends Default {}
        interface UpdateCustomer extends Update {}
        interface PatchCustomer extends Patch {}
      }
      class CustomerRequest {
        @NotNull(groups = Views.Update.class) String market;
        @Min(0) Integer dataVersion;
      }`,
      });
      expect(index.diagnostics).toEqual([]);
      const parsed = javaDeclarations(index);
      expect(parsed).not.toBeNull();
      const bindings = collectSpringSchemas(parsed === null ? [] : [parsed], [
        {
          routeId: 'update',
          typeName: 'CustomerRequest',
          direction: 'request',
          validationGroups: ['Views.UpdateCustomer'],
          views: [],
        },
        {
          routeId: 'patch',
          typeName: 'CustomerRequest',
          direction: 'request',
          validationGroups: ['Views.PatchCustomer'],
          views: [],
        },
      ]);
      const request = bindings.find(
        (binding) => binding.typeName === `${packageName}.CustomerRequest`,
      );
      expect(request?.profiles[0]?.validationGroups).toContain(`${packageName}.Views.Update`);
      expect(request?.profiles[1]?.validationGroups).toContain(`${packageName}.Views.Patch`);
      expect(request?.profiles.flatMap((profile) => profile.validationGroups)).not.toContain(
        `${packageName}.Update`,
      );
      expect(request?.profiles.flatMap((profile) => profile.validationGroups)).not.toContain(
        `${packageName}.Patch`,
      );
      expect(request?.profiles[0]?.validationGroups).toContain('jakarta.validation.groups.Default');
      expect(
        request?.profiles[0]?.fields.find((field) => field.name === 'dataVersion')?.constraints[0]
          ?.annotation,
      ).toBe('jakarta.validation.constraints.Min');
    }, 30_000);
  },
);
