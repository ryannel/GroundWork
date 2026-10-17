import { describe, expect, it } from 'vitest';

import { coreShop } from '@/../test/fixtures/core-shop';
import { derive } from '@/application/plan/derive';
import { parseDocument } from '@/application/plan/federation-parse';
import { printSDL, sdlLines } from '@/application/plan/federation-sdl';
import type { SchemaNode, SystemGraph } from '@/domain/plan/plan-graph';

const m = derive(coreShop());
const typeIds = (g: SystemGraph): string[] =>
  g.schemas.filter((s) => s.kind === 'graph-type').map((s) => s.id);

interface ParsedField {
  type: string;
  directives: string[];
  owners: string[];
}
type Parsed = Record<string, { keys: string[]; fields: Record<string, ParsedField> }>;

/** Read the printed SDL back: type name → { keys, fields: name → { type, directives, owners } }. */
function parseSDL(text: string): Parsed {
  const out: Parsed = {};
  let cur: Parsed[string] | undefined;
  for (const line of text.split('\n')) {
    const head = /^type (\w+)((?: @key\(fields: "[^"]*"\))*) \{$/u.exec(line);
    if (head?.[1] !== undefined) {
      cur = {
        keys: [...(head[2] ?? '').matchAll(/@key\(fields: "([^"]*)"\)/gu)].map((x) => x[1]!),
        fields: {},
      };
      out[head[1]] = cur;
      continue;
    }
    const [body = '', owned] = line.split('  # owned by ');
    const f = /^ {2}(\w+)(?:\([^)]*\))?: (\S+)/u.exec(body);
    if (f?.[1] !== undefined && cur !== undefined) {
      cur.fields[f[1]] = {
        type: f[2]!,
        directives: [...body.slice(f[0].length).matchAll(/@\w+(?:\((?:[^()"]|"[^"]*")*\))?/gu)].map(
          (x) => x[0],
        ),
        owners: owned?.split(', ') ?? [],
      };
    }
  }
  return out;
}

describe('printSDL', () => {
  it('keys, field types, shareable and owners round-trip on the composed schema', () => {
    const sdl = parseSDL(printSDL(m.toBe, typeIds(m.toBe)));
    expect(sdl.Product?.keys).toEqual(['sku', 'id']);
    expect(sdl.Product?.fields.price?.type).toBe('Money!');
    expect(sdl.Product?.fields.price?.owners).toEqual(['pricing-v2']);
    expect(sdl.Money?.fields.amount?.directives).toContain('@shareable');
    expect(sdl.Customer?.keys).toEqual(['id']);
    for (const t of m.toBe.schemas.filter((s) => s.kind === 'graph-type')) {
      expect(Object.keys(sdl[t.name]?.fields ?? {}), t.name).toEqual(t.fields.map((f) => f.name));
    }
    expect(printSDL(m.toBe, ['sch:gql-query'])).toMatch(
      /search\(q: String!, first: Int\): \[Product!\]! @provides\(fields: "name imageUrl"\)/u,
    );
    expect(printSDL(m.toBe, ['sch:gql-product'])).toMatch(
      /deliveryPromise\(region: Region!\): String @requires\(fields: "stock \{ fc \}"\)/u,
    );
  });

  it('@override(from:) with a progressive percent, on a graph with the field moving', () => {
    const t = m.asIs.get('sch:gql-product') as SchemaNode;
    const moving = {
      ...t,
      fields: t.fields.map((f) =>
        f.name === 'price'
          ? {
              ...f,
              subgraphs: ['sg:pricing', 'sg:pricing-v2'],
              override: { from: 'sg:pricing', percent: 10 },
            }
          : f,
      ),
    };
    const g = {
      ...m.asIs,
      get: (id: string) => (id === moving.id ? moving : m.asIs.get(id)),
      schemas: m.asIs.schemas.map((s) => (s.id === moving.id ? moving : s)),
    } as unknown as SystemGraph;
    const price = parseSDL(printSDL(g, ['sch:gql-product'])).Product?.fields.price;
    expect(price?.directives).toEqual(['@override(from: "pricing", label: "percent(10)")']);
    expect(price?.owners).toEqual(['pricing', 'pricing-v2']);
    expect(printSDL(g, ['sch:gql-product'], { only: 'sg:pricing-v2' })).toMatch(
      /price: Money! @override\(from: "pricing", label: "percent\(10\)"\)\n/u,
    );
  });

  it('only: one subgraph owns its fields and names the rest as @external', () => {
    const search = parseSDL(printSDL(m.toBe, typeIds(m.toBe), { only: 'sg:search' }));
    expect(Object.keys(search)).toEqual(['Query', 'Product']);
    expect(Object.keys(search.Query?.fields ?? {})).toEqual(['search']);
    expect(Object.keys(search.Product?.fields ?? {})).toEqual(['sku', 'name', 'imageUrl']);
    for (const n of ['sku', 'name', 'imageUrl']) {
      expect(search.Product?.fields[n]?.directives, n).toContain('@external');
    }
    expect(search.Product?.fields.name?.owners).toEqual(['product']);
    const promise = parseSDL(printSDL(m.toBe, typeIds(m.toBe), { only: 'sg:promise' }));
    expect(promise.Product?.fields.stock?.directives).toContain('@external');
    expect(promise.Stock?.fields.fc?.directives).toContain('@external');
    const pricing = parseSDL(printSDL(m.toBe, typeIds(m.toBe), { only: 'sg:pricing-v2' }));
    expect(Object.keys(pricing.Product?.fields ?? {})).toEqual(['sku', 'price']);
    expect(pricing.Product?.fields.price?.directives).toHaveLength(0);
  });

  it('is pure: the same input prints the same text, structured lines agree', () => {
    const a = printSDL(m.toBe, typeIds(m.toBe));
    expect(a).toBe(printSDL(m.toBe, typeIds(m.toBe)));
    expect(a).toBe(
      sdlLines(m.toBe, typeIds(m.toBe))
        .map((l) => l.text)
        .join('\n'),
    );
    expect(printSDL(m.toBe, ['sch:not-a-type'])).toBe('');
  });

  it('variables say whether they must be sent', () => {
    const d = parseDocument('query Q($a: ID!, $b: Int, $c: Int! = 3, $d: [String!]!) { x }');
    expect(d.variables.map((v) => [v.name, v.type, v.required])).toEqual([
      ['a', 'ID!', true],
      ['b', 'Int', false],
      ['c', 'Int!', false],
      ['d', '[String!]!', true],
    ]);
  });
});
