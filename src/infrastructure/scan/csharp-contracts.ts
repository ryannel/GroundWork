import 'server-only';

import type { Contract } from '@/domain/scan/scan.generated';

import { collectCsharpSymbols } from './csharp-symbol-bindings';
import type { SourceIndex } from './source-index-types';

/** Symbol-resolved local DTO closure; external types and effective wire policy remain unresolved. */
export function collectCsharpContracts(indexes: readonly SourceIndex[]): readonly Contract[] {
  return collectCsharpSymbols(indexes).contracts;
}
