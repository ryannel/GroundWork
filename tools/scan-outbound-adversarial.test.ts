import { describe, expect, it, vi } from 'vitest';

import { collectJavaBindings } from '@/infrastructure/scan/java-call-bindings';
import { javaDeclarations } from '@/infrastructure/scan/java-declarations';
import { indexSource } from '@/infrastructure/scan/source-index';
import { collectOutboundBindings } from '@/infrastructure/scan/spring-outbound-bindings';

vi.mock(import('server-only'), () => ({}));
const NATIVE = process.env.GROUNDWORK_NATIVE_PARSERS === '1';

function bindings(body: string, registry = 'com.volvocars.ecom.restclient.RestClientRegistry') {
  const index = indexSource({
    path: 'src/main/java/Client.java',
    language: 'java',
    content: `package fixture;
import org.springframework.web.client.RestClient;
import ${registry};
record Envelope(String data) {}
class Missing extends RuntimeException {}
class OtherMissing extends RuntimeException {}
class Client {
 RestClient client;
 Client(RestClientRegistry registry, RestClient replacement) { this.client = registry.getClient("fleet"); }
 ${body}
}`,
  });
  expect(index.diagnostics).toEqual([]);
  const unit = javaDeclarations(index);
  const units = unit ? [unit] : [];
  const { calls, values } = collectJavaBindings([index], units);
  return collectOutboundBindings({ indexes: [index], units, calls, values });
}

describe.skipIf(!NATIVE)('outbound binding adversarial source cases', () => {
  it('keeps distinct fluent chains separate and rejects spoof registry identity', () => {
    const records =
      bindings(`Object first() { return client.get().uri("/first").retrieve().toEntity(Envelope.class).getBody(); }
 Object second() { return client.post().uri("/second").body("data").retrieve().toEntity(Envelope.class).getBody(); }`);
    expect(records.map((record) => [record.request.method, record.request.template])).toEqual([
      ['GET', '/first'],
      ['POST', '/second'],
    ]);
    expect(records.every((record) => record.client.logical_name === 'fleet')).toBe(true);
    expect(
      bindings(
        `Object load() { return client.get().uri("/first").retrieve().toEntity(Envelope.class).getBody(); }`,
        'fixture.external.RestClientRegistry',
      )[0]?.client.logical_name,
    ).toBeNull();
  });
  it('separates chains in one method and respects a receiver parameter shadow', () => {
    const records = bindings(`Object load(boolean choose, RestClient client) {
 if (choose) return client.get().uri("/first").retrieve().toEntity(Envelope.class).getBody();
 return this.client.post().uri("/second").retrieve().toEntity(Envelope.class).getBody(); }`);
    expect(records.map((record) => record.request.template)).toEqual(['/first', '/second']);
    expect(records[0]?.client.logical_name).toBeNull();
    expect(records[1]?.client.logical_name).toBe('fleet');
  });
  it('does not attach an unrelated compound assignment to a member receiver', () => {
    const record = bindings(`class Holder { RestClient value; }
 void bind(Holder unrelated, RestClientRegistry registry) { unrelated.value = registry.getClient("unrelated"); }
 Object load(Holder requested) { return requested.value.get().uri("/fleet").retrieve().toEntity(Envelope.class).getBody(); }`)[0];
    expect(record?.client.logical_name).toBeNull();
  });
  it('does not retain a registry origin when another source can rebind the client', () => {
    const record = bindings(`void replace(RestClient replacement) { client = replacement; }
 Object load() { return client.get().uri("/fleet").retrieve().toEntity(Envelope.class).getBody(); }`)[0];
    expect(record?.client.logical_name).toBeNull();
    expect(record?.completeness).toBe('partial');
  });
  it('does not present a reassigned URI variable initialiser as the request template', () => {
    const record = bindings(
      `Object load() { String path = "/old"; path = "/new"; return client.get().uri(path).retrieve().toEntity(Envelope.class).getBody(); }`,
    )[0];
    expect(record?.request.template).not.toBe('/old');
  });
  it('does not treat a deferred lambda throw as a catch translation', () => {
    const record =
      bindings(`Object load() { try { return client.get().uri("/fleet").retrieve().toEntity(Envelope.class).getBody(); }
 catch (RuntimeException error) { Runnable deferred = () -> { throw new Missing(); }; throw error; } }`)[0];
    expect(record?.failure_paths[0]?.thrown_type).toBeNull();
    expect(record?.failure_paths[0]?.thrown_source).toBeNull();
  });
  it('leaves a catch with multiple different translations unresolved', () => {
    const record =
      bindings(`Object load(String id) { try { return client.get().uri("/fleet").retrieve().toEntity(Envelope.class).getBody(); }
 catch (RuntimeException error) { if (id == null) throw new Missing(); throw new OtherMissing(); } }`)[0];
    expect(record?.failure_paths[0]?.thrown_type).toBeNull();
  });
});
