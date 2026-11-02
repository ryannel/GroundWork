import 'server-only';

import type { SourceFrameworkBinding } from '@/domain/scan/scan.generated';

import {
  polyglotFields,
  polyglotSource,
  polyglotSupport,
  pythonQualified,
} from './python-rust-fields';
import type { SourceIndex, SyntaxNode } from './source-index-types';

function sourceBinding(
  index: SourceIndex,
  node: SyntaxNode,
  target: SyntaxNode | undefined,
): SourceFrameworkBinding {
  const source = polyglotSource(index, node);
  return {
    kind: 'source_framework_binding',
    id: `binding:python:${source}`,
    source,
    support: polyglotSupport(index, node),
    language: 'python',
    framework: 'fastapi',
    role: 'http_entry',
    name: node.symbol ?? node.text,
    target_source: target ? polyglotSource(index, target) : null,
    declaration: node.text,
    status: 'source_declared',
    limitations: [
      'Source registration only; router mounting, response serialisation, dependency injection and live serving remain unresolved.',
    ],
  };
}
function factoryAssignments(index: SourceIndex): ReadonlyMap<string, string> {
  return new Map(
    index.nodes
      .filter((node) => node.kind === 'ASSIGNMENT' && node.parent === 0)
      .flatMap((node) => {
        const call = polyglotFields(index, node, 'values')[0];
        if (call?.kind !== 'METHOD_INVOCATION') return [];
        const callee = polyglotFields(index, call, 'callee')[0];
        const target = polyglotFields(index, node, 'targets')[0];
        return target?.symbol === undefined
          ? []
          : [[target.symbol, pythonQualified(index, callee)]];
      }),
  );
}
function decoratorBinding(
  index: SourceIndex,
  method: SyntaxNode,
): readonly SourceFrameworkBinding[] {
  const factories = factoryAssignments(index);
  return polyglotFields(index, method, 'annotations').flatMap((decorator) => {
    const callee = polyglotFields(index, decorator, 'callee')[0];
    if (callee?.kind !== 'MEMBER_SELECT') return [];
    const receiver = polyglotFields(index, callee, 'receiver')[0];
    const receiverName = receiver === undefined ? '' : (receiver.symbol ?? '');
    const factory = factories.get(receiverName);
    if (!['fastapi.APIRouter', 'fastapi.FastAPI'].includes(factory ?? '')) return [];
    if (
      !['get', 'post', 'put', 'delete', 'patch', 'head', 'options', 'api_route'].includes(
        callee.symbol ?? '',
      )
    ) {
      return [];
    }
    const route = sourceBinding(index, decorator, method);
    return [
      {
        ...route,
        name: `${(callee.symbol ?? '').toUpperCase()} ${String(polyglotFields(index, decorator, 'arguments')[0]?.literalValue ?? '<dynamic>')}`,
      },
    ];
  });
}
/** Import and factory resolved FastAPI decorators; similarly named local objects are excluded. */
export function collectPythonFrameworkBindings(
  indexes: readonly SourceIndex[],
): readonly SourceFrameworkBinding[] {
  return indexes
    .filter((index) => index.language === 'python' && index.diagnostics.length === 0)
    .flatMap((index) =>
      index.nodes.flatMap((node) => {
        if (node.kind === 'METHOD' && node.parent === 0) return decoratorBinding(index, node);
        if (node.kind !== 'METHOD_INVOCATION') return [];
        const callee = polyglotFields(index, node, 'callee')[0];
        const receiver = callee ? polyglotFields(index, callee, 'receiver')[0] : undefined;
        if (factoryAssignments(index).get(receiver?.symbol ?? '') !== 'fastapi.FastAPI') return [];
        const method = callee?.symbol ?? '';
        if (!['add_route', 'include_router', 'mount'].includes(method)) return [];
        return [
          {
            ...sourceBinding(index, node, polyglotFields(index, node, 'arguments')[1]),
            name: method,
            status: 'partial',
          },
        ];
      }),
    );
}
