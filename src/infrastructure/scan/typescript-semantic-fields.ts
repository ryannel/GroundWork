import 'server-only';

import ts from 'typescript';

import type { SyntaxFields } from './source-index-types';

/** Named compiler children retain roles without parsing display text in downstream rules. */
export function typescriptSemanticFields(node: ts.Node, file: ts.SourceFile): SyntaxFields {
  const fields: Record<string, (readonly [number, number])[]> = {};
  const add = (name: string, children: readonly ts.Node[]) => {
    fields[name] = children.map((child) => [child.getStart(file), child.getEnd()]);
  };
  nameSlots(node, add);
  valueSlots(node, add);
  expressionSlots(node, add);
  controlSlots(node, add);
  exceptionSlots(node, add);
  jsxSlots(node, add);

  if (ts.isBlock(node) || ts.isSourceFile(node)) add('statements', node.statements);
  if (ts.isObjectLiteralExpression(node)) add('properties', node.properties);
  if (ts.isArrayLiteralExpression(node)) add('elements', node.elements);
  if (ts.isObjectBindingPattern(node) || ts.isArrayBindingPattern(node)) {
    add('elements', node.elements);
  }
  if (ts.isTemplateExpression(node)) add('spans', [node.head, ...node.templateSpans]);
  if (ts.isTemplateSpan(node)) add('expression', [node.expression, node.literal]);
  if (ts.isFunctionLike(node) && 'body' in node && node.body) add('body', [node.body]);
  return fields;
}

type Add = (name: string, children: readonly ts.Node[]) => void;

function valueSlots(node: ts.Node, add: Add) {
  if (
    (ts.isVariableDeclaration(node) || ts.isParameter(node) || ts.isBindingElement(node)) &&
    node.initializer
  ) {
    add('initializer', [node.initializer]);
  }
  if (ts.isBindingElement(node) && node.propertyName) add('propertyName', [node.propertyName]);
  if (ts.isBinaryExpression(node)) {
    add('left', [node.left]);
    add('right', [node.right]);
    add('operator', [node.operatorToken]);
  }
}

function expressionSlots(node: ts.Node, add: Add) {
  if (ts.isPropertyAccessExpression(node) || ts.isElementAccessExpression(node)) {
    add('receiver', [node.expression]);
    if (ts.isElementAccessExpression(node)) add('index', [node.argumentExpression]);
  }
  if (ts.isPropertyAssignment(node)) add('initializer', [node.initializer]);
  if (ts.isShorthandPropertyAssignment(node)) add('initializer', [node.name]);
  if (ts.isExpressionStatement(node) || ts.isParenthesizedExpression(node)) {
    add('expression', [node.expression]);
  }
  if (ts.isPrefixUnaryExpression(node) || ts.isPostfixUnaryExpression(node)) {
    add('operand', [node.operand]);
  }
  if (ts.isTypeOfExpression(node) || ts.isAsExpression(node)) add('operand', [node.expression]);
}

function exceptionSlots(node: ts.Node, add: Add) {
  if (ts.isThrowStatement(node)) add('values', [node.expression]);
  if (ts.isTryStatement(node)) {
    add('body', [node.tryBlock]);
    if (node.catchClause) add('catch', [node.catchClause]);
    if (node.finallyBlock) add('finally', [node.finallyBlock]);
  }
  if (ts.isCatchClause(node)) {
    add('body', [node.block]);
    if (node.variableDeclaration) add('parameters', [node.variableDeclaration]);
  }
}

function controlSlots(node: ts.Node, add: Add) {
  if (ts.isSwitchStatement(node)) {
    add('condition', [node.expression]);
    add('body', [node.caseBlock]);
  }
  if (ts.isCaseBlock(node)) add('cases', node.clauses);
  if (ts.isCaseClause(node)) add('condition', [node.expression]);
  if (ts.isCaseClause(node) || ts.isDefaultClause(node)) add('statements', node.statements);
}

function jsxSlots(node: ts.Node, add: Add) {
  if (ts.isJsxAttribute(node) && node.initializer) add('initializer', [node.initializer]);
  if (ts.isJsxExpression(node) && node.expression) add('expression', [node.expression]);
  if (ts.isJsxElement(node)) {
    add('opening', [node.openingElement]);
    add('children', node.children);
  }
  if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
    add('tag', [node.tagName]);
    add('attributes', node.attributes.properties);
  }
}

export function typescriptDefinition(node: ts.Node, checker: ts.TypeChecker): SyntaxFields {
  if (!ts.isIdentifier(node)) return {};
  if (ts.isPropertyAccessExpression(node.parent) && node.parent.name === node) return {};
  const symbol =
    ts.isShorthandPropertyAssignment(node.parent) && node.parent.name === node
      ? checker.getShorthandAssignmentValueSymbol(node.parent)
      : checker.getSymbolAtLocation(node);
  const declarations = symbol?.declarations;
  if (declarations?.length !== 1) return {};
  const declaration = declarations[0];
  if (declaration?.getSourceFile() !== node.getSourceFile()) return {};
  if (isDataProperty(declaration)) return {};
  return { definition: [[declaration.getStart(), declaration.getEnd()]] };
}

function isDataProperty(declaration: ts.Declaration): boolean {
  return (
    ts.isPropertyAssignment(declaration) ||
    ts.isShorthandPropertyAssignment(declaration) ||
    ts.isPropertySignature(declaration) ||
    ts.isPropertyDeclaration(declaration)
  );
}

function nameSlots(node: ts.Node, add: Add) {
  if (ts.isFunctionLike(node) && node.name) add('name', [node.name]);
  if (ts.isVariableDeclaration(node) || ts.isParameter(node) || ts.isBindingElement(node)) {
    add('name', [node.name]);
  }
  if (
    ts.isPropertyAccessExpression(node) ||
    ts.isPropertyAssignment(node) ||
    ts.isShorthandPropertyAssignment(node) ||
    ts.isJsxAttribute(node)
  ) {
    add('name', [node.name]);
  }
}
