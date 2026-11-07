import 'server-only';

import ts from 'typescript';

interface ModuleImport {
  readonly specifier: string;
  readonly names: readonly string[];
  readonly symbols: readonly string[];
  readonly runtime: boolean;
  readonly deferred: boolean;
  readonly typeNames: readonly string[];
  readonly typeSymbols: readonly string[];
  readonly reexports: readonly { readonly exposed: string; readonly imported: string }[];
  readonly line: number;
  readonly text: string;
}
interface ImportedUse {
  readonly name: string;
  readonly line: number;
  readonly text: string;
}
const LITERAL_KINDS = new Set([
  ts.SyntaxKind.StringLiteral,
  ts.SyntaxKind.NumericLiteral,
  ts.SyntaxKind.TrueKeyword,
  ts.SyntaxKind.FalseKeyword,
  ts.SyntaxKind.NullKeyword,
  ts.SyntaxKind.NoSubstitutionTemplateLiteral,
]);
function passiveLeaf(node: ts.Expression): boolean {
  return ts.isIdentifier(node) || ts.isArrowFunction(node) || ts.isFunctionExpression(node);
}
function literalValue(node: ts.Expression, passive = false): boolean {
  if (
    ts.isAsExpression(node) ||
    ts.isParenthesizedExpression(node) ||
    ts.isSatisfiesExpression(node)
  ) {
    return literalValue(node.expression, passive);
  }
  if (ts.isArrayLiteralExpression(node)) {
    return node.elements.every((element) => literalValue(element, passive));
  }
  if (ts.isObjectLiteralExpression(node)) {
    return node.properties.every((property) => passiveProperty(property, passive));
  }
  return LITERAL_KINDS.has(node.kind) || (passive && passiveLeaf(node));
}
function passiveProperty(property: ts.ObjectLiteralElementLike, passive: boolean): boolean {
  if (ts.isShorthandPropertyAssignment(property)) {
    return passive && property.objectAssignmentInitializer === undefined;
  }
  return (
    ts.isPropertyAssignment(property) &&
    !ts.isComputedPropertyName(property.name) &&
    literalValue(property.initializer, passive)
  );
}
function literalExports(statement: ts.Statement): readonly string[] {
  if (
    !ts.isVariableStatement(statement) ||
    statement.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword) !== true
  ) {
    return [];
  }
  return statement.declarationList.declarations.flatMap((declaration) =>
    ts.isIdentifier(declaration.name) &&
    declaration.initializer !== undefined &&
    literalValue(declaration.initializer)
      ? [declaration.name.text]
      : [],
  );
}
type SourceLocation = (node: ts.Node) => { readonly line: number; readonly text: string };
interface TypedValueUse extends ImportedUse {
  readonly typeName: string;
}
interface Bindings {
  readonly names: readonly string[];
  readonly symbols: readonly string[];
  readonly typeNames: readonly string[];
  readonly typeSymbols: readonly string[];
  readonly runtime: boolean;
}
function bindingsOf(clause: ts.ImportClause | undefined): Bindings {
  const named = clause?.namedBindings;
  const elements = named !== undefined && ts.isNamedImports(named) ? named.elements : [];
  const defaults = clause?.name === undefined ? [] : [clause.name.text];
  const namespace = named !== undefined && ts.isNamespaceImport(named) ? [named.name.text] : [];
  if (clause?.phaseModifier === ts.SyntaxKind.TypeKeyword) {
    return {
      names: [],
      symbols: [],
      typeNames: [...defaults, ...namespace, ...elements.map((binding) => binding.name.text)],
      typeSymbols: [
        ...defaults.map(() => 'default'),
        ...namespace.map(() => '*'),
        ...elements.map((binding) => binding.propertyName?.text ?? binding.name.text),
      ],
      runtime: false,
    };
  }
  const values = elements.filter((binding) => !binding.isTypeOnly);
  return {
    names: [...defaults, ...namespace, ...values.map((binding) => binding.name.text)],
    symbols: [
      ...defaults.map(() => 'default'),
      ...values.map((binding) => binding.propertyName?.text ?? binding.name.text),
    ],
    typeNames: elements.filter((binding) => binding.isTypeOnly).map((binding) => binding.name.text),
    typeSymbols: elements
      .filter((binding) => binding.isTypeOnly)
      .map((binding) => binding.propertyName?.text ?? binding.name.text),
    runtime: elements.length === 0 || values.length > 0 || defaults.length > 0,
  };
}
function staticImport(statement: ts.Node, location: SourceLocation): ModuleImport | null {
  if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier)) {
    return null;
  }
  return {
    specifier: statement.moduleSpecifier.text,
    ...bindingsOf(statement.importClause),
    deferred: false,
    reexports: [],
    ...location(statement),
  };
}
function staticExport(node: ts.Node, location: SourceLocation): ModuleImport | null {
  if (
    !ts.isExportDeclaration(node) ||
    node.moduleSpecifier === undefined ||
    !ts.isStringLiteral(node.moduleSpecifier)
  ) {
    return null;
  }
  const clause = node.exportClause;
  const elements = clause !== undefined && ts.isNamedExports(clause) ? clause.elements : [];
  const values = node.isTypeOnly ? [] : elements.filter((binding) => !binding.isTypeOnly);
  const reexports = values.map((binding) => ({
    exposed: binding.name.text,
    imported: binding.propertyName?.text ?? binding.name.text,
  }));
  return {
    specifier: node.moduleSpecifier.text,
    names: [],
    symbols: reexports.map((binding) => binding.imported),
    typeNames: [],
    typeSymbols: [],
    reexports,
    runtime: !node.isTypeOnly && (elements.length === 0 || values.length > 0),
    deferred: false,
    ...location(node),
  };
}
function dynamicImport(node: ts.Node, location: SourceLocation): ModuleImport | null {
  if (!ts.isCallExpression(node) || node.expression.kind !== ts.SyntaxKind.ImportKeyword) {
    return null;
  }
  const target = node.arguments[0];
  if (target === undefined || !ts.isStringLiteral(target)) return null;
  return {
    specifier: target.text,
    names: [],
    symbols: [],
    typeNames: [],
    typeSymbols: [],
    reexports: [],
    runtime: true,
    deferred: true,
    ...location(node),
  };
}
function namedBarrelStatement(statement: ts.Statement): boolean {
  if (
    ts.isTypeAliasDeclaration(statement) ||
    ts.isInterfaceDeclaration(statement) ||
    ts.isEmptyStatement(statement)
  ) {
    return true;
  }
  if (ts.isImportDeclaration(statement)) return !bindingsOf(statement.importClause).runtime;
  if (!ts.isExportDeclaration(statement)) return false;
  if (statement.isTypeOnly) return true;
  const clause = statement.exportClause;
  return (
    statement.moduleSpecifier !== undefined &&
    clause !== undefined &&
    ts.isNamedExports(clause) &&
    clause.elements.length > 0
  );
}
function erased(node: ts.Node): boolean {
  if (!ts.isTypeNode(node)) return false;
  const runtimeHeritage =
    ts.isExpressionWithTypeArguments(node) &&
    ts.isHeritageClause(node.parent) &&
    node.parent.token === ts.SyntaxKind.ExtendsKeyword &&
    ts.isClassLike(node.parent.parent);
  return !runtimeHeritage;
}
function referenceName(node: ts.Identifier): boolean {
  const parent = node.parent;
  if (
    ts.isParameter(parent) ||
    ts.isVariableDeclaration(parent) ||
    ts.isPropertyAccessExpression(parent) ||
    ts.isPropertyAssignment(parent)
  ) {
    return parent.name !== node;
  }
  return !ts.isBindingElement(parent) || parent.name !== node;
}
function typeNameOf(name: ts.EntityName): string {
  return ts.isIdentifier(name) ? name.text : typeNameOf(name.left);
}
function scopeOf(
  node: ts.Node,
  outer: ReadonlyMap<string, string>,
  types: ReadonlySet<string>,
): ReadonlyMap<string, string> {
  if (!ts.isFunctionLike(node)) return outer;
  const scope = new Map(outer);
  for (const parameter of node.parameters) {
    if (!ts.isIdentifier(parameter.name)) continue;
    const name = parameter.name.text;
    scope.delete(name);
    if (parameter.type !== undefined && ts.isTypeReferenceNode(parameter.type)) {
      const typeName = typeNameOf(parameter.type.typeName);
      if (types.has(typeName)) scope.set(name, typeName);
    }
  }
  return scope;
}
interface ValueSlice {
  readonly name: string;
  readonly exported: string | null;
  readonly eager: boolean;
  readonly uses: readonly ImportedUse[];
  readonly typedUses: readonly TypedValueUse[];
  readonly loads: readonly ModuleImport[];
}
interface SliceOwner {
  readonly name: string;
  readonly exported: string | null;
  readonly eager: boolean;
  readonly node: ts.Node;
}
function erasedDeclaration(statement: ts.Statement): boolean {
  return (
    ts.isTypeAliasDeclaration(statement) ||
    ts.isInterfaceDeclaration(statement) ||
    (ts.isExportDeclaration(statement) && statement.isTypeOnly)
  );
}
function ignoredStatement(statement: ts.Statement): boolean {
  if (ts.isExpressionStatement(statement)) return ts.isStringLiteral(statement.expression);
  if (ts.isExportDeclaration(statement)) return namedBarrelStatement(statement);
  return (
    ts.isImportDeclaration(statement) ||
    ts.isEmptyStatement(statement) ||
    erasedDeclaration(statement)
  );
}
function exportName(node: ts.HasModifiers, name: string): string | null {
  const modifiers = ts.getModifiers(node);
  if (modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword) !== true) {
    return null;
  }
  return modifiers.some((modifier) => modifier.kind === ts.SyntaxKind.DefaultKeyword)
    ? 'default'
    : name;
}
/** Unknown declarations remain broad. Deferred functions do not run during module evaluation. */
function ownerOf(statement: ts.Statement): readonly SliceOwner[] | null {
  if (ignoredStatement(statement)) return [];
  if (ts.isFunctionDeclaration(statement) && statement.body !== undefined) {
    const name = statement.name?.text ?? 'default';
    return [{ name, exported: exportName(statement, name), eager: false, node: statement }];
  }
  if (!ts.isVariableStatement(statement)) return null;
  const owners: SliceOwner[] = [];
  for (const declaration of statement.declarationList.declarations) {
    if (!ts.isIdentifier(declaration.name) || declaration.initializer === undefined) return null;
    const name = declaration.name.text,
      node = declaration.initializer;
    owners.push({
      name,
      exported: exportName(statement, name),
      eager: !literalValue(node, true),
      node,
    });
  }
  return owners;
}
function sliceOwners(source: ts.SourceFile): readonly SliceOwner[] | null {
  const owners: SliceOwner[] = [];
  for (const statement of source.statements) {
    const each = ownerOf(statement);
    if (each === null) return null;
    owners.push(...each);
  }
  return new Set(owners.map((owner) => owner.name)).size === owners.length ? owners : null;
}
/** Static source references for offline inventories; type erasure is distinct from reading a typed fact value. */
export function moduleUses(
  file: string,
  text: string,
): {
  readonly imports: readonly ModuleImport[];
  readonly uses: readonly ImportedUse[];
  readonly typedUses: readonly TypedValueUse[];
  readonly literalExports: readonly string[];
  readonly namedBarrel: boolean;
  readonly slices: readonly ValueSlice[] | null;
} {
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
  const lines = text.split('\n');
  const location: SourceLocation = (node) => {
    const line = source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1;
    return { line, text: lines[line - 1]?.trim() ?? '' };
  };
  const imports = source.statements.flatMap((statement) => {
    const imported = staticImport(statement, location);
    return imported === null ? [] : [imported];
  });
  const owners = sliceOwners(source);
  const names = new Set([
    ...imports.flatMap((item) => item.names),
    ...(owners ?? []).map((owner) => owner.name),
  ]);
  const types = new Set(imports.flatMap((item) => item.typeNames));
  let uses = new Map<string, ImportedUse>();
  let typedUses = new Map<string, TypedValueUse>();
  const record = (node: ts.Identifier, scope: ReadonlyMap<string, string>): void => {
    if (!referenceName(node)) return;
    const at = location(node),
      name = node.text;
    if (names.has(name)) uses.set(`${name}/${String(at.line)}`, { name, ...at });
    const typeName = scope.get(name);
    if (typeName !== undefined) {
      typedUses.set(`${name}/${String(at.line)}`, { name, typeName, ...at });
    }
  };
  const visit = (node: ts.Node, outer: ReadonlyMap<string, string>): void => {
    if (ts.isImportDeclaration(node) || erased(node)) return;
    const exported = staticExport(node, location);
    if (exported !== null) {
      imports.push(exported);
      return;
    }
    const loaded = dynamicImport(node, location);
    if (loaded !== null) imports.push(loaded);
    const scope = scopeOf(node, outer, types);
    if (ts.isIdentifier(node)) record(node, scope);
    ts.forEachChild(node, (child) => {
      visit(child, scope);
    });
  };
  visit(source, new Map());
  const allUses = [...uses.values()],
    allTypedUses = [...typedUses.values()];
  const importCount = imports.length;
  const slices = owners?.map(({ node, ...owner }) => {
    uses = new Map();
    typedUses = new Map();
    visit(node, new Map());
    return {
      ...owner,
      uses: [...uses.values()],
      typedUses: [...typedUses.values()],
      loads: imports.splice(importCount),
    };
  });
  return {
    imports,
    uses: allUses,
    typedUses: allTypedUses,
    literalExports: source.statements.flatMap(literalExports),
    namedBarrel: source.statements.every(namedBarrelStatement),
    slices: slices ?? null,
  };
}
