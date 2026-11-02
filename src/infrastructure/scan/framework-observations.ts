import 'server-only';

import type { SourceIndex, SyntaxNode } from './source-index-types';
import { childrenOf, syntaxRole } from './syntax-candidates';

export interface FrameworkObservation {
  readonly kind: 'http_registration' | 'write_invocation' | 'async_boundary' | 'lexical_control';
  readonly spelling: string;
  readonly authority: 'syntax_candidate';
  readonly reason: string;
}

const MAPPINGS = new Set([
  'RequestMapping',
  'GetMapping',
  'PostMapping',
  'PutMapping',
  'DeleteMapping',
  'PatchMapping',
]);
const WRITE_NAMES = new Set([
  'save',
  'saveAll',
  'insert',
  'update',
  'delete',
  'deleteById',
  'Insert',
  'InsertTx',
  'Exec',
  'ExecContext',
]);
const ASYNC_NAMES = new Set([
  'Async',
  'runAsync',
  'supplyAsync',
  'thenApplyAsync',
  'thenAcceptAsync',
  'thenRunAsync',
  'whenCompleteAsync',
]);
const CONTROLS = new Set(['onClick', 'onSubmit', 'onChange', 'onKeyDown', 'onPress']);

function observation(
  kind: FrameworkObservation['kind'],
  spelling: string,
  reason: string,
): FrameworkObservation {
  return { kind, spelling, authority: 'syntax_candidate', reason };
}

/** Framework names are candidates, never receiver/effect or business-intent proofs. */
export function frameworkObservations(
  index: SourceIndex,
  position: number,
): readonly FrameworkObservation[] {
  const node = index.nodes[position];
  if (!node) return [];
  const children = childrenOf(index, position);
  const head = children[0]?.text ?? '';
  const name = head.split('.').at(-1) ?? '';
  if (node.kind === 'ANNOTATION') return annotations(name, node);
  if (node.kind === 'JsxAttribute' && CONTROLS.has(head)) {
    return [
      observation(
        'lexical_control',
        node.text,
        'A lexical event attribute does not establish visibility, availability or user intent.',
      ),
    ];
  }
  if (syntaxRole(node) === 'await' || node.kind === 'GoStmt') {
    return [
      observation(
        'async_boundary',
        node.text,
        'Syntax establishes awaiting or detachment; completion and fault handling need attribution.',
      ),
    ];
  }
  if (syntaxRole(node) !== 'call') return [];
  return callObservations(name, head);
}

function callObservations(name: string, head: string): readonly FrameworkObservation[] {
  if (WRITE_NAMES.has(name)) {
    return [
      observation(
        'write_invocation',
        head,
        'Method name is a write candidate; receiver and durable effects are unresolved.',
      ),
    ];
  }
  if (ASYNC_NAMES.has(name)) {
    return [
      observation(
        'async_boundary',
        head,
        'Library spelling alone does not establish scheduling or completion semantics.',
      ),
    ];
  }
  return [];
}

function annotations(name: string, node: SyntaxNode): readonly FrameworkObservation[] {
  if (MAPPINGS.has(name)) {
    return [
      observation(
        'http_registration',
        node.text,
        'Annotation syntax is present; host composition and route exposure require configuration.',
      ),
    ];
  }
  if (ASYNC_NAMES.has(name)) {
    return [
      observation(
        'async_boundary',
        node.text,
        'Annotation syntax is present; enabled proxy, executor and invocation context are unresolved.',
      ),
    ];
  }
  return [];
}
