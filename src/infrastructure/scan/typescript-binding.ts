import 'server-only';

import ts from 'typescript';

import type { SourceInput } from './source-index-types';

/** One supplied file only. No module resolution, default library or filesystem reads. */
export function localCompiler(input: SourceInput, file: ts.SourceFile): ts.Program {
  const host: ts.CompilerHost = {
    getSourceFile: (name) => (name === input.path ? file : undefined),
    getDefaultLibFileName: () => 'lib.d.ts',
    writeFile: () => {
      throw new Error('Source index never emits compiled files');
    },
    getCurrentDirectory: () => '',
    getDirectories: () => [],
    getCanonicalFileName: (name) => name,
    useCaseSensitiveFileNames: () => true,
    getNewLine: () => '\n',
    fileExists: (name) => name === input.path,
    readFile: (name) => (name === input.path ? input.content : undefined),
  };
  return ts.createProgram(
    [input.path],
    { noLib: true, noResolve: true, allowJs: true, checkJs: true, target: ts.ScriptTarget.Latest },
    host,
  );
}

export function localDeclaration(node: ts.Node, checker: ts.TypeChecker): number | undefined {
  if (!ts.isCallExpression(node) || !ts.isIdentifier(node.expression)) return undefined;
  const declarations = checker.getSymbolAtLocation(node.expression)?.declarations;
  if (declarations?.length !== 1) return undefined;
  const declaration = declarations[0];
  if (!declaration || !ts.isFunctionDeclaration(declaration)) return undefined;
  if (!declaration.body || declaration.getSourceFile() !== node.getSourceFile()) return undefined;
  const symbol = checker.getSymbolAtLocation(node.expression);
  if (symbol && mutableBinding(node.getSourceFile(), symbol, checker)) return undefined;
  return declaration.getStart();
}

function mutableBinding(file: ts.SourceFile, symbol: ts.Symbol, checker: ts.TypeChecker) {
  let mutable = false;
  function visit(node: ts.Node) {
    if (ts.isBinaryExpression(node)) {
      const token = node.operatorToken.kind;
      const assignment =
        token >= ts.SyntaxKind.FirstAssignment && token <= ts.SyntaxKind.LastAssignment;
      if (assignment && checker.getSymbolAtLocation(node.left) === symbol) mutable = true;
    }
    if (ts.isCallExpression(node) && node.expression.getText(file) === 'eval') mutable = true;
    ts.forEachChild(node, visit);
  }
  visit(file);
  return mutable;
}
