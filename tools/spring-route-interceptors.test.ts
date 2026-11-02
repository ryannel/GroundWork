import { describe, expect, it, vi } from 'vitest';

import {
  type JavaMethod,
  type JavaType,
  type JavaUnit,
  javaDeclarations,
} from '@/infrastructure/scan/java-declarations';
import { indexSource } from '@/infrastructure/scan/source-index';
import { springInterceptors } from '@/infrastructure/scan/spring-security-interceptors';

vi.mock(import('server-only'), () => ({}));

function javaType(name: string): JavaType {
  return {
    name,
    qualifiedName: `example.${name}`,
    extends: [],
    implements: [],
    annotations: [],
    methods: [],
    fields: [],
    source: `s:${name}`,
    kind: 'class',
    enumValues: [],
  };
}
function method(name: string): JavaMethod {
  return {
    name,
    parameters: [],
    returnType: 'void',
    annotations: [],
    source: `s:${name}`,
    summary: null,
    body: 'registry.addInterceptor(interceptor).addPathPatterns("/**"); request.getHeader("Token");',
  };
}
function fixture(withCalls: boolean): readonly JavaUnit[] {
  const interceptor: JavaType = {
    ...javaType('Interceptor'),
    implements: ['org.springframework.web.servlet.HandlerInterceptor'],
    methods: [
      {
        ...method('preHandle'),
        returnType: 'boolean',
        parameters: [
          'jakarta.servlet.http.HttpServletRequest',
          'jakarta.servlet.http.HttpServletResponse',
          'Object',
        ].map((type, position) => ({
          name: ['request', 'response', 'handler'][position] ?? '',
          type,
          annotations: [],
          source: `s:p:${type}`,
        })),
        calls: withCalls
          ? [
              {
                callee: 'request.getHeader',
                arguments: ['"Token"'],
                source: 's:header',
                conditional: false,
              },
            ]
          : [],
      },
    ],
  };
  const config: JavaType = {
    ...javaType('Config'),
    implements: ['org.springframework.web.servlet.config.annotation.WebMvcConfigurer'],
    annotations: [
      {
        name: 'org.springframework.context.annotation.Configuration',
        arguments: {},
        source: 's:configuration',
      },
    ],
    fields: [
      {
        name: 'interceptor',
        type: 'Interceptor',
        source: 's:field',
        annotations: [],
        initializer: null,
        modifiers: ['final'],
      },
    ],
    methods: [
      {
        ...method('addInterceptors'),
        parameters: [
          {
            name: 'registry',
            type: 'org.springframework.web.servlet.config.annotation.InterceptorRegistry',
            annotations: [],
            source: 's:registry',
          },
        ],
        calls: withCalls
          ? [
              {
                callee: 'registry.addInterceptor',
                arguments: ['interceptor'],
                source: 's:add',
                conditional: false,
              },
              {
                callee: 'registry.addInterceptor(interceptor).addPathPatterns',
                arguments: ['"/**"'],
                source: 's:path',
                conditional: false,
              },
            ]
          : [],
      },
    ],
  };
  return [
    {
      path: 'Config.java',
      packageName: 'example',
      imports: [],
      types: [config, interceptor],
      source: 's:file',
    },
  ];
}

describe('Spring interceptor compiler bindings', () => {
  it('binds actual compiler calls and request header receiver', () => {
    const [binding] = springInterceptors(fixture(true));
    expect(binding?.activation.source_ids).toEqual(['s:add']);
    expect(binding?.policies[0]?.paths).toEqual(['/**']);
    expect(binding?.authentication[0]).toContain('Token');
    expect(binding?.uncertainties[1]).toContain('token decoder');
  });
  it('ignores call-looking body text when compiler calls are absent', () => {
    expect(springInterceptors(fixture(false))).toEqual([]);
  });
});

describe('Spring interceptor path patterns', () => {
  it('keeps unrelated path calls out of a registered interceptor', () => {
    const units = fixture(true);
    const unit = units[0];
    const config = unit?.types[0];
    const registration = config?.methods[0];
    if (!unit || !config || !registration) throw new Error('Missing fixture');
    const altered = {
      ...registration,
      calls: [
        ...(registration.calls ?? []),
        {
          callee: 'other.addPathPatterns',
          arguments: ['"/unrelated/**"'],
          source: 's:other',
          conditional: false,
        },
      ],
    };
    const result = springInterceptors([
      { ...unit, types: [{ ...config, methods: [altered] }, ...unit.types.slice(1)] },
    ]);
    expect(result[0]?.policies[0]?.paths).toEqual(['/**']);
  });
  it('does not register a class with no MVC configuration relationship', () => {
    const units = fixture(true);
    const unit = units[0];
    const config = unit?.types[0];
    if (!unit || !config) throw new Error('Missing fixture');
    expect(
      springInterceptors([
        { ...unit, types: [{ ...config, implements: [] }, ...unit.types.slice(1)] },
      ]),
    ).toEqual([]);
  });
});

describe('Spring framework type identity', () => {
  it('rejects a custom registry type with the framework simple name', () => {
    const unit = fixture(true)[0];
    const config = unit?.types[0];
    const registration = config?.methods[0];
    if (!unit || !config || !registration) throw new Error('Missing fixture');
    const altered = {
      ...registration,
      parameters: registration.parameters.map((parameter) => ({
        ...parameter,
        type: 'custom.InterceptorRegistry',
      })),
    };
    expect(
      springInterceptors([
        { ...unit, types: [{ ...config, methods: [altered] }, ...unit.types.slice(1)] },
      ]),
    ).toEqual([]);
  });
  it('rejects a custom servlet request type with the framework simple name', () => {
    const unit = fixture(true)[0];
    const interceptor = unit?.types[1];
    const preHandle = interceptor?.methods[0];
    if (!unit || !interceptor || !preHandle) throw new Error('Missing fixture');
    const parameters = preHandle.parameters.map((parameter, position) =>
      position === 0 ? { ...parameter, type: 'custom.HttpServletRequest' } : parameter,
    );
    expect(
      springInterceptors([
        {
          ...unit,
          types: [
            unit.types[0] ?? interceptor,
            { ...interceptor, methods: [{ ...preHandle, parameters }] },
          ],
        },
      ]),
    ).toEqual([]);
  });
});

const NATIVE = process.env.GROUNDWORK_NATIVE_PARSERS === '1';
describe.skipIf(!NATIVE)('native fluent interceptor bindings', () => {
  it('normalises formatting in compiler-selected callee expressions', () => {
    const index = indexSource({
      path: 'Config.java',
      language: 'java',
      content: `package example;
      import org.springframework.context.annotation.Configuration;
      import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;
      import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
      import org.springframework.web.servlet.HandlerInterceptor;
      import jakarta.servlet.http.HttpServletRequest;
      import jakarta.servlet.http.HttpServletResponse;
      @Configuration class Config implements WebMvcConfigurer {
        private static final String PATH = "/example/**";
        private final Interceptor interceptor;
        public void addInterceptors(InterceptorRegistry registry) {
          registry
            .addInterceptor(interceptor)
            .addPathPatterns(PATH);
        }
      }
      class Interceptor implements HandlerInterceptor {
        public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) {
          String token = request
            .getHeader("Token");
          return true;
        }
      }`,
    });
    expect(index.diagnostics).toEqual([]);
    const unit = javaDeclarations(index);
    if (!unit) throw new Error('Missing native unit');
    const [binding] = springInterceptors([unit]);
    expect(binding?.policies[0]?.paths).toEqual(['/example/**']);
    expect(binding?.authentication[0]).toContain('Token');
    expect(binding?.activation.state).toBe('source_enabled');
  }, 30_000);
});
