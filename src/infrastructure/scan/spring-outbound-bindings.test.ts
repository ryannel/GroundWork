import { describe, expect, it, vi } from 'vitest';

import { collectJavaBindings } from './java-call-bindings';
import { javaDeclarations } from './java-declarations';
import { indexSource } from './source-index';
import { collectClientBoundaryBindings } from './spring-outbound-bindings';

vi.mock(import('server-only'), () => ({}));

function extract(content: string) {
  const index = indexSource({ path: 'src/main/java/Clients.java', language: 'java', content });
  expect(index.diagnostics).toEqual([]);
  const unit = javaDeclarations(index);
  if (!unit) throw new Error('Expected Java declarations');
  const indexes = [index];
  const units = [unit];
  return {
    index,
    records: collectClientBoundaryBindings({
      indexes,
      units,
      ...collectJavaBindings(indexes, units),
    }),
  };
}

const IMPORTS = `import org.springframework.graphql.client.GraphQlClient;
import org.springframework.graphql.client.HttpSyncGraphQlClient;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import com.volvocars.ecom.restclient.RestClientRegistry;
import java.util.Map;
`;

describe('source client boundaries', () => {
  it('retains GraphQL variables, projection, logical registry and failure translations across local origins', () => {
    const { records } = extract(`${IMPORTS}class Clients {
      private static final String NAME="consumer";
      private final GraphQlClient graph;
      Clients(RestClientRegistry registry) { graph=HttpSyncGraphQlClient.create(registry.getClient(NAME)); }
      String consumer(String id) {
        try {
          var response=graph.documentName("getConsumer").variable("id",id).executeSync();
          if (!response.isValid()) return null;
          var field=response.field("consumer");
          return field.toEntity(String.class);
        } catch (IllegalArgumentException e) { throw new IllegalStateException(e); }
      }
    }`);
    const binding = records.find((record) => record.kind === 'graphql_binding');
    expect(binding).toMatchObject({
      client: { logical_name: 'consumer' },
      document_name: 'getConsumer',
      variables: [{ name: 'id' }],
      response: { field_path: 'consumer', type: 'String' },
      completeness: 'partial',
    });
    expect(binding?.failure_paths).toHaveLength(1);
    expect(binding?.call_binding_ids.length).toBeGreaterThan(0);
    expect(binding?.value_binding_ids.length).toBeGreaterThan(0);
  });

  it('recognises direct GraphQL projection and refuses ambiguous response aliases and untyped decoys', () => {
    const { records } = extract(`${IMPORTS}class Clients {
      GraphQlClient graph;
      String partner(String id) { return graph.documentName("partner").variable("id",id).retrieveSync("partner").toEntity(String.class); }
      String ambiguous() {
        var response=graph.documentName("a").executeSync();
        response=graph.documentName("b").executeSync();
        return response.field("wrong").toEntity(String.class);
      }
      String decoy(Fake graph) { return graph.documentName("fake").retrieveSync("fake").toEntity(String.class); }
    }`);
    const bindings = records.filter((record) => record.kind === 'graphql_binding');
    expect(bindings).toHaveLength(3);
    expect(bindings[0]?.response.field_path).toBe('partner');
    expect(bindings.slice(1).every((binding) => binding.response.type === null)).toBe(true);
  });

  it('keeps deferred registry assignment and response projection as unresolved frontiers', () => {
    const { records } = extract(
      `${IMPORTS}class Clients {
      GraphQlClient graph;
      Clients(RestClientRegistry registry) {
        Runnable delayed = () -> { graph=HttpSyncGraphQlClient.create(registry.getClient("deferred")); };
      }
      String query() {
        var response=graph.documentName("query").executeSync();
        java.util.function.Supplier<String> delayed = () -> response.field("delayed").toEntity(String.class);
        return null;
      }
    }`,
    );
    const graph = records.find((record) => record.kind === 'graphql_binding');
    expect(graph?.client.logical_name).toBeNull();
    expect(graph?.response.type).toBeNull();
    expect(graph?.response.field_path).toBeNull();
  });

  it('keeps projections and returns with their nearest lambda execution owner', () => {
    const { records } = extract(`${IMPORTS}class Clients {
      GraphQlClient graph;
      Object query() {
        java.util.function.Supplier<String> request = () -> {
          var response=graph.documentName("query").executeSync();
          java.util.function.Supplier<String> nested = () -> {
            return response.field("deferred").toEntity(Integer.class);
          };
          return response.field("immediate").toEntity(String.class);
        };
        return null;
      }
    }`);
    const graph = records.find((record) => record.kind === 'graphql_binding');
    expect(graph?.response.type).toBe('String');
    expect(graph?.response.field_path).toBe('immediate');
    expect(graph?.response.return_sources).toHaveLength(1);
  });

  it('retains guarded caller arguments for a shared HTTP client helper without collapsing alternatives', () => {
    const { records } = extract(`import org.springframework.web.client.RestClient;
      import com.volvocars.ecom.restclient.RestClientRegistry;
      class Clients {
        RestClient first;
        RestClient second;
        Clients(RestClientRegistry registry) { first=registry.getClient("one"); second=registry.getClient("two"); }
        String user(boolean select,String token) {
          if(select) return user(first,"/one",token);
          return user(second,"/two",token);
        }
        String user(RestClient client,String path,String token) {
          return client.get().uri(path).header("Authorization",token).retrieve().toEntity(String.class).getBody();
        }
      }`);
    const binding = records.find((record) => record.kind === 'outbound_binding');
    expect(binding).toMatchObject({
      client: { logical_name: null },
      request: { template: null },
      completeness: 'partial',
    });
    expect(binding?.call_binding_ids.length).toBeGreaterThan(5);
    expect(binding?.value_binding_ids.length).toBeGreaterThan(10);
  });

  it('joins source decoder calls through the exact JDK string Set.of contract', () => {
    const content = `import java.util.Set;
      class Decoder { Object decode(String token,Set<String> issuers) { return null; } }
      class Caller {
        Decoder decoder;
        Object call(String token,String issuer) { return decoder.decode(token,Set.of(issuer)); }
        Object decoy(String token,Fake Set,String issuer) { return decoder.decode(token,Set.of(issuer)); }
      }`;
    const index = indexSource({ path: 'src/main/java/Calls.java', language: 'java', content });
    const unit = javaDeclarations(index);
    if (!unit) throw new Error('Expected Java declarations');
    const bindings = collectJavaBindings([index], [unit]);
    const calls = bindings.calls.filter((call) => call.methodName === 'decode');
    expect(calls[0]?.resolution).toBe('exact');
    expect(calls[0]?.argumentTypes[1]).toBe('java.util.Set<java.lang.String>');
    expect(calls[1]?.resolution).toBe('unresolved');
  });

  it('retains JwtDecoder contracts and explicit runtime gaps without inventing HTTP requests', () => {
    const { records } = extract(`${IMPORTS}class Clients {
      Map<String, JwtDecoder> decoders;
      Map<String, Fake> decoys;
      Object decode(String issuer,String token, Factory factory) {
        return decoders.computeIfAbsent(issuer,factory).decode(token);
      }
      Object direct(JwtDecoder decoder,String token) { return decoder.decode(token); }
      Object decoy(String issuer,String token,Factory factory) { return decoys.computeIfAbsent(issuer,factory).decode(token); }
    }`);
    expect(records).toHaveLength(2);
    expect(records.every((record) => record.kind === 'library_binding')).toBe(true);
    expect(records[0]).toMatchObject({
      owner_type: 'org.springframework.security.oauth2.jwt.JwtDecoder',
      method_name: 'decode',
      contract_basis: 'framework_api',
      completeness: 'partial',
    });
    expect(records[0]?.gaps.join(' ')).toContain('discovery/JWK');
  });
});
