import 'server-only';

import type { SourceFrameworkBinding } from '@/domain/scan/scan.generated';

import { collectPythonFrameworkBindings } from './python-framework-bindings';
import { collectGrapheneBindings } from './python-graphene-bindings';
import { collectPolyglotSchemaBindings } from './python-rust-contracts';
import { collectRustFrameworkBindings } from './rust-framework-bindings';
import type { SourceIndex } from './source-index-types';

export function collectPythonRustFramework(
  indexes: readonly SourceIndex[],
): readonly SourceFrameworkBinding[] {
  return [
    ...collectPythonFrameworkBindings(indexes),
    ...collectGrapheneBindings(indexes),
    ...collectRustFrameworkBindings(indexes),
    ...collectPolyglotSchemaBindings(indexes),
  ];
}
