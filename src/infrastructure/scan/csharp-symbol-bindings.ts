import 'server-only';

import { execFileSync } from 'node:child_process';

import { z } from 'zod';

import type { Contract, CsharpSymbolBinding } from '@/domain/scan/scan.generated';

import {
  csharpContractsSchema,
  csharpSignaturesSchema,
  declaredCsharpContracts,
  declaredCsharpSignatures,
  type CsharpMethodContracts,
} from './csharp-contract-schema';
import { csharpSource } from './csharp-declarations';
import { canonicalCsharpDiagnostics } from './csharp-diagnostics';
import { csharpAdapter } from './csharp-runtime';
import { sourceDigest } from './source-index';
import type { SourceIndex } from './source-index-types';

const anchor = z
  .object({
    path: z.string(),
    start: z.number().int().nonnegative(),
    end: z.number().int().nonnegative(),
  })
  .strict();
const result = z
  .object({
    contracts: csharpContractsSchema,
    signatures: csharpSignaturesSchema,
    bindings: z.array(
      z
        .object({
          relation: z.enum(['call_target', 'reaching_definition', 'implementation_candidate']),
          source: anchor,
          target: anchor.nullable(),
          owner: anchor.nullable(),
          symbol: z.string(),
          configurationSources: z.array(anchor),
          conditions: z.array(z.string()),
          dispatch: z.enum(['exact', 'external', 'polymorphic', 'unresolved']),
          boundary: z.enum(['http', 'storage', 'async', 'unclassified', 'unknown']),
          completion: z.enum(['awaited', 'returned', 'unobserved']),
          arguments: z.array(z.object({ source: anchor, parameter: anchor.nullable() }).strict()),
        })
        .strict(),
    ),
    diagnostics: z.array(z.string()),
  })
  .strict();
type Anchor = z.infer<typeof anchor>;

function sourceId(indexes: readonly SourceIndex[], location: Anchor | null): string | null {
  if (location === null) return null;
  const index = indexes.find((candidate) => candidate.path === location.path);
  const node = index?.nodes.find(
    (candidate) => candidate.start === location.start && candidate.end === location.end,
  );
  return index && node ? csharpSource(index, node) : null;
}

export interface CsharpProgramBindings {
  readonly bindings: readonly CsharpSymbolBinding[];
  readonly diagnostics: readonly string[];
  readonly contracts: readonly Contract[];
  readonly signatures: readonly CsharpMethodContracts[];
}

/** Binds selected source with Roslyn; missing packages and dispatch remain visible. */
export function collectCsharpSymbols(indexes: readonly SourceIndex[]): CsharpProgramBindings {
  const selected = indexes.filter(
    (index) => index.language === 'csharp' && index.diagnostics.length === 0,
  );
  if (selected.length === 0) {
    return { bindings: [], diagnostics: [], contracts: [], signatures: [] };
  }
  const [command, ...args] = csharpAdapter('tools/scan-adapters');
  if (command === undefined) throw new Error('Roslyn adapter executable is unavailable.');
  const output = execFileSync(command, [...args, '--bindings'], {
    input: JSON.stringify(selected.map((index) => ({ path: index.path, content: index.content }))),
    encoding: 'utf8',
    timeout: 60_000,
    maxBuffer: 64 * 1024 * 1024,
  });
  const parsed = result.parse(JSON.parse(output));
  const signatures = declaredCsharpSignatures(selected, parsed.signatures);
  return {
    signatures: signatures.signatures,
    diagnostics: canonicalCsharpDiagnostics(parsed.diagnostics),
    contracts: [...declaredCsharpContracts(selected, parsed.contracts), ...signatures.contracts],
    bindings: parsed.bindings.flatMap((binding) => {
      const source = sourceId(selected, binding.source);
      if (source === null) return [];
      return [
        {
          kind: 'csharp_symbol_binding',
          id: `csharp:binding:${sourceDigest(JSON.stringify(binding))}`,
          source,
          target: sourceId(selected, binding.target),
          owner: sourceId(selected, binding.owner),
          relation: binding.relation,
          symbol: binding.symbol,
          configurationSources: binding.configurationSources.flatMap((entry) => {
            const id = sourceId(selected, entry);
            return id === null ? [] : [id];
          }),
          conditions: binding.conditions,
          dispatch: binding.dispatch,
          boundary: binding.boundary,
          completion: binding.completion,
          arguments: binding.arguments.flatMap((argument) => {
            const id = sourceId(selected, argument.source);
            return id === null
              ? []
              : [{ source: id, parameter: sourceId(selected, argument.parameter) }];
          }),
          limitations: [
            'Source-only selected-file binding; package references and dependency injection are not resolved.',
            'Polymorphic declarations are not runtime implementations; source references do not establish reaching values after assignments.',
          ],
        },
      ];
    }),
  };
}
