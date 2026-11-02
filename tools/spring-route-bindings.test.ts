import { describe, expect, it, vi } from 'vitest';

import type {
  JavaAnnotation,
  JavaMethod,
  JavaType,
  JavaUnit,
} from '@/infrastructure/scan/java-declarations';
import { springRoutes } from '@/infrastructure/scan/spring-routes';
import { springSecurity } from '@/infrastructure/scan/spring-security';

const ANNOTATION_NAMES: Readonly<Record<string, string>> = {
  PreAuthorize: 'org.springframework.security.access.prepost.PreAuthorize',
  EnableMethodSecurity:
    'org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity',
};
const annotation = (name: string, value: string): JavaAnnotation => ({
  name: ANNOTATION_NAMES[name] ?? `org.springframework.web.bind.annotation.${name}`,
  arguments: { value },
  source: `s:${name}:${value}`,
});
const method = (type: string, annotations: readonly JavaAnnotation[] = []): JavaMethod => ({
  name: 'get',
  parameters: [
    { name: 'id', type, annotations: [annotation('PathVariable', '"id"')], source: 's:param' },
  ],
  returnType: 'String',
  annotations,
  source: `s:method:${type}:${String(annotations.length)}`,
  summary: null,
  body: null,
});
function fixture(prefix: string, implementationType = 'String'): readonly JavaUnit[] {
  const api: JavaType = {
    name: 'Api',
    qualifiedName: 'example.Api',
    extends: [],
    implements: [],
    annotations: [],
    methods: [
      method('String', [
        annotation('GetMapping', '"/{id}"'),
        annotation('PreAuthorize', '"hasRole(\'Reader\')"'),
      ]),
    ],
    fields: [],
    source: 's:api',
    kind: 'interface',
    enumValues: [],
  };
  const controller: JavaType = {
    name: 'Controller',
    qualifiedName: 'example.Controller',
    extends: [],
    implements: ['Api'],
    annotations: [
      annotation('RestController', ''),
      annotation('RequestMapping', JSON.stringify(prefix)),
    ],
    methods: [method(implementationType)],
    fields: [],
    source: 's:controller',
    kind: 'class',
    enumValues: [],
  };
  return [
    { path: 'Api.java', packageName: 'example', imports: [], types: [api], source: 's:api-file' },
    {
      path: 'Controller.java',
      packageName: 'example',
      imports: [],
      types: [controller],
      source: 's:controller-file',
    },
  ];
}

vi.mock(import('server-only'), () => ({}));

describe('Spring source binding', () => {
  it('composes class prefix and interface route with exact implementation signature', () => {
    const [route] = springRoutes(fixture('/v9/people'));
    expect(route?.path).toBe('/v9/people/{id}');
    expect(route?.method.implementation_source_id).toBe('s:method:String:0');
    expect(route?.parameters[0]).toMatchObject({ location: 'path', name: 'id', required: true });
  });
  it('does not bind a same-name, same-arity overload with the wrong type', () => {
    const [route] = springRoutes(fixture('/people', 'Long'));
    expect(route?.method.implementation_source_id).toBeUndefined();
    expect(route?.uncertainties).toContain(
      'No exact implementation signature found in the selected source.',
    );
  });
  it('keeps declaration authorisation unresolved without method security activation', () => {
    const [security] = springSecurity(fixture('/people'));
    expect(security?.activation.state).toBe('unresolved');
    expect(security?.authorisation).toEqual(["hasRole('Reader')"]);
  });
  it('removes source enablement when its configuration is removed', () => {
    const units = fixture('/people');
    const config: JavaUnit = {
      path: 'Config.java',
      packageName: 'example',
      imports: [],
      source: 's:config-file',
      types: [
        {
          name: 'Config',
          qualifiedName: 'example.Config',
          extends: [],
          implements: [],
          annotations: [annotation('EnableMethodSecurity', '')],
          methods: [],
          fields: [],
          source: 's:config',
          kind: 'class',
          enumValues: [],
        },
      ],
    };
    expect(springSecurity([...units, config])[0]?.activation.state).toBe('source_enabled');
    expect(springSecurity(units)[0]?.activation.state).toBe('unresolved');
  });
});

describe('Spring annotation identity', () => {
  it('rejects a custom annotation with the same mapping simple name', () => {
    const units = fixture('/people');
    const apiUnit = units[0];
    const api = apiUnit?.types[0];
    const declaration = api?.methods[0];
    if (!apiUnit || !api || !declaration) throw new Error('Missing fixture');
    const annotations = declaration.annotations.map((entry) =>
      entry.name.endsWith('.GetMapping') ? { ...entry, name: 'example.GetMapping' } : entry,
    );
    const altered = { ...apiUnit, types: [{ ...api, methods: [{ ...declaration, annotations }] }] };
    expect(springRoutes([altered, ...units.slice(1)])).toEqual([]);
  });
  it('does not activate Secured with EnableMethodSecurity defaults', () => {
    const units = fixture('/people');
    const apiUnit = units[0];
    const api = apiUnit?.types[0];
    const declaration = api?.methods[0];
    if (!apiUnit || !api || !declaration) throw new Error('Missing fixture');
    const annotations = declaration.annotations.map((entry) =>
      entry.name.endsWith('.PreAuthorize')
        ? { ...entry, name: 'org.springframework.security.access.annotation.Secured' }
        : entry,
    );
    const altered = {
      ...apiUnit,
      types: [
        {
          ...api,
          annotations: [annotation('EnableMethodSecurity', '')],
          methods: [{ ...declaration, annotations }],
        },
      ],
    };
    expect(springSecurity([altered, ...units.slice(1)])[0]?.activation.state).toBe('disabled');
  });
});

describe('Spring external security configuration', () => {
  it('retains excluded auto-configuration and unresolved imported configuration as source stages', () => {
    const units = fixture('/people');
    const unit = units[1];
    const controller = unit?.types[0];
    if (!unit || !controller) throw new Error('Missing fixture');
    const configuration = {
      ...controller,
      annotations: [
        ...controller.annotations,
        {
          name: 'org.springframework.boot.autoconfigure.SpringBootApplication',
          arguments: { exclude: 'SecurityAutoConfiguration.class' },
          source: 's:boot-exclusion',
        },
        {
          name: 'org.springframework.context.annotation.Import',
          arguments: { value: 'EcomWebAppConfiguration.class' },
          source: 's:external-import',
        },
      ],
    };
    const altered = {
      ...unit,
      imports: ['external.web.EcomWebAppConfiguration'],
      types: [configuration],
    };
    const [binding] = springSecurity([...units.slice(0, 1), altered]);
    expect(binding?.activation.state).toBe('unresolved');
    expect(binding?.source_ids).toContain('s:boot-exclusion');
    expect(binding?.source_ids).toContain('s:external-import');
    expect(binding?.enforcement_chain).toContainEqual(
      expect.objectContaining({
        stage: 'configuration_exclusion',
        source_ids: ['s:boot-exclusion'],
      }),
    );
    const imported = binding?.enforcement_chain.find(
      (step) => step.stage === 'configuration_import',
    );
    expect(imported?.detail).toContain('external.web.EcomWebAppConfiguration');
  });
});
