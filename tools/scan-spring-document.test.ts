import { describe, expect, it, vi } from 'vitest';

import { scanRecords } from '@/domain/scan/scan-records';
import { javaDeclarations } from '@/infrastructure/scan/java-declarations';
import { extractLocalFacts } from '@/infrastructure/scan/local-facts';
import { indexSource } from '@/infrastructure/scan/source-index';
import { springFrameworkDocument } from '@/infrastructure/scan/spring-framework-document';

vi.mock(import('server-only'), () => ({}));
const NATIVE = process.env.GROUNDWORK_NATIVE_PARSERS === '1';

describe.skipIf(!NATIVE)('native Spring framework publication', () => {
  it('joins inherited routes, request validation and nested response references with pinned evidence', async () => {
    const index = indexSource({
      path: 'src/main/java/Api.java',
      language: 'java',
      content: `package fixture;
      import org.springframework.web.bind.annotation.*;
      import jakarta.validation.Valid;
      import jakarta.validation.constraints.NotNull;
      @RequestMapping("/v1") interface Api { @PostMapping("/things") Wrapper<Thing> create(@RequestBody @Valid Thing input); }
      @RestController class Controller implements Api { public Wrapper<Thing> create(Thing input) { return null; } }
      class Wrapper<T> { T data; }
      class Thing { @NotNull String id; }`,
    });
    expect(index.diagnostics).toEqual([]);
    const unit = javaDeclarations(index);
    expect(unit).not.toBeNull();
    const facts = extractLocalFacts(index, {
      host: 'host:test',
      repo: 'fixture/spring',
      commit: 'b'.repeat(40),
    });
    const document = await springFrameworkDocument({
      units: unit === null ? [] : [unit],
      sources: [...new Map(facts.sources.map((source) => [source.id, source])).values()],
    });
    const routes = document.framework?.filter((record) => record.kind === 'route_binding') ?? [];
    expect(routes).toHaveLength(1);
    expect(routes[0]).toMatchObject({
      path: '/v1/things',
      http_method: 'POST',
      parameters: [{ location: 'body', validation_groups: ['jakarta.validation.groups.Default'] }],
    });
    expect(routes[0]?.schema_binding_ids?.length).toBeGreaterThan(1);
    const schemas = document.framework?.filter((record) => record.kind === 'schema_binding') ?? [];
    const thing = schemas.find((schema) => schema.typeName === 'fixture.Thing');
    expect(thing?.profiles).toContainEqual(
      expect.objectContaining({
        direction: 'request',
        fields: [expect.objectContaining({ name: 'id', nonNull: true })],
      }),
    );
    expect(schemas.some((schema) => schema.typeName === 'fixture.Wrapper<fixture.Thing>')).toBe(
      true,
    );
    expect(scanRecords(document).every((record) => record.kind !== 'semantic_node')).toBe(true);
    expect(document.sources.every((source) => source.commit === 'b'.repeat(40))).toBe(true);
  }, 30_000);
});
