import { describe, expect, it, vi } from 'vitest';

import { collectJavaBindings } from '@/infrastructure/scan/java-call-bindings';
import { declarationSource } from '@/infrastructure/scan/java-declaration-parts';
import { javaDeclarations } from '@/infrastructure/scan/java-declarations';
import { indexSource } from '@/infrastructure/scan/source-index';
import { collectOutboundBindings } from '@/infrastructure/scan/spring-outbound-bindings';

vi.mock(import('server-only'), () => ({}));

function extract(content: string) {
  const index = indexSource({ path: 'src/main/java/Caller.java', language: 'java', content });
  expect(index.diagnostics).toEqual([]);
  const unit = javaDeclarations(index);
  if (!unit) throw new Error('Expected native Java declarations');
  const indexes = [index];
  const units = [unit];
  return {
    index,
    records: collectOutboundBindings({ indexes, units, ...collectJavaBindings(indexes, units) }),
  };
}

const imports = `package fixture;
import org.springframework.web.client.RestClient;
import com.volvocars.ecom.restclient.RestClientRegistry;
class Request {} class Response {}`;

describe.runIf(process.env.GROUNDWORK_NATIVE_PARSERS === '1')('RestClient response bodies', () => {
  it('keeps direct response classes distinct from request bodies and retains the legacy terminal', () => {
    const { index, records } = extract(`${imports}
      class Caller {
        final RestClient client;
        Caller(RestClientRegistry registry) { client=registry.getClient("conditional-order"); }
        Response checkout(Request request) {
          return client.post().uri("/v2/checkout").header("X-User","token")
            .body(request).retrieve().body(Response.class);
        }
        Response legacy(Request request) {
          return client.post().uri("/legacy").body(request).retrieve().toEntity(Response.class).getBody();
        }
      }`);
    expect(records).toHaveLength(2);
    const direct = records.find((record) => record.request.template === '/v2/checkout');
    expect(direct).toMatchObject({
      client: {
        type: 'org.springframework.web.client.RestClient',
        logical_name: 'conditional-order',
      },
      request: { method: 'POST', template: '/v2/checkout', headers: [{ name: 'X-User' }] },
      response: { type: 'fixture.Response' },
      completeness: 'source_path',
    });
    const sources = new Map(index.nodes.map((node) => [declarationSource(index, node), node.text]));
    expect(direct?.request.body_sources.map((source) => sources.get(source))).toEqual(['request']);
    expect(sources.get(direct?.response.type_source ?? '')).toBe('Response.class');
    expect(direct?.call_binding_ids.length).toBeGreaterThan(0);
    expect(direct?.value_binding_ids.length).toBeGreaterThan(0);
    expect(direct?.gaps.join(' ')).toContain('deployed address are unobserved');
    expect(records.find((record) => record.request.template === '/legacy')?.response.type).toBe(
      'fixture.Response',
    );
  });

  it('rejects untyped decoys, request-only body calls, unknown class arguments and missing URI', () => {
    const { records } = extract(`${imports}
      class Caller {
        Object decoy(Fake client) { return client.post().uri("/fake").retrieve().body(Response.class); }
        Object requestOnly(RestClient client) { return client.post().uri("/request").body(Response.class); }
        Object generic(RestClient client,Object type) { return client.post().uri("/generic").retrieve().body(type); }
        Object missingUri(RestClient client) { return client.post().retrieve().body(Response.class); }
        Object alias(RestClient client) {
          var response=client.post().uri("/alias").retrieve();
          return response.body(Response.class);
        }
      }`);
    expect(records).toEqual([]);
  });
});
