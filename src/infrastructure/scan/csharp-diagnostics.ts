import 'server-only';

import type { Gap } from '@/domain/scan/scan.generated';

import { sourceDigest } from './source-index';

/** Compiler worker scheduling must not change diagnostics or publication identities. */
export function canonicalCsharpDiagnostics(diagnostics: readonly string[]): readonly string[] {
  return diagnostics.toSorted((left, right) => (left < right ? -1 : Number(left > right)));
}

/** Repeated identical errors remain in the raw list and identify one diagnostic fact here. */
export function csharpDiagnosticGaps(
  diagnostics: readonly string[],
  pin: { readonly repo: string; readonly commit: string },
): readonly Gap[] {
  return [...new Set(canonicalCsharpDiagnostics(diagnostics))].map((description) => ({
    kind: 'gap',
    id: `gap:csharp:compiler:${sourceDigest(JSON.stringify([pin.repo, pin.commit, description]))}`,
    reason: 'missing_dependency',
    description,
  }));
}
