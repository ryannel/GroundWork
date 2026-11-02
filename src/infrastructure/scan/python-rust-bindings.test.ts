import { describe, expect, it, vi } from 'vitest';

import { collectPythonFrameworkBindings } from './python-framework-bindings';
import { collectPolyglotSchemaBindings, collectPythonRustContracts } from './python-rust-contracts';
import { polyglotSource } from './python-rust-fields';
import { collectRustFrameworkBindings } from './rust-framework-bindings';
import { indexSource } from './source-index';

vi.mock(import('server-only'), () => ({}));
const python = `from fastapi import APIRouter as Routes
import graphene as gql
router = Routes()
@router.get("/health")
def health():
    return {"success": True}
class Result(gql.ObjectType):
    title = gql.String()
    values = gql.List(gql.Int)
`;
const rust = `use apollo_router::plugin::Plugin;
use serde::Deserialize;
#[derive(Deserialize)]
struct Conf { enabled: bool, key: Option<String> }
impl Plugin for Example {
    fn supergraph_service(&self, service: Service) -> Service { return service; }
}
`;
function pythonIndex(content = python) {
  return indexSource({ path: 'app.py', language: 'python', content });
}
function rustIndex(content = rust) {
  return indexSource({ path: 'app.rs', language: 'rust', content });
}

describe('parsed Python and Rust framework bindings', () => {
  it('resolves imported FastAPI aliases and links a route to its implementation source', () => {
    const index = pythonIndex();
    const result = collectPythonFrameworkBindings([index]);
    const imports = index.nodes.filter((node) => node.kind === 'IMPORT');
    expect(result[0]?.support).toEqual(
      expect.arrayContaining(imports.map((node) => polyglotSource(index, node))),
    );
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      name: 'GET /health',
      framework: 'fastapi',
      status: 'source_declared',
    });
    expect(result[0]?.target_source).toMatch(/^source:/u);
    expect(
      collectPythonFrameworkBindings([
        pythonIndex(python.replace('from fastapi import', 'from local_fake import')),
      ]),
    ).toEqual([]);
  });
  it('extracts Graphene DTO source field shapes and rejects similarly named unrelated classes', () => {
    const result = collectPythonRustContracts([pythonIndex()]);
    expect(result).toHaveLength(1);
    expect(result[0]?.shape).toMatchObject({
      kind: 'object',
      enforcement: 'source',
      fields: [
        { name: 'title', shape: { kind: 'scalar', name: 'string' } },
        { name: 'values', shape: { kind: 'array', item: { kind: 'scalar', name: 'integer' } } },
      ],
    });
    expect(
      collectPythonRustContracts([pythonIndex(python.replace('gql.ObjectType', 'object'))]),
    ).toEqual([]);
  });
  it('keeps Serde source optionality and Apollo trait entries explicitly partial', () => {
    const index = rustIndex();
    expect(index.diagnostics).toEqual([]);
    expect(collectRustFrameworkBindings([index])).toMatchObject([
      { name: 'supergraph_service', status: 'partial', framework: 'apollo-router' },
    ]);
    expect(
      collectRustFrameworkBindings([rustIndex(rust.replace('impl Plugin', 'impl LocalPlugin'))]),
    ).toEqual([]);
    expect(collectPythonRustContracts([index])[0]?.shape).toMatchObject({
      fields: [
        { name: 'enabled', presence: 'required', nullable: false, shape: { name: 'boolean' } },
        { name: 'key', presence: 'optional', nullable: true, shape: { name: 'string' } },
      ],
    });
    const annotation = index.nodes.find((node) => node.kind === 'ANNOTATION');
    expect(collectPolyglotSchemaBindings([index])[0]?.support).toContain(
      annotation ? polyglotSource(index, annotation) : 'missing',
    );
    expect(collectPolyglotSchemaBindings([index])[0]?.limitations[0]).toContain('wire enforcement');
  });
  it('never uses recovery syntax as a route or schema proof', () => {
    const broken = pythonIndex(`${python}\ndef broken(:`);
    expect(collectPythonFrameworkBindings([broken])).toEqual([]);
    expect(collectPythonRustContracts([broken])).toEqual([]);
    expect(collectPolyglotSchemaBindings([broken])).toEqual([]);
  });
  it('rejects lookalike Serde derives and unrelated Graphene calls', () => {
    expect(
      collectPolyglotSchemaBindings([
        rustIndex(rust.replace('#[derive(Deserialize)]', '#[derive(CustomDeserialize)]')),
      ]),
    ).toEqual([]);
    expect(
      collectPolyglotSchemaBindings([
        rustIndex(rust.replace('use serde::Deserialize;', 'use unrelated::Deserialize;')),
      ]),
    ).toEqual([]);
  });
});
