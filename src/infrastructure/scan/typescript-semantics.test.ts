import { describe, expect, it, vi } from 'vitest';

import { scanFixture } from '@/../test/scan-kit';
import type { SemanticEdge, SemanticNode } from '@/domain/scan/scan.generated';

import { extractLocalFacts } from './local-facts';
import { scanValidator } from './scan-format';
import { indexSource } from './source-index';
import { extractTypescriptSemantics } from './typescript-semantics';

vi.mock(import('server-only'), () => ({}));

const CONTEXT = { host: 'host:browser', repo: 'test/frontend', commit: 'a'.repeat(40) };

function graphOf(content: string) {
  const index = indexSource({ path: 'fixture.tsx', language: 'typescript', content });
  const result = extractTypescriptSemantics(index, CONTEXT);
  const nodes = result.semantic.filter(
    (record): record is SemanticNode => record.kind === 'semantic_node',
  );
  const edges = result.semantic.filter(
    (record): record is SemanticEdge => record.kind === 'semantic_edge',
  );
  return { ...result, nodes, edges };
}

function matching(
  graph: ReturnType<typeof graphOf>,
  syntax: string,
  kind?: SemanticNode['nodeKind'],
) {
  return graph.nodes.find(
    (node) => node.syntax === syntax && (kind === undefined || node.nodeKind === kind),
  );
}

function target(
  graph: ReturnType<typeof graphOf>,
  node: SemanticNode | undefined,
  relation: SemanticEdge['relation'],
) {
  const edge = graph.edges.find((entry) => entry.from === node?.id && entry.relation === relation);
  return graph.nodes.find((entry) => entry.id === edge?.to);
}

describe('TypeScript semantic compiler graph', () => {
  it('retains JSX passed as a call argument', () => {
    const graph = graphOf('function mount() { root.render(<App/>); }');
    const call = graph.nodes.find(
      (node) => node.nodeKind === 'call' && node.syntax === 'root.render(<App/>)',
    );
    const argument = target(graph, call, 'argument');
    expect(argument?.nodeKind).toBe('jsx_element');
  });
  it('retains returned object members without inventing lexical bindings into sibling functions', () => {
    const graph = graphOf(
      'function make() { const price=10; return {price}; } function use() { return make().price; }',
    );
    const propertyRead = graph.nodes.find(
      (node) => node.nodeKind === 'member' && node.syntax === 'make().price',
    );
    expect(propertyRead).toBeDefined();
    const propertyKeys = new Set(
      graph.nodes.filter((node) => node.nodeKind === 'property').map((node) => node.id),
    );
    expect(graph.edges.some((edge) => edge.relation === 'binds' && propertyKeys.has(edge.to))).toBe(
      false,
    );
    const lexicalPrice = graph.nodes.find(
      (node) =>
        node.nodeKind === 'identifier' &&
        node.syntax === 'price' &&
        graph.edges.some((edge) => edge.from === node.id && edge.relation === 'binds'),
    );
    expect(lexicalPrice).toBeDefined();
  });
  it('validates references to sibling functions without admitting sibling local bindings', async () => {
    const index = indexSource({
      path: 'fixture.ts',
      language: 'typescript',
      content:
        'export function parse(input: string) { return input; } function main() { return parse("value"); }',
    });
    const facts = extractLocalFacts(index, CONTEXT);
    const document = scanFixture();
    document.hosts.push({
      kind: 'host',
      id: CONTEXT.host,
      component: 'component:browser',
      environment: 'browser',
      support: [facts.sources[0]!.id],
    });
    document.sources = [
      ...new Map(
        [...document.sources, ...facts.sources].map((source) => [source.id, source]),
      ).values(),
    ];
    document.summaries.push(...facts.summaries);
    document.gaps.push(...facts.gaps);
    document.semantic = [...(facts.semantic ?? [])];
    const validate = await scanValidator();
    expect(validate(document)).toBe(document);
    const nodes = document.semantic.filter((record) => record.kind === 'semantic_node');
    const binding = document.semantic.find(
      (record) =>
        record.kind === 'semantic_edge' &&
        record.relation === 'binds' &&
        nodes.some(
          (node) =>
            node.id === record.to && node.nodeKind === 'function' && node.owner !== record.owner,
        ),
    );
    expect(binding).toBeDefined();
    const local = nodes.find((node) => node.nodeKind === 'parameter');
    expect(local).toBeDefined();
    document.semantic = document.semantic.map((record) =>
      record.id === binding?.id ? { ...binding, to: local!.id } : record,
    );
    expect(() => validate(document)).toThrow('escapes its lexical owner');
  });
  it('publishes compiler graphs through the public scan validator', async () => {
    const index = indexSource({
      path: 'fixture.tsx',
      language: 'typescript',
      content:
        'const base = "/api"; function Widget({next}: Props){ const load = async (input: Input) => { try { const res = await fetch(base, {body: JSON.stringify({x: input.x})}); if (!res.ok) throw new Error(); next((await res.json()).value); } finally { done(); } }; return <button onClick={() => load({x: 1})} disabled={false}/>; }',
    });
    const facts = extractLocalFacts(index, CONTEXT);
    const document = scanFixture();
    document.hosts.push({
      kind: 'host',
      id: CONTEXT.host,
      component: 'component:browser',
      environment: 'browser',
      support: [facts.sources[0]!.id],
    });
    document.sources = [
      ...new Map(
        [...document.sources, ...facts.sources].map((source) => [source.id, source]),
      ).values(),
    ];
    document.summaries.push(...facts.summaries);
    document.gaps.push(...facts.gaps);
    document.semantic = [...(facts.semantic ?? [])];
    const validate = await scanValidator();
    expect(validate(document)).toBe(document);
  });
  it('binds custom JSX callbacks to lexical functions and preserves captured parameters', () => {
    const graph = graphOf(
      'function Widget({finish}: Props){ const choose = (place: Place) => finish({place, north: place.north}); return <Picker onChosen={choose}/>; }',
    );
    const attribute = graph.nodes.find(
      (node) => node.nodeKind === 'jsx_attribute' && node.name === 'onChosen',
    );
    const element = graph.nodes.find(
      (node) => node.nodeKind === 'jsx_element' && node.name === 'Picker',
    );
    expect(target(graph, element, 'property')?.id).toBe(attribute?.id);
    const expression = target(graph, attribute, 'initializer');
    const identifier = target(graph, expression, 'value');
    const declaration = target(graph, identifier, 'binds');
    expect(declaration?.name).toBe('choose');
    const callback = target(graph, declaration, 'callback');
    expect(callback?.nodeKind).toBe('function');
    const finish = graph.nodes.findLast(
      (node) => node.nodeKind === 'identifier' && node.name === 'finish',
    );
    const captured = target(graph, finish, 'binds');
    expect(captured?.nodeKind).toBe('declaration');
    expect(captured?.name).toBe('finish');
    expect(captured?.owner).not.toBe(finish?.owner);
    const boundary = target(graph, attribute, 'registration');
    expect(boundary).toMatchObject({ nodeKind: 'runtime_boundary', authority: 'unresolved' });
    const shorthand = matching(graph, 'place', 'property');
    const shorthandValue = target(graph, shorthand, 'initializer');
    expect(shorthandValue?.nodeKind).toBe('identifier');
    expect(target(graph, shorthandValue, 'binds')?.nodeKind).toBe('parameter');
    const property = matching(graph, 'north: place.north', 'property');
    expect(target(graph, property, 'initializer')?.nodeKind).toBe('member');
  });

  it('preserves helper await boundaries separately from caller invocation and statement order', () => {
    const source =
      'function Screen(){ const submit = async () => { const reply = await fetch("/new", {body: JSON.stringify({count})}); const data = await reply.json(); next(data.result); }; return <button onClick={() => { submit(); track(); }} disabled={empty || pending}/>; }';
    const graph = graphOf(source);
    const fetch = matching(graph, 'fetch("/new", {body: JSON.stringify({count})})', 'call');
    expect(graph.edges.some((edge) => edge.relation === 'awaited' && edge.to === fetch?.id)).toBe(
      true,
    );
    const submit = matching(graph, 'submit()', 'call');
    expect(graph.edges.some((edge) => edge.relation === 'awaited' && edge.to === submit?.id)).toBe(
      false,
    );
    const changed = graphOf(source.replace('submit(); track();', 'await submit(); track();'));
    const changedCall = matching(changed, 'submit()', 'call');
    expect(
      changed.edges.some((edge) => edge.relation === 'awaited' && edge.to === changedCall?.id),
    ).toBe(true);
    const guard = matching(graph, 'empty || pending', 'binary');
    expect(guard?.operator).toBe('||');
    expect(target(graph, guard, 'left')?.name).toBe('empty');
    expect(target(graph, guard, 'right')?.name).toBe('pending');
  });

  it('distinguishes response member changes and reversed conditional paths structurally', () => {
    const source =
      'async function POST(req: Request){ try { const body = await req.json(); const {latitude} = body; const reply = await fetch(`/lookup?x=' +
      '${' +
      'latitude}`); if (!reply.ok) return json({error: true}, {status: reply.status}); const data = await reply.json(); return json({accepted: data.accepted}); } catch(error) { return json({error: true}, {status: 500}); } }';
    const graph = graphOf(source);
    const property = matching(graph, 'accepted: data.accepted', 'property');
    expect(target(graph, property, 'initializer')?.name).toBe('accepted');
    const changed = graphOf(source.replace('accepted: data.accepted', 'accepted: data.other'));
    expect(
      target(changed, matching(changed, 'accepted: data.other', 'property'), 'initializer')?.name,
    ).toBe('other');
    const branch = graph.nodes.find((node) => node.nodeKind === 'if');
    expect(target(graph, branch, 'condition')?.operator).toBe('!');
    expect(target(graph, branch, 'consequent')?.nodeKind).toBe('return');
    expect(graph.nodes.some((node) => node.nodeKind === 'catch')).toBe(true);
    const swapped = graphOf('function Gate(){ return ready ? <button disabled={false}/> : null; }');
    const reverse = graphOf('function Gate(){ return ready ? null : <button disabled={false}/>; }');
    const before = swapped.nodes.find((node) => node.nodeKind === 'conditional');
    const after = reverse.nodes.find((node) => node.nodeKind === 'conditional');
    expect(target(swapped, before, 'consequent')?.nodeKind).toBe('jsx_element');
    expect(target(reverse, after, 'consequent')?.value).toBeNull();
  });
});
