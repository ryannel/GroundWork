import 'server-only';

import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { csharpAdapter } from './csharp-runtime';
import { javaExecutable } from './java-runtime';
import { pythonRustOutput } from './python-rust-runtime';
import type { SourceIndex, SourceInput, SyntaxNode } from './source-index-types';
import { typescriptIndex } from './typescript-index';

interface NativeResult {
  readonly parser: string;
  readonly nodes: readonly SyntaxNode[];
  readonly diagnostics: readonly string[];
}

let goCache: string | undefined;

function goCacheDirectory(): string {
  goCache ??= mkdtempSync(path.join(tmpdir(), 'groundwork-parser-'));
  return goCache;
}

function nativeInvocation(input: SourceInput): readonly string[] {
  const directory = input.adapterDirectory ?? path.resolve('tools/scan-adapters');
  if (input.language === 'csharp') return csharpAdapter(directory);
  if (input.language === 'go') {
    return [input.go ?? 'go', 'run', path.resolve(directory, 'source.go')];
  }
  return [javaExecutable(input.java), path.resolve(directory, 'SourceIndex.java')];
}
function nativeOutput(input: SourceInput): string {
  if (input.language === 'python' || input.language === 'rust') return pythonRustOutput(input);
  const [command, ...args] = nativeInvocation(input);
  if (command === undefined) throw new Error('Missing native parser executable');
  const isGo = input.language === 'go';
  return execFileSync(command, args, {
    input: isGo ? JSON.stringify({ path: input.path, content: input.content }) : input.content,
    ...(isGo
      ? {
          env: {
            NODE_ENV: 'production',
            PATH: '/opt/homebrew/bin:/usr/bin:/bin',
            GOCACHE: goCacheDirectory(),
            GOPROXY: 'off',
            GOTOOLCHAIN: 'local',
            GOWORK: 'off',
            GO111MODULE: 'off',
          },
        }
      : {}),
    encoding: 'utf8',
    timeout: 60_000,
    maxBuffer: 32 * 1024 * 1024,
    stdio: ['pipe', 'pipe', 'pipe'],
  });
}
function nativeIndex(input: SourceInput): NativeResult {
  try {
    const result: unknown = JSON.parse(nativeOutput(input));
    if (!validNativeResult(result)) throw new Error('Malformed parser response');
    return result;
  } catch (error) {
    return {
      parser: `${input.language}/unavailable`,
      nodes: [],
      diagnostics: [error instanceof Error ? error.message : String(error)],
    };
  }
}

function validNativeResult(value: unknown): value is NativeResult {
  if (typeof value !== 'object' || value === null) return false;
  if (!('nodes' in value) || !Array.isArray(value.nodes)) return false;
  if (!value.nodes.every(validSyntaxNode)) return false;
  if (!('diagnostics' in value) || !Array.isArray(value.diagnostics)) return false;
  if (!value.diagnostics.every((entry: unknown) => typeof entry === 'string')) return false;
  return 'parser' in value && typeof value.parser === 'string';
}

export function sourceDigest(content: string): string {
  return createHash('sha256').update(content).digest('hex');
}

/** Parses precisely supplied bytes, without traversal, application builds or module loading. */
export function indexSource(input: SourceInput): SourceIndex {
  const syntax = ['typescript', 'javascript'].includes(input.language)
    ? typescriptIndex(input)
    : nativeIndex(input);
  return {
    path: input.path,
    language: input.language,
    digest: sourceDigest(input.content),
    content: input.content,
    attribution: 'parse_only',
    options: 'compiler-fields/v2',
    ...syntax,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function validSyntaxNode(value: unknown): value is SyntaxNode {
  if (!isRecord(value)) return false;
  if (!['kind', 'text'].every((key) => typeof value[key] === 'string')) return false;
  if (!['start', 'end'].every((key) => Number.isInteger(value[key]))) return false;
  const lines = value.lines;
  if (!Array.isArray(lines) || lines.length !== 2) return false;
  if (!lines.every((line: unknown) => Number.isInteger(line))) return false;
  if (!validOptionalFields(value)) return false;
  return value.parent === null || Number.isInteger(value.parent);
}

function validFields(value: unknown): boolean {
  if (!isRecord(value)) return false;
  return Object.values(value).every((spans: unknown) => {
    if (!Array.isArray(spans)) return false;
    return spans.every(
      (span: unknown) =>
        Array.isArray(span) &&
        span.length === 2 &&
        span.every((offset: unknown) => Number.isInteger(offset)),
    );
  });
}

function validOptionalFields(value: Readonly<Record<string, unknown>>): boolean {
  if ('modifiers' in value && !validModifiers(value.modifiers)) return false;
  if (!['symbol', 'operator'].every((key) => !(key in value) || typeof value[key] === 'string')) {
    return false;
  }
  if ('binding' in value && !Number.isInteger(value.binding)) return false;
  if ('literalValue' in value && !validLiteral(value.literalValue)) return false;
  if ('optionalAccess' in value && typeof value.optionalAccess !== 'boolean') return false;
  return !('fields' in value) || validFields(value.fields);
}

function validModifiers(value: unknown): boolean {
  return Array.isArray(value) && value.every((entry: unknown) => typeof entry === 'string');
}

function validLiteral(value: unknown): boolean {
  return value === null || ['string', 'number', 'boolean'].includes(typeof value);
}
