import 'server-only';

import type { SourceIndex, SyntaxNode } from './source-index-types';

const UNSUPPORTED = new Set([
  'CsharpDeconstructionAssignment',
  'CsharpCallbackAssignment',
  'TryStatement',
  'CatchClause',
  'WithStatement',
  'BreakStatement',
  'ContinueStatement',
  'LabeledStatement',
  'TRY',
  'CATCH',
  'SYNCHRONIZED',
  'ASSERT',
  'ERRONEOUS',
  'DeferStmt',
  'SendStmt',
  'CommClause',
  'CaseClause',
  'IncDecStmt',
  'BranchStmt',
  'BadStmt',
  'BadDecl',
  'BadExpr',
]);

const FUNCTIONS = new Set([
  'FunctionDeclaration',
  'MethodDeclaration',
  'ArrowFunction',
  'FunctionExpression',
  'METHOD',
  'LAMBDA_EXPRESSION',
  'FuncDecl',
  'FuncLit',
]);
const CALLS = new Set([
  'CallExpression',
  'NewExpression',
  'METHOD_INVOCATION',
  'NEW_CLASS',
  'CallExpr',
]);
const RETURNS = new Set(['ReturnStatement', 'RETURN', 'ReturnStmt']);
const BRANCHES = new Set([
  'IfStatement',
  'ConditionalExpression',
  'SwitchStatement',
  'IF',
  'CONDITIONAL_EXPRESSION',
  'SWITCH',
  'SWITCH_EXPRESSION',
  'IfStmt',
  'SwitchStmt',
  'TypeSwitchStmt',
  'SelectStmt',
]);
const LOOPS = new Set([
  'ForStatement',
  'ForOfStatement',
  'ForInStatement',
  'WhileStatement',
  'DoStatement',
  'FOR_LOOP',
  'ENHANCED_FOR_LOOP',
  'WHILE_LOOP',
  'DO_WHILE_LOOP',
  'ForStmt',
  'RangeStmt',
]);

export function syntaxRole(node: SyntaxNode): string {
  if (FUNCTIONS.has(node.kind)) return 'function';
  if (CALLS.has(node.kind)) return 'call';
  if (RETURNS.has(node.kind)) return 'return';
  if (BRANCHES.has(node.kind)) return 'branch';
  if (LOOPS.has(node.kind)) return 'loop';
  if (node.kind === 'AwaitExpression') return 'await';
  if (node.kind === 'GoStmt') return 'detached';
  if (['ThrowStatement', 'THROW'].includes(node.kind)) return 'throw';
  return 'other';
}

export function childrenOf(index: SourceIndex, parent: number): readonly SyntaxNode[] {
  return index.nodes.filter((node) => node.parent === parent);
}

export function enclosingFunction(index: SourceIndex, node: SyntaxNode): number | null {
  let parent = node.parent;
  while (parent !== null) {
    const ancestor = index.nodes[parent];
    if (!ancestor) return null;
    if (syntaxRole(ancestor) === 'function') return parent;
    parent = ancestor.parent;
  }
  return null;
}

/** Broad syntax denominator remains present even when framework recognisers are disabled. */
export function candidateKind(node: SyntaxNode): string | undefined {
  const role = syntaxRole(node);
  if (role !== 'other') return role;
  if (['ImportDeclaration', 'IMPORT', 'ImportSpec'].includes(node.kind)) return 'import';
  if (['Annotation', 'ANNOTATION', 'Decorator'].includes(node.kind)) return 'registration';
  if (node.kind === 'JsxAttribute') return 'lexical_control';
  if (['VariableDeclaration', 'VARIABLE', 'AssignStmt', 'ValueSpec'].includes(node.kind)) {
    return 'value';
  }
  if (UNSUPPORTED.has(node.kind)) return 'unsupported_syntax';
  return undefined;
}
