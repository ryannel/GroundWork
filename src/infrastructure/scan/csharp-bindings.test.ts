import { describe, expect, it, vi } from 'vitest';

import { scanFixture } from '@/../test/scan-kit';
import { validateScanDocument } from '@/domain/scan/check-scan';

import { collectAspNetRoutes } from './aspnet-bindings';
import { collectCsharpContracts } from './csharp-contracts';
import { csharpSource } from './csharp-declarations';
import { csharpProgramDocument } from './csharp-program-document';
import { collectCsharpSymbols } from './csharp-symbol-bindings';
import { extractLocalFacts } from './local-facts';
import { indexSource } from './source-index';

vi.mock(import('server-only'), () => ({}));

function index(path: string, content: string) {
  return indexSource({ path, content, language: 'csharp' });
}

const controller = `using Microsoft.AspNetCore.Mvc;
[ApiController, Route("api/[controller]")]
public class QuoteController : ControllerBase {
 [HttpPost("calculate")] public Quote Post(string id) {
  var total = Calculator.Calculate(id, 20);
  if (total < 0) throw new System.Exception("negative");
  return new Quote(total);
 }
}
public record Quote(decimal Total);`;
const calculator = `public static class Calculator {
 public static decimal Calculate(string id, decimal amount) { return amount + id.Length; }
}`;

describe('C# source framework and program bindings', () => {
  it('keeps identical empty files pinned to distinct source identities and module paths', () => {
    const facts = ['empty-a.cs', 'empty-b.cs'].map((path) =>
      extractLocalFacts(index(path, ''), {
        host: 'host:server',
        repo: 'fixture/repo',
        commit: 'a'.repeat(40),
        blob: 'b'.repeat(40),
      }),
    );
    const sources = facts.flatMap((entry) => entry.sources);
    expect(new Set(sources.map((source) => source.id)).size).toBe(sources.length);
    const sourcePaths = new Map(sources.map((source) => [source.id, source.path]));
    for (const [position, entry] of facts.entries()) {
      expect(entry.summaries.length).toBeGreaterThan(0);
      expect(
        entry.summaries.every(
          (summary) => sourcePaths.get(summary.source) === ['empty-a.cs', 'empty-b.cs'][position],
        ),
      ).toBe(true);
    }
    const fixture = scanFixture();
    expect(
      validateScanDocument({
        ...fixture,
        sources: [...fixture.sources, ...sources],
        summaries: facts.flatMap((entry) => entry.summaries),
        gaps: facts.flatMap((entry) => entry.gaps),
        semantic: facts.flatMap((entry) => entry.semantic ?? []),
      }),
    ).toEqual([]);
  });
  it('combines separate method routes, absolute selectors and action tokens with their source anchors', () => {
    const parsed = index(
      'MethodRoutes.cs',
      `using Microsoft.AspNetCore.Mvc;
      [Route("api/[controller]/")] public class QuoteController : ControllerBase {
        [HttpPost, Route("relative/[action]")] public string Post() => "ok";
        [HttpGet, Route("/absolute/[action]")] public string Get() => "ok";
        [HttpPut, Route("~/root")] public string Put() => "ok";
      }`,
    );
    const routes = collectAspNetRoutes([parsed]);
    expect(routes.map((route) => route.template)).toEqual([
      'api/Quote/relative/Post',
      '/absolute/Get',
      '/root',
    ]);
    const methodRoute = parsed.nodes.find(
      (node) => node.kind === 'ANNOTATION' && node.text === 'Route("relative/[action]")',
    );
    expect(methodRoute).toBeDefined();
    expect(routes[0]?.support).toContain(csharpSource(parsed, methodRoute!));
  });
  it('retains multiple method Route selectors as explicitly unresolved rather than choosing one', () => {
    const parsed = index(
      'MultipleRoutes.cs',
      `using Microsoft.AspNetCore.Mvc;
      [Route("api")] public class C : ControllerBase {
        [HttpGet, Route("first"), Route("second")] public string Get() => "ok";
      }`,
    );
    const route = collectAspNetRoutes([parsed])[0];
    expect(route?.template).toBeNull();
    expect(route?.limitations.join(' ')).toContain('Route selector composition unresolved');
    for (const attribute of parsed.nodes.filter(
      (node) =>
        node.kind === 'ANNOTATION' && ['Route("first")', 'Route("second")'].includes(node.text),
    )) {
      expect(route?.support).toContain(csharpSource(parsed, attribute));
    }
  });
  it('retains a separate method Route plus an HTTP template as unresolved selector composition', () => {
    const parsed = index(
      'CompetingRoutes.cs',
      `using Microsoft.AspNetCore.Mvc;
      public class C : ControllerBase {
        [HttpPost("http"), Route("separate")] public string Post() => "ok";
      }`,
    );
    const route = collectAspNetRoutes([parsed])[0];
    expect(route?.template).toBeNull();
    expect(route?.limitations.join(' ')).toContain(
      'HTTP template combined with a separate method Route',
    );
    const separate = parsed.nodes.find(
      (node) => node.kind === 'ANNOTATION' && node.text === 'Route("separate")',
    );
    expect(separate).toBeDefined();
    expect(route?.support).toContain(csharpSource(parsed, separate!));
  });
  it.each(['', '// No declarations in this file.\n', '/* Comment-only C# file. */\n'])(
    'anchors empty or trivia-only source without inventing semantics: %j',
    (content) => {
      const parsed = index('Empty.cs', content);
      expect(parsed.diagnostics).toEqual([]);
      const facts = extractLocalFacts(parsed, {
        host: 'host:server',
        repo: 'fixture/repo',
        commit: 'a'.repeat(40),
        blob: 'b'.repeat(40),
      });
      const fixture = scanFixture();
      const document = {
        ...fixture,
        sources: [...fixture.sources, ...facts.sources],
        summaries: [...facts.summaries],
        gaps: [...facts.gaps],
        semantic: [...(facts.semantic ?? [])],
      };
      expect(validateScanDocument(document)).toEqual([]);
      expect(facts.semantic ?? []).toEqual([]);
      expect(facts.sources.length).toBeGreaterThan(0);
      expect(facts.sources).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            repo: 'fixture/repo',
            commit: 'a'.repeat(40),
            blob: 'b'.repeat(40),
            path: 'Empty.cs',
          }),
        ]),
      );
      const sourceIds = new Set(facts.sources.map((source) => source.id));
      expect(facts.summaries.every((summary) => sourceIds.has(summary.source))).toBe(true);
      expect(facts.summaries.every((summary) => summary.operations.length === 0)).toBe(true);
    },
  );
  it('uses selected-program global imports without leaking ordinary imports or accepting shadows', () => {
    const withoutImport = controller.replace('using Microsoft.AspNetCore.Mvc;', '');
    const action = index('Api/Controller.cs', withoutImport);
    const globalImport = index('Api/GlobalUsings.cs', 'global using Microsoft.AspNetCore.Mvc;');
    const ordinaryImport = index('Api/Other.cs', 'using Microsoft.AspNetCore.Mvc;');
    expect(collectAspNetRoutes([action, globalImport])[0]).toMatchObject({
      template: 'api/Quote/calculate',
      method: 'Post',
      httpMethods: ['POST'],
    });
    expect(collectAspNetRoutes([action, ordinaryImport])).toEqual([]);
    expect(collectAspNetRoutes([index('OtherProgram/Controller.cs', withoutImport)])).toEqual([]);
    const impostor = index(
      'Api/Shadow.cs',
      'public class HttpPostAttribute : System.Attribute { public HttpPostAttribute(string text) {} }',
    );
    expect(collectAspNetRoutes([action, globalImport, impostor])).toEqual([]);
    expect(collectAspNetRoutes([action, globalImport])).toHaveLength(1);
  });
  it('combines controller separators and respects absolute action templates', () => {
    const content = `using Microsoft.AspNetCore.Mvc;
      [Route("v1/accounts/")] public class AccountController : ControllerBase {
      [HttpGet("self")] public string Get() { return "ok"; }
      [HttpPost("/absolute")] public string Post() { return "ok"; }
      [HttpPut("~/root")] public string Put() { return "ok"; }
      }`;
    expect(
      collectAspNetRoutes([index('Routes.cs', content)]).map((route) => route.template),
    ).toEqual(['v1/accounts/self', '/absolute', '/root']);
  });
  it('joins exact cross-file calls and argument/formal declarations without building a target', () => {
    const indexes = [index('Controller.cs', controller), index('Calculator.cs', calculator)];
    const program = collectCsharpSymbols(indexes);
    const call = program.bindings.find(
      (binding) => binding.relation === 'call_target' && binding.symbol.includes('Calculate('),
    );
    expect(call?.dispatch).toBe('exact');
    expect(call?.target).toMatch(/^source:/u);
    expect(call?.arguments).toHaveLength(2);
    expect(call?.arguments.every((argument) => argument.parameter !== null)).toBe(true);
    expect(
      program.bindings.some(
        (binding) =>
          binding.relation === 'reaching_definition' && binding.symbol.endsWith(' amount'),
      ),
    ).toBe(true);
    expect(
      collectAspNetRoutes([
        index('NoTemplate.cs', controller.replace('[HttpPost("calculate")]', '[HttpPost]')),
      ])[0]?.httpMethods,
    ).toEqual(['POST']);
    const route = collectAspNetRoutes(indexes, program.signatures)[0];
    expect(route?.input_contract_ids).toHaveLength(1);
    expect(
      program.contracts.find(
        (contract) => route?.output_contract_ids.includes(contract.id) === true,
      )?.shape,
    ).toMatchObject({ kind: 'reference' });
    expect(route).toMatchObject({
      template: 'api/Quote/calculate',
      method: 'Post',
      httpMethods: ['POST'],
      status: 'source_declared',
    });
    expect(
      program.contracts.find((contract) => contract.shape.spelling === 'Quote')?.shape,
    ).toMatchObject({
      kind: 'object',
      enforcement: 'source',
      fields: [{ name: 'Total', shape: { kind: 'scalar', name: 'number' } }],
    });
  }, 15_000);

  it('retains control and values but rejects shadow framework attributes and unresolved overloads', () => {
    const parsed = index('Controller.cs', controller);
    const facts = extractLocalFacts(parsed, {
      host: 'host:test',
      repo: 'synthetic/csharp',
      commit: 'a'.repeat(40),
    });
    expect(
      facts.semantic?.some(
        (record) => record.kind === 'semantic_edge' && record.relation === 'condition',
      ),
    ).toBe(true);
    expect(
      facts.semantic?.some(
        (record) => record.kind === 'semantic_edge' && record.relation === 'assigned_value',
      ),
    ).toBe(true);
    const shadow = index(
      'Shadow.cs',
      `${controller}\nclass HttpPostAttribute : System.Attribute { public HttpPostAttribute(string text) {} }`,
    );
    expect(collectAspNetRoutes([shadow])).toEqual([]);
    const ambiguous = collectCsharpSymbols([
      index(
        'Ambiguous.cs',
        `class C { void A(int x) {} void A(string x) {} void M() { A(default); } }`,
      ),
    ]);
    expect(ambiguous.bindings.find((binding) => binding.relation === 'call_target')).toMatchObject({
      dispatch: 'unresolved',
      target: null,
    });
    const polymorphic = collectCsharpSymbols([
      index(
        'Interface.cs',
        `interface I { int Read(); } class C { int M(I source) { return source.Read(); } }`,
      ),
    ]);
    expect(
      polymorphic.bindings.find((binding) => binding.relation === 'call_target'),
    ).toMatchObject({ dispatch: 'polymorphic' });
  });
  it('retains configured implementation candidates without claiming runtime DI activation', () => {
    const content = `using Microsoft.Extensions.DependencyInjection;
      interface I { int Read(); }
      class One : I { public int Read() => 1; }
      class Two : I { public int Read() => 2; }
      class Setup { void Register(IServiceCollection services, bool enabled) {
        services.AddScoped<I,One>();
        if(enabled) services.AddTransient<I,Two>();
      } }`;
    const program = collectCsharpSymbols([index('Registration.cs', content)]);
    const candidates = program.bindings.filter(
      (binding) => binding.relation === 'implementation_candidate',
    );
    expect(candidates).toHaveLength(2);
    expect(
      candidates.every((binding) =>
        binding.conditions.includes(
          'Multiple registration candidates; selection and ordering are unresolved.',
        ),
      ),
    ).toBe(true);
    expect(
      candidates.every(
        (binding) =>
          binding.dispatch === 'polymorphic' && binding.configurationSources.length === 1,
      ),
    ).toBe(true);
    expect(candidates.find((binding) => binding.symbol.includes('Two.Read'))?.conditions).toContain(
      'Registration is conditional within source control flow.',
    );
    const unknown = collectCsharpSymbols([
      index(
        'NoRegistration.cs',
        `interface I { int Read(); } class C : I { public int Read() => 1; }`,
      ),
    ]);
    expect(
      unknown.bindings.find((binding) => binding.relation === 'implementation_candidate')
        ?.configurationSources,
    ).toEqual([]);
  });

  it('recognises HTTP and task boundaries from compiler-resolved framework types only', () => {
    const program = collectCsharpSymbols([
      index(
        'Boundary.cs',
        `using System.Net.Http; using System.Threading.Tasks;
      class C { async Task M(HttpClient client) { await client.GetStringAsync("https://example.test"); await Task.Run(() => 1); } }
      class Fake { string GetStringAsync(string path) => path; void M() { GetStringAsync("x"); } }`,
      ),
    ]);
    expect(program.bindings.filter((binding) => binding.boundary === 'http')).toHaveLength(1);
    expect(program.bindings.filter((binding) => binding.boundary === 'async')).toHaveLength(1);
    expect(program.bindings.find((binding) => binding.boundary === 'http')?.completion).toBe(
      'awaited',
    );
  });
  it('validates attributes, default parameters, discard lambdas and filtered catches while retaining a deconstruction frontier', () => {
    const parsed = index(
      'Constructs.cs',
      `class MarkerAttribute : System.Attribute {}
      class C { [Marker] public string[] Names {get;set;} = [];
      void M(int count=2) { var (left,right) = (1,2); System.Action<int,int> callback = (_, value) => System.Console.WriteLine(value); callback += (_, value) => System.Console.WriteLine(value);
      try { callback(1,count); } catch(System.Exception error) when(error != null) { throw; } } }`,
    );
    const facts = extractLocalFacts(parsed, {
      host: 'host:server',
      repo: 'fixture/repo',
      commit: 'a'.repeat(40),
    });
    const document = {
      ...scanFixture(),
      sources: [
        ...scanFixture().sources,
        ...new Map(facts.sources.map((source) => [source.id, source])).values(),
      ],
      summaries: [...facts.summaries],
      gaps: [...facts.gaps],
      semantic: [...(facts.semantic ?? [])],
    };
    expect(validateScanDocument(document)).toEqual([]);
    expect(
      facts.summaries
        .flatMap((summary) => summary.frontiers)
        .some((frontier) => frontier.nextQuestion.includes('CsharpDeconstructionAssignment')),
    ).toBe(true);
  });
  it('closes namespace-qualified DTO references, collections, maps, nullable values and enums', () => {
    const indexes = [
      index(
        'A.cs',
        `using System.Collections.Generic; namespace A;
      public record Child(int Value);
      public enum Mode { One=1, Two=2 }
      public record Parent(List<Child?> Children, Dictionary<string,Child> Lookup, Child[] Items, int? Count, Mode Mode);`,
      ),
      index('B.cs', 'namespace B; public record Child(string Text);'),
    ];
    const contracts = collectCsharpContracts(indexes);
    const child = contracts.find((contract) => contract.shape.spelling === 'A.Child');
    const parent = contracts.find((contract) => contract.shape.spelling === 'A.Parent');
    expect(parent?.shape).toMatchObject({
      kind: 'object',
      fields: [
        {
          name: 'Children',
          shape: {
            kind: 'array',
            item: {
              kind: 'union',
              alternatives: [
                { kind: 'reference', target: child?.id },
                { kind: 'scalar', name: 'null' },
              ],
            },
          },
        },
        {
          name: 'Lookup',
          shape: {
            kind: 'map',
            key: { kind: 'scalar', name: 'string' },
            value: { kind: 'reference', target: child?.id },
          },
        },
        { name: 'Items', shape: { kind: 'array', item: { kind: 'reference', target: child?.id } } },
        {
          name: 'Count',
          nullable: true,
          shape: {
            kind: 'union',
            alternatives: [
              { kind: 'scalar', name: 'integer' },
              { kind: 'scalar', name: 'null' },
            ],
          },
        },
        { name: 'Mode', shape: { kind: 'reference' } },
      ],
    });
    expect(contracts.find((contract) => contract.shape.spelling === 'A.Mode')?.shape).toMatchObject(
      { kind: 'enum', values: [1, 2] },
    );
  });
  it('retains dictionary index initialiser assignment targets and their response values', () => {
    const facts = extractLocalFacts(
      index(
        'DictionaryInitialiser.cs',
        `using System.Collections.Generic;
        class C { Dictionary<string, object> Tags(string response) => new() {
          ["deployment.environment"] = response.ToLowerInvariant()
        }; }`,
      ),
      { host: 'host:server', repo: 'fixture/repo', commit: 'a'.repeat(40) },
    );
    const fixture = scanFixture();
    const document = {
      ...fixture,
      sources: [
        ...fixture.sources,
        ...new Map(facts.sources.map((source) => [source.id, source])).values(),
      ],
      summaries: [...facts.summaries],
      gaps: [...facts.gaps],
      semantic: [...(facts.semantic ?? [])],
    };
    expect(validateScanDocument(document)).toEqual([]);
    const target = document.semantic.find(
      (record) => record.kind === 'semantic_node' && record.syntax === '["deployment.environment"]',
    );
    expect(target).toMatchObject({ kind: 'semantic_node', nodeKind: 'index' });
    const assigned = document.semantic.find(
      (record) =>
        record.kind === 'semantic_edge' &&
        record.relation === 'assigned_value' &&
        record.from === target?.id,
    );
    expect(assigned).toMatchObject({ kind: 'semantic_edge', relation: 'assigned_value' });
    expect(
      document.semantic.find(
        (record) => assigned?.kind === 'semantic_edge' && record.id === assigned.to,
      ),
    ).toMatchObject({
      kind: 'semantic_node',
      nodeKind: 'call',
      syntax: 'response.ToLowerInvariant()',
    });
    const oldMapping = {
      ...document,
      semantic: document.semantic.map((record) =>
        record.kind === 'semantic_node' && record.id === target?.id
          ? { ...record, nodeKind: 'unknown' as const }
          : record,
      ),
    };
    expect(validateScanDocument(oldMapping).join('\n')).toContain(
      'invalid assigned_value origin kind',
    );
  });
  it('rebinds cross-shard source programs and rejects mixed revision inputs', () => {
    const indexes = [index('Controller.cs', controller), index('Calculator.cs', calculator)];
    const documents = indexes.map((indexed) => {
      const facts = extractLocalFacts(indexed, {
        host: 'host:server',
        repo: 'fixture/repo',
        commit: 'a'.repeat(40),
      });
      const fixture = scanFixture();
      return {
        ...fixture,
        hosts: fixture.hosts.map((host) => ({
          ...host,
          support: [facts.sources[0]!.id] as [string, ...string[]],
        })),
        sources: [
          ...fixture.sources.map((source) => ({ ...source, commit: 'a'.repeat(40) })),
          ...new Map(facts.sources.map((source) => [source.id, source])).values(),
        ],
        semantic: [...(facts.semantic ?? [])],
        summaries: [...facts.summaries],
        gaps: [...facts.gaps],
      };
    });
    const firstProgram = collectCsharpSymbols(indexes);
    const secondProgram = collectCsharpSymbols(indexes);
    expect(secondProgram.diagnostics).toEqual(firstProgram.diagnostics);
    const document = csharpProgramDocument(documents, indexes);
    const repeated = csharpProgramDocument(documents, indexes);
    expect(repeated.gaps).toEqual(document.gaps);
    expect(repeated.id).toBe(document.id);
    expect(validateScanDocument(document)).toEqual([]);
    expect(
      document.bindings?.some(
        (binding) =>
          binding.kind === 'csharp_symbol_binding' &&
          binding.relation === 'call_target' &&
          binding.dispatch === 'exact' &&
          binding.symbol.includes('Calculator.Calculate'),
      ),
    ).toBe(true);
    expect(() =>
      csharpProgramDocument(
        documents.map((shard, position) =>
          position === 0
            ? shard
            : {
                ...shard,
                sources: shard.sources.map((source) => ({ ...source, commit: 'b'.repeat(40) })),
              },
        ),
        indexes,
      ),
    ).toThrow(/Conflicting shard|pinned repository/u);
  }, 15_000);
});
