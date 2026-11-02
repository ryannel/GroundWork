import type { ExplorerNode, ExplorerPage } from '@/domain/service-explorer';

import { visualCandidates } from './visual-candidates';
import { visualDescendants, visualLinks } from './visual-edges';
import { visualNode } from './visual-node';
import { visualPage } from './visual-page';
import type { VisualContext } from './visual-types';

const VISIBLE = new Set([
  'function',
  'if',
  'conditional',
  'loop',
  'call',
  'construct',
  'return',
  'throw',
  'catch',
  'await',
  'callback',
  'defer',
]);

function shortType(spelling: string): string {
  const separators = new Set('<>,?()[] \t\n');
  let result = '';
  let token = '';
  for (const character of spelling.replaceAll('global::', '')) {
    if (separators.has(character)) {
      result += (token.split('.').at(-1) ?? token) + character;
      token = '';
    } else token += character;
  }
  return result + (token.split('.').at(-1) ?? token);
}

function schemaLabel(context: VisualContext, id: string): string {
  const record = context.input.records.find((item) => item.id === id);
  if (record?.kind === 'schema_binding') {
    return record.typeName.split('.').at(-1) ?? record.typeName;
  }
  if (record?.kind === 'contract') return shortType(record.shape.spelling);
  return 'Unexpanded source shape';
}
function rootSchemas(context: VisualContext, source: string): ExplorerNode[] {
  const entry = context.entries.find((item) => item.source === source);
  return [...new Set(entry?.schemas)].map((id) => ({
    id: `schema:${source}:${id}`,
    label: `Declared shape: ${schemaLabel(context, id)}`,
    detail:
      'Declared source signature shape. Parameter injection, request binding and effective wire formatting remain separate.',
    kind: 'schema',
    sourceIds: [source],
    target: context.files.get(id) ?? null,
  }));
}

export function visualFlow(context: VisualContext, source: string, title: string): ExplorerPage {
  const root =
    context.functions?.get(source) ??
    [...context.nodes.values()].find(
      (node) => node.source === source && node.nodeKind === 'function',
    );
  if (root === undefined) return unexpanded(context, source, title);
  const reached = visualDescendants(context, root.id);
  const reachedNodes = [...reached]
    .flatMap((id) => {
      const node = context.nodes.get(id);
      return node === undefined ? [] : [node];
    })
    .toSorted(
      (left, right) =>
        (context.nodeOrder?.get(left.id) ?? 0) - (context.nodeOrder?.get(right.id) ?? 0),
    );
  const nodes = reachedNodes
    .filter((node) => VISIBLE.has(node.nodeKind))
    .map((node) => visualNode(context, node, root.id));
  const candidates = visualCandidates(
    context,
    reachedNodes.filter((node) => node.nodeKind === 'call'),
  );
  const visible = new Set(nodes.map((node) => node.id));
  const extra = rootSchemas(context, source);
  return visualPage(context, {
    kind: 'flow',
    title,
    description:
      'One method’s source structure. Calls open their own implementations. Arrows show containment, branch conditions and values; runtime execution remains unobserved.',
    nodes: [...nodes, ...extra, ...candidates.nodes],
    links: [
      ...visualLinks(context, visible).map((link) =>
        nodes.find((node) => node.id === link.to)?.kind === 'async'
          ? { ...link, kind: 'async' as const }
          : link,
      ),
      ...candidates.links,
      ...extra.map((node) => ({
        id: `shape:${node.id}`,
        from: root.id,
        to: node.id,
        label: 'declared source schema reference',
        kind: 'data' as const,
        sourceIds: [source],
      })),
    ],
    fields: [],
    gaps: [
      'Branch feasibility, runtime dispatch, deployment and durable completion are unverified',
      'Unresolved calls may have further effects; asynchronous source declarations do not prove scheduling or delivery',
    ],
    completeSelection: reached.size < 10_000,
  });
}

function unexpanded(context: VisualContext, source: string, title: string): ExplorerPage {
  return visualPage(context, {
    kind: 'flow',
    title,
    description:
      'Source entry declared; its implementation has not been expanded in this selected evidence',
    nodes: [
      {
        id: source,
        label: title,
        detail: 'Open the source declaration. Behaviour remains unexpanded.',
        kind: 'entry',
        sourceIds: context.input.sources.some((item) => item.id === source) ? [source] : [],
        target: null,
      },
      ...rootSchemas(context, source),
    ],
    links: rootSchemas(context, source).map((node) => ({
      id: `unexpanded-shape:${node.id}`,
      from: source,
      to: node.id,
      label: 'declared source shape',
      kind: 'data',
      sourceIds: [source],
    })),
    fields: [],
    gaps: ['Implementation not expanded; no absence of effects is inferred'],
    completeSelection: false,
  });
}
