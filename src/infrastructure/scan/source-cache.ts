import 'server-only';

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';

import ts from 'typescript';

import { csharpParserIdentity } from './csharp-runtime';
import { javaExecutable } from './java-runtime';
import { pythonRustIdentity } from './python-rust-runtime';
import { indexSource, sourceDigest } from './source-index';
import type { SourceIndex, SourceInput } from './source-index-types';

export interface IndexStats {
  readonly reads: number;
  readonly parses: number;
  readonly hits: number;
  readonly bytesRead: number;
}
export interface IndexCache {
  readonly index: (input: SourceInput) => SourceIndex;
  readonly stats: () => IndexStats;
}

function nativeVersion(input: SourceInput) {
  const go = input.language === 'go';
  const command = go ? (input.go ?? 'go') : javaExecutable(input.java);
  try {
    const output = execFileSync(command, go ? ['version'] : ['--version'], {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 10_000,
    });
    return `${command}:${output.trim()}`;
  } catch {
    return `${command}:unavailable`;
  }
}

export function parserIdentity(input: SourceInput): string {
  if (input.language === 'typescript' || input.language === 'javascript') {
    const adapters = [
      'typescript-index.ts',
      'typescript-fields.ts',
      'typescript-binding.ts',
      'typescript-semantic-fields.ts',
    ];
    const digest = sourceDigest(
      adapters.map((file) => readFileSync(new URL(file, import.meta.url), 'utf8')).join('\n'),
    );
    return `typescript/${ts.version}:${digest}`;
  }
  if (input.language === 'python' || input.language === 'rust') return pythonRustIdentity(input);
  if (input.language === 'csharp') {
    return csharpParserIdentity(input.adapterDirectory ?? 'tools/scan-adapters');
  }
  const adapter = input.language === 'go' ? 'source.go' : 'SourceIndex.java';
  const content = readFileSync(
    path.resolve(input.adapterDirectory ?? 'tools/scan-adapters', adapter),
    'utf8',
  );
  return `${nativeVersion(input)}:${sourceDigest(content)}`;
}

/** A cache is bound to one authorised publication scope, never shared across workspaces. */
export function createIndexCache(scope: string): IndexCache {
  const entries = new Map<string, SourceIndex>();
  const counters = { reads: 0, parses: 0, hits: 0, bytesRead: 0 };
  return {
    index(input) {
      counters.reads += 1;
      counters.bytesRead += Buffer.byteLength(input.content);
      const parser = parserIdentity(input);
      const key = sourceDigest(
        JSON.stringify([
          scope,
          input.path,
          sourceDigest(input.content),
          input.language,
          parser,
          'compiler-fields/v2',
        ]),
      );
      const cached = entries.get(key);
      if (cached) {
        counters.hits += 1;
        return structuredClone(cached);
      }
      const indexed = indexSource(input);
      counters.parses += 1;
      if (indexed.nodes.length > 0) entries.set(key, indexed);
      return structuredClone(indexed);
    },
    stats: () => ({ ...counters }),
  };
}
