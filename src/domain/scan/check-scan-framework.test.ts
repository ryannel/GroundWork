import { describe, expect, it } from 'vitest';

import { springRecordFixture } from '@/../test/spring-record-kit';

import { validateScanDocument } from './check-scan';

function foreignSource(document: ReturnType<typeof springRecordFixture>['document']): string {
  const source = document.sources[0]!;
  document.sources.push({ ...source, id: 'source:foreign', commit: 'other-commit' });
  return 'source:foreign';
}

describe('native framework reference invariants', () => {
  it('accepts source-backed schema, route and security records', () => {
    expect(validateScanDocument(springRecordFixture().document)).toEqual([]);
  });

  it('rejects duplicate framework IDs and dangling or wrong-kind binding references', () => {
    const { document, route, schema } = springRecordFixture();
    document.framework?.push({ ...route });
    route.security_binding_ids = ['missing', schema.id];
    route.schema_binding_ids = ['missing:schema', 'security:test'];
    schema.profiles[0]!.routeId = 'host:server';
    const errors = validateScanDocument(document);
    expect(errors).toContain('route:test: duplicate record id');
    expect(errors).toContain('route:test: missing must reference security_binding');
    expect(errors).toContain('route:test: schema:test must reference security_binding');
    expect(errors).toContain('route:test: missing:schema must reference schema_binding');
    expect(errors).toContain('route:test: security:test must reference schema_binding');
    expect(errors).toContain('schema:test: host:server must reference route_binding');
  });

  it('checks nested source references rather than only top-level evidence', () => {
    const { document, route, schema, security } = springRecordFixture();
    route.parameters[0]!.source_id = 'missing:parameter';
    route.method.implementation_source_id = 'host:server';
    schema.properties[0]!.annotations[0]!.source = 'missing:annotation';
    security.enforcement_chain[0]!.source_ids = ['missing:chain'];
    security.activation.source_ids = ['missing:activation'];
    security.policies[0]!.source_id = 'missing:policy';
    const errors = validateScanDocument(document);
    expect(errors).toContain('route:test: missing:parameter must reference source');
    expect(errors).toContain('route:test: host:server must reference source');
    expect(errors).toContain('schema:test: missing:annotation must reference source');
    expect(errors).toContain('security:test: missing:chain must reference source');
    expect(errors).toContain('security:test: missing:activation must reference source');
    expect(errors).toContain('security:test: missing:policy must reference source');
  });

  it('rejects source pin changes in nested fields and cross-binding links', () => {
    const { document, route, schema, security } = springRecordFixture();
    const foreign = foreignSource(document);
    schema.properties[0]!.source = foreign;
    security.source_ids = [foreign];
    security.policies = [];
    security.activation.source_ids = [];
    security.enforcement_chain = [];
    expect(validateScanDocument(document)).toContain(
      'schema:test: framework source source:foreign crosses repository or commit',
    );
    expect(validateScanDocument(document)).toContain(
      'route:test: framework reference security:test crosses repository or commit',
    );
    route.source_ids = [foreign];
    route.parameters = [];
    route.method.declaration_source_id = foreign;
    delete route.method.implementation_source_id;
    expect(validateScanDocument(document)).toContain(
      'schema:test: framework reference route:test crosses repository or commit',
    );
  });

  it('rejects mixed repositories and evidence-free records', () => {
    const { document, route, schema } = springRecordFixture();
    document.sources.push({ ...document.sources[0]!, id: 'source:repo', repo: 'another/repo' });
    schema.support = ['source:repo'];
    route.source_ids = [];
    expect(validateScanDocument(document)).toContain(
      'schema:test: framework source source:repo crosses repository or commit',
    );
    expect(validateScanDocument(document)).toContain(
      'route:test: framework record needs a primary source',
    );
    schema.source = 'missing';
    expect(validateScanDocument(document)).toContain(
      'schema:test: framework record needs a primary source',
    );
  });
});
