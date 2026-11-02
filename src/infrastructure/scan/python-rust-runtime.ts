import 'server-only';

import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

import type { SourceInput } from './source-index-types';

export function pythonRustExecutable(): string {
  const selected = ['/usr/local/bin/python3', '/opt/homebrew/bin/python3', '/usr/bin/python3'].find(
    existsSync,
  );
  if (selected === undefined) throw new Error('Python 3 is unavailable');
  return selected;
}
function adapter(input: SourceInput): string {
  return path.resolve(input.adapterDirectory ?? 'tools/scan-adapters', 'source-python-rust.py');
}
/** The interpreter runs Groundwork's parser, never target modules or a Cargo build. */
export function pythonRustOutput(input: SourceInput): string {
  if (input.language === 'rust') rustPackageFiles();
  return execFileSync(pythonRustExecutable(), [adapter(input)], {
    input: JSON.stringify({ language: input.language, content: input.content }),
    env: {
      NODE_ENV: 'production',
      PYTHONPATH: path.resolve('node_modules/.cache/groundwork/python-tree-sitter'),
    },
    encoding: 'utf8',
    timeout: 60_000,
    maxBuffer: 32 * 1024 * 1024,
    stdio: ['pipe', 'pipe', 'pipe'],
  });
}
function rustPackageFiles(): readonly string[] {
  const root = path.resolve('node_modules/.cache/groundwork/python-tree-sitter');
  return ['tree_sitter', 'tree_sitter_rust'].flatMap((name) => {
    const directory = path.join(root, name);
    if (!existsSync(directory)) {
      throw new Error(
        'Rust parser wheels are unavailable. Run: node --import ./tools/register.ts --conditions=react-server tools/scan-python-rust-setup.ts',
      );
    }
    const bindings = readdirSync(directory).filter(
      (file) => file.endsWith('.so') || file.endsWith('.pyd'),
    );
    if (bindings.length !== 1) {
      throw new Error('Rust parser binding is incomplete; rerun tools/scan-python-rust-setup.ts');
    }
    return [
      path.join(directory, '__init__.py'),
      ...bindings.map((file) => path.join(directory, file)),
    ];
  });
}
export function pythonRustIdentity(input: SourceInput): string {
  const runtime = execFileSync(pythonRustExecutable(), ['--version'], {
    encoding: 'utf8',
    timeout: 10_000,
  });
  const files = [adapter(input)];
  if (input.language === 'rust') files.push(...rustPackageFiles());
  const digest = createHash('sha256');
  for (const file of files) digest.update(readFileSync(file));
  return `${input.language}:${runtime.trim()}:${digest.digest('hex')}`;
}
