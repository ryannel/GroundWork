import { describe, expect, it, vi } from 'vitest';

import { collectJavaBindings } from '@/infrastructure/scan/java-call-bindings';
import { declarationSource } from '@/infrastructure/scan/java-declaration-parts';
import { javaDeclarations } from '@/infrastructure/scan/java-declarations';
import { indexSource } from '@/infrastructure/scan/source-index';

vi.mock(import('server-only'), () => ({}));
const NATIVE = process.env.GROUNDWORK_NATIVE_PARSERS === '1';

function fixture(content: string) {
  const index = indexSource({ path: 'Fixture.java', language: 'java', content });
  expect(index.diagnostics).toEqual([]);
  const unit = javaDeclarations(index);
  if (!unit) throw new Error('Expected Java declarations');
  return { index, unit, ...collectJavaBindings([index], [unit]) };
}

describe.skipIf(!NATIVE)('shared Java call and value bindings', () => {
  it('scopes a direct positive instanceof binding to its consequent only', () => {
    const result = fixture(`package fixture;
      class Request {} class App {
        void accept(Request request) {}
        void run(Object input, boolean flag) {
          if (input instanceof Request request) { accept(request); }
          else { accept(request); }
          accept(request);
          if (!(input instanceof Request negated)) { accept(negated); }
          if (flag && input instanceof Request compound) { accept(compound); }
        }
      }`);
    expect(
      result.calls
        .filter((call) => call.methodName === 'accept')
        .map((call) => ({
          resolution: call.resolution,
          types: call.argumentTypes,
        })),
    ).toEqual([
      { resolution: 'exact', types: ['fixture.Request'] },
      { resolution: 'unresolved', types: [null] },
      { resolution: 'unresolved', types: [null] },
      { resolution: 'unresolved', types: [null] },
      { resolution: 'unresolved', types: [null] },
    ]);
  }, 30_000);

  it('uses only a declared collection stream map element upper bound for an implicit lambda parameter', () => {
    const result = fixture(`package fixture; import java.util.List; import java.util.Set;
      class Request {} class Custom { Custom stream() { return this; } Object map(Object fn) { return null; } }
      class App {
        Request create(Request request) { return request; }
        void run(List<? extends Request> requests, Set<Request> others, List<?> unknown,
                 List<? super Request> lower, Custom custom) {
          requests.stream().map(request -> create(request));
          others.stream().map(request -> create(request));
          unknown.stream().map(request -> create(request));
          lower.stream().map(request -> create(request));
          custom.stream().map(request -> create(request));
          requests.stream().filter(request -> create(request));
          create(request);
        }
      }`);
    const calls = result.calls.filter((call) => call.methodName === 'create');
    expect(calls.map((call) => call.argumentTypes)).toEqual([
      ['fixture.Request'],
      ['fixture.Request'],
      [null],
      [null],
      [null],
      [null],
      [null],
    ]);
    expect(calls.map((call) => call.resolution)).toEqual([
      'exact',
      'exact',
      'unresolved',
      'unresolved',
      'unresolved',
      'unresolved',
      'unresolved',
    ]);
    expect(
      result.calls
        .filter(
          (call) =>
            ['stream', 'map'].includes(call.methodName) && call.receiverType !== 'fixture.Custom',
        )
        .every((call) => call.resolution === 'unresolved'),
    ).toBe(true);
  }, 30_000);

  it('binds literal null to a unique reference parameter while preserving ambiguous and unknown calls', () => {
    const result = fixture(`package fixture;
      class Actor {} class Payload {} class Context {}
      class Service {
        void fetch(Payload payload, Context context) { fetch(null, payload, context); }
        void fetch(Actor current, Payload payload, Context context) {}
        void primitive(int value) {} void primitive(boolean value) {}
        void overloaded(Actor value) {} void overloaded(Payload value) {}
        void run(Payload payload, Context context) {
          primitive(null); overloaded(null); fetch(unknown(), payload, context);
        }
      }`);
    const delegates = result.calls.filter((call) => call.methodName === 'fetch');
    expect(delegates).toEqual([
      expect.objectContaining({
        resolution: 'exact',
        argumentTypes: [null, 'fixture.Payload', 'fixture.Context'],
        signature: 'fixture.Service#fetch(fixture.Actor,fixture.Payload,fixture.Context):void',
      }),
      expect.objectContaining({ resolution: 'unresolved', target: null }),
    ]);
    expect(result.calls.find((call) => call.methodName === 'primitive')).toMatchObject({
      resolution: 'unresolved',
      target: null,
    });
    expect(result.calls.find((call) => call.methodName === 'overloaded')).toMatchObject({
      resolution: 'unresolved',
      target: null,
    });
    expect(result.values.filter((value) => value.relation === 'argument_parameter')).toHaveLength(
      3,
    );
  }, 30_000);

  it('resolves overloads by complete types, preserving two helper invocation contexts and field origins', () => {
    const result = fixture(`package fixture;
      class Client {}
      class Api {
        static final String ONE = "/one"; static final String TWO = "/two";
        final Client first; final Client second;
        Api(Client a, Client b) { this.first = a; this.second = b; }
        String get(String token) { if (token == null) return get(first, ONE, token); return get(second, TWO, token); }
        String get(Client client, String path, String token) { return path; }
        String get(Client client, int path, String token) { return token; }
        void unknown(Object input) { get(first, input, "token"); }
      }`);
    const calls = result.calls.filter((call) => call.methodName === 'get');
    expect(calls).toHaveLength(3);
    const resolved = calls.filter((call) => call.resolution === 'exact');
    expect(resolved).toHaveLength(2);
    expect(new Set(resolved.map((call) => call.target)).size).toBe(1);
    expect(resolved.map((call) => call.guards.length)).toEqual([1, 0]);
    expect(resolved.map((call) => call.signature)).toEqual([
      'fixture.Api#get(fixture.Client,java.lang.String,java.lang.String):java.lang.String',
      'fixture.Api#get(fixture.Client,java.lang.String,java.lang.String):java.lang.String',
    ]);
    expect(calls[2]).toMatchObject({ resolution: 'unresolved', target: null });
    const argumentLinks = result.values.filter((value) => value.relation === 'argument_parameter');
    expect(argumentLinks).toHaveLength(6);
    const paths = argumentLinks.filter((value) => value.to === argumentLinks[1]?.to);
    expect(new Set(paths.map((value) => value.from)).size).toBe(2);
    expect(new Set(paths.map((value) => value.call)).size).toBe(2);
    expect(result.values.filter((value) => value.relation === 'return_call')).toHaveLength(2);
    expect(result.values.filter((value) => value.relation === 'assignment')).toHaveLength(2);
    expect(result.values.filter((value) => value.relation === 'initializer')).toHaveLength(2);
  }, 30_000);

  it('substitutes inherited factory type parameters and keeps unknown argument types unresolved', () => {
    const result = fixture(`package fixture;
      class Item {} class Request {}
      class Base<T, R> { T create(R request) { return null; } }
      class Factory extends Base<Item, Request> {}
      class App { Factory factory; Item go(Request request) { return factory.create(request); }
        void unknown(Object input) { factory.create(input); } }
    `);
    expect(result.calls.filter((call) => call.methodName === 'create')).toEqual([
      expect.objectContaining({
        resolution: 'exact',
        receiverType: 'fixture.Factory',
        signature: 'fixture.Base#create(fixture.Request):fixture.Item',
      }),
      expect.objectContaining({ resolution: 'unresolved', target: null }),
    ]);
  }, 30_000);

  it('connects constructor arguments through assigned fields and getters to a caller result', () => {
    const result = fixture(`package fixture; class Client {
      final String path; Client(String supplied) { this.path = supplied; }
      String path() { return path; }
      static String run() { Client client = new Client("/users"); return client.path(); }
    }`);
    expect(result.calls).toEqual([
      expect.objectContaining({ methodName: '<init>', resolution: 'exact' }),
      expect.objectContaining({ methodName: 'path', resolution: 'exact' }),
    ]);
    const field = result.unit.types[0]?.fields[0];
    expect(result.values).toContainEqual(
      expect.objectContaining({ relation: 'assignment', to: field?.source }),
    );
    expect(result.values.filter((value) => value.relation === 'argument_parameter')).toHaveLength(
      1,
    );
    expect(result.values.filter((value) => value.relation === 'return_call')).toHaveLength(1);
  }, 30_000);

  it('preserves an abstract method return type without claiming an executable implementation', () => {
    const result = fixture(`package fixture; interface Remote { String fetch(); }
      class App { Remote remote; void consume(String value) {} void run() { consume(remote.fetch()); } }
    `);
    expect(result.calls.find((call) => call.methodName === 'fetch')).toMatchObject({
      resolution: 'unresolved',
      target: null,
    });
    expect(result.calls.find((call) => call.methodName === 'consume')).toMatchObject({
      resolution: 'exact',
      argumentTypes: ['java.lang.String'],
    });
  }, 30_000);

  it('infers an unbounded generic helper return and a native record component projection', () => {
    const result = fixture(`package fixture;
      record Account(String name) {} record Response(Account data) {}
      class App {
        private <T> T nullCheck(T response, String id) { if (response == null) throw new RuntimeException(id); return response; }
        Account fetch(Response response, String id) { return nullCheck(response, id).data(); }
        private <T> T same(T first, T second) { return first; }
        private <T extends Number> T bounded(T input) { return input; }
        void invalid(Response response, Account account) { same(response, account); bounded(account); }
      }`);
    const genericCall = result.calls.find((call) => call.methodName === 'nullCheck');
    expect(genericCall).toMatchObject({
      resolution: 'exact',
      signature: 'fixture.App#nullCheck(fixture.Response,java.lang.String):fixture.Response',
    });
    const data = result.calls.find((call) => call.methodName === 'data');
    expect(data).toMatchObject({
      resolution: 'unresolved',
      receiverType: 'fixture.Response',
      target: null,
    });
    const component = result.unit.types.find((type) => type.name === 'Response')?.fields[0];
    expect(result.values).toContainEqual(
      expect.objectContaining({
        relation: 'field_projection',
        from: component?.source,
        to: data?.call,
        call: data?.call,
      }),
    );
    expect(result.calls.find((call) => call.methodName === 'same')).toMatchObject({
      resolution: 'unresolved',
      target: null,
    });
    expect(result.calls.find((call) => call.methodName === 'bounded')).toMatchObject({
      resolution: 'unresolved',
      target: null,
    });
  }, 30_000);

  it('uses explicit record accessor bodies instead of projecting their component automatically', () => {
    const result = fixture(`package fixture;
      record Response(String data) { public String data() { return "changed"; } }
      class App { String fetch(Response response) { return response.data(); } }
    `);
    expect(result.calls.find((call) => call.methodName === 'data')).toMatchObject({
      resolution: 'exact',
    });
    expect(result.values.filter((value) => value.relation === 'field_projection')).toEqual([]);
    expect(result.values.filter((value) => value.relation === 'return_call')).toHaveLength(1);
  }, 30_000);

  it('keeps anonymous construction and unbound var receivers nullable without empty type names', () => {
    const result = fixture(`package fixture; class App {
      Object anonymous() { return new Object() {}; }
      void run() { var client = unknown(); client.fetch(); }
    }`);
    expect(result.calls.find((call) => call.methodName === 'fetch')).toMatchObject({
      receiverType: null,
      resolution: 'unresolved',
    });
    expect(
      result.calls.every(
        (call) => call.receiverType !== '' && call.argumentTypes.every((type) => type !== ''),
      ),
    ).toBe(true);
    const withoutCallee = {
      ...result.index,
      nodes: result.index.nodes.map((node) =>
        node.kind === 'NEW_CLASS' ? { ...node, fields: { ...node.fields, callee: [] } } : node,
      ),
    };
    const calls = collectJavaBindings([withoutCallee], [result.unit]).calls;
    expect(calls.find((call) => call.methodName === '<init>')).toMatchObject({
      receiverType: null,
      resolution: 'unresolved',
    });
  }, 30_000);

  it('keeps shadowed declarations scoped and quarantines compiler diagnostics', () => {
    const result = fixture(`package fixture; class App {
      String value; void accept(String text) {} void accept(int number) {}
      void run(int value) { accept(value); } void other() { accept(value); }
    }`);
    expect(result.calls.map((call) => call.argumentTypes)).toEqual([['int'], ['java.lang.String']]);
    expect(
      collectJavaBindings([{ ...result.index, diagnostics: ['parse error'] }], [result.unit]),
    ).toEqual({ calls: [], values: [] });
    const sourceIds = new Set(
      result.index.nodes.map((node) => declarationSource(result.index, node)),
    );
    expect(
      result.values.every((value) => sourceIds.has(value.from) && sourceIds.has(value.to)),
    ).toBe(true);
  }, 30_000);
});
