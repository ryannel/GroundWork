import 'server-only';

import ts from 'typescript';

import type { SourceIndex, SourceInput, SyntaxNode } from './source-index-types';
import { localCompiler, localDeclaration } from './typescript-binding';
import { typescriptFields } from './typescript-fields';
import { typescriptDefinition } from './typescript-semantic-fields';

export function typescriptIndex(
  input: SourceInput,
): Pick<SourceIndex, 'parser' | 'nodes' | 'diagnostics' | 'attribution'> {
  const kind = scriptKind(input);
  const file = ts.createSourceFile(input.path, input.content, ts.ScriptTarget.Latest, true, kind);
  const program = localCompiler(input, file);
  const checker = program.getTypeChecker();
  const nodes: SyntaxNode[] = [];
  function visit(node: ts.Node, parent: number | null) {
    const start = node.getStart(file);
    const end = node.getEnd();
    const index = nodes.length;
    const binding = localDeclaration(node, checker);
    nodes.push({
      ...(binding === undefined ? {} : { binding }),
      kind: ts.SyntaxKind[node.kind],
      fields: { ...typescriptFields(node, file), ...typescriptDefinition(node, checker) },
      ...typescriptLiteral(node),
      ...(ts.isFunctionLike(node) && node.name ? { symbol: node.name.getText(file) } : {}),
      text: input.content.slice(start, Math.min(end, start + 512)),
      start,
      end,
      lines: [
        file.getLineAndCharacterOfPosition(start).line + 1,
        file.getLineAndCharacterOfPosition(Math.max(start, end - 1)).line + 1,
      ],
      parent,
    });
    ts.forEachChild(node, (child) => {
      visit(child, index);
    });
  }
  visit(file, null);
  const diagnostics = program.getSyntacticDiagnostics(file);
  return {
    parser: `typescript/${ts.version}`,
    attribution: 'local_symbols',
    nodes,
    diagnostics: diagnostics.map((entry) =>
      ts.flattenDiagnosticMessageText(entry.messageText, '\n'),
    ),
  };
}

function scriptKind(input: SourceInput) {
  if (input.language === 'javascript') {
    return input.path.endsWith('x') ? ts.ScriptKind.JSX : ts.ScriptKind.JS;
  }
  return input.path.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
}

function typescriptLiteral(node: ts.Node): Pick<SyntaxNode, 'literalValue' | 'optionalAccess'> {
  if (ts.isNumericLiteral(node)) {
    const numeric = Number(node.text);
    return Number.isFinite(numeric) ? { literalValue: numeric } : {};
  }
  if (ts.isStringLiteralLike(node) || ts.isTemplateLiteralToken(node)) {
    return { literalValue: node.text };
  }
  if (
    ts.isPropertyAccessExpression(node) ||
    ts.isElementAccessExpression(node) ||
    ts.isCallExpression(node)
  ) {
    return { optionalAccess: node.questionDotToken !== undefined };
  }
  return {};
}
