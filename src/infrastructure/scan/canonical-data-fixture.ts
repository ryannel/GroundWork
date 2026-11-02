import 'server-only';

import ts from 'typescript';

import { localCompiler } from './typescript-binding';

export interface CanonicalLiteralProof {
  readonly parser: string;
  readonly literalNodes: number;
  readonly lines: readonly [number, number];
}
function sourceFile(path: string, content: string): ts.SourceFile | undefined {
  const file = ts.createSourceFile(path, content, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const program = localCompiler({ path, content, language: 'typescript' }, file);
  return program.getSyntacticDiagnostics(file).length === 0 ? file : undefined;
}
function staticProperty(node: ts.ObjectLiteralElementLike): ts.Expression | undefined {
  if (!ts.isPropertyAssignment(node)) return undefined;
  const name = node.name;
  if (!ts.isIdentifier(name) && !ts.isStringLiteral(name) && !ts.isNumericLiteral(name)) {
    return undefined;
  }
  return node.initializer;
}
function children(node: ts.Expression): readonly ts.Expression[] | undefined {
  if (ts.isObjectLiteralExpression(node)) {
    const values = node.properties.map(staticProperty);
    return values.includes(undefined) ? undefined : values.filter((value) => value !== undefined);
  }
  if (ts.isArrayLiteralExpression(node)) return node.elements;
  if (ts.isStringLiteral(node) || ts.isNumericLiteral(node)) return [];
  if (
    [ts.SyntaxKind.TrueKeyword, ts.SyntaxKind.FalseKeyword, ts.SyntaxKind.NullKeyword].includes(
      node.kind,
    )
  ) {
    return [];
  }
  if (
    ts.isPrefixUnaryExpression(node) &&
    node.operator === ts.SyntaxKind.MinusToken &&
    ts.isNumericLiteral(node.operand)
  ) {
    return [];
  }
  return undefined;
}

/** Entire supplied source must be one export-default literal tree; no dependency resolution or execution. */
export function canonicalDataLiteral(
  path: string,
  content: string,
): CanonicalLiteralProof | undefined {
  const file = sourceFile(path, content);
  if (file?.statements.length !== 1) return undefined;
  const statement = file.statements[0];
  if (
    statement === undefined ||
    !ts.isExportAssignment(statement) ||
    statement.isExportEquals === true
  ) {
    return undefined;
  }
  const queue: ts.Expression[] = [statement.expression];
  let literalNodes = 0;
  while (queue.length > 0) {
    const node = queue.pop();
    if (node === undefined) return undefined;
    const values = children(node);
    if (values === undefined) return undefined;
    for (const value of values) queue.push(value);
    literalNodes += 1;
  }
  return {
    parser: `typescript/${ts.version}`,
    literalNodes,
    lines: [1, content.split('\n').length],
  };
}

/** Only an actual Storybook import in pinned configuration establishes candidate context. */
export function storybookConfiguration(path: string, content: string): boolean {
  const file = sourceFile(path, content);
  return (
    file?.statements.some((statement) => {
      if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier)) {
        return false;
      }
      const moduleName = statement.moduleSpecifier.text;
      return (
        moduleName.startsWith('@storybook/') || moduleName.split('/').includes('storybook-utils')
      );
    }) ?? false
  );
}
