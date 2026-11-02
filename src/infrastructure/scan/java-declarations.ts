import 'server-only';

import { javaTypes } from './java-declaration-types';
import { syntaxIdentity } from './source-expressions';
import type { SourceIndex } from './source-index-types';

export interface JavaAnnotation {
  readonly name: string;
  readonly arguments: Readonly<Record<string, string>>;
  readonly source: string;
}
export interface JavaParameter {
  readonly name: string;
  readonly type: string;
  readonly annotations: readonly JavaAnnotation[];
  readonly source: string;
}
export interface JavaMethod {
  readonly name: string;
  readonly parameters: readonly JavaParameter[];
  readonly returnType: string;
  readonly annotations: readonly JavaAnnotation[];
  readonly source: string;
  readonly summary: string | null;
  readonly body: string | null;
  readonly calls?: readonly JavaInvocation[];
  readonly typeParameters?: readonly string[];
  readonly boundedTypeParameters?: readonly string[];
}
export interface JavaInvocation {
  readonly callee: string;
  readonly arguments: readonly string[];
  readonly source: string;
  readonly conditional: boolean;
}
export interface JavaField extends JavaParameter {
  readonly initializer: string | null;
  readonly modifiers: readonly string[];
}
export interface JavaType {
  readonly name: string;
  readonly qualifiedName: string;
  readonly extends: readonly string[];
  readonly implements: readonly string[];
  readonly annotations: readonly JavaAnnotation[];
  readonly methods: readonly JavaMethod[];
  readonly fields: readonly JavaField[];
  readonly source: string;
  readonly kind: 'class' | 'interface' | 'enum' | 'record';
  readonly enumValues: readonly string[];
  readonly typeParameters?: readonly string[];
}
export interface JavaUnit {
  readonly path: string;
  readonly packageName: string;
  readonly imports: readonly string[];
  readonly types: readonly JavaType[];
  readonly source: string;
}

/** A compact compiler projection; neither recovery trees nor tests establish framework bindings. */
export function javaDeclarations(index: SourceIndex): JavaUnit | null {
  if (index.language !== 'java' || index.diagnostics.length > 0) return null;
  const root = index.nodes[0];
  if (!root) return null;
  const span = root.fields?.packageName?.[0];
  const packageName = span ? index.content.slice(span[0], span[1]) : '';
  return {
    path: index.path,
    packageName,
    imports: index.nodes.filter((node) => node.kind === 'IMPORT').map((node) => node.symbol ?? ''),
    types: javaTypes(index, packageName),
    source: `source:${syntaxIdentity(index, root)}`,
  };
}

export function resolveJavaType(
  name: string,
  unit: Pick<JavaUnit, 'imports' | 'packageName'>,
): string {
  const simple = name.replace(/\.class$/u, '').trim();
  const first = simple.split('.')[0] ?? simple;
  const imported = unit.imports.find((entry) => entry.endsWith(`.${first}`));
  if (imported !== undefined) {
    return imported + simple.slice(first.length);
  }
  if (/^[a-z]/u.test(first) && simple.includes('.')) return simple;
  return unit.packageName === '' ? simple : `${unit.packageName}.${simple}`;
}
