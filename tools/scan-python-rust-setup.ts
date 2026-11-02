import { execFileSync } from 'node:child_process';
import path from 'node:path';

import { pythonRustExecutable } from '@/infrastructure/scan/python-rust-runtime';
import { parserIdentity } from '@/infrastructure/scan/source-cache';
import { indexSource } from '@/infrastructure/scan/source-index';

/** Installs parser wheels only; no target application dependencies or Cargo builds. */
export function setupPythonRustParser(): void {
  execFileSync(
    pythonRustExecutable(),
    [
      '-m',
      'pip',
      'install',
      '--only-binary=:all:',
      '--no-cache-dir',
      '--upgrade',
      '--target',
      path.resolve('node_modules/.cache/groundwork/python-tree-sitter'),
      'tree-sitter==0.25.2',
      'tree-sitter-rust==0.24.0',
    ],
    { stdio: 'inherit', timeout: 60_000 },
  );
}
function checkParsers(): void {
  for (const language of ['python', 'rust'] as const) {
    const input = {
      path: language === 'python' ? 'check.py' : 'check.rs',
      language,
      content:
        language === 'python'
          ? 'def check(value): return value + 1\n'
          : 'fn check(value:i32)->i32 { return value + 1; }',
    };
    const index = indexSource(input);
    if (index.diagnostics.length > 0) throw new Error(index.diagnostics.join('\n'));
    console.log(
      JSON.stringify({
        language,
        parser: index.parser,
        fingerprint: parserIdentity(input),
        status: 'synthetic_parse_verified',
      }),
    );
  }
}
if (process.argv[1] === import.meta.filename) {
  const flags = process.argv.slice(2);
  if (flags.length === 1 && flags[0] === '--check') checkParsers();
  else if (flags.length === 0) setupPythonRustParser();
  else throw new Error('Usage: scan-python-rust-setup.ts [--check]');
}
