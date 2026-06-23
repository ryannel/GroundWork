#!/usr/bin/env node
// Build the tree-sitter grammar wasm bundled with the repo-map generator.
//
// The runtime (`npx groundwork-method repo-map`) loads these wasm files with
// web-tree-sitter and must work with zero build toolchain on the user's machine,
// so the grammars are vendored into `lib/repo-map/grammars/` and shipped in the
// npm package. This script regenerates them from pinned grammar sources (declared
// as devDependencies) using the tree-sitter CLI, which compiles each grammar to
// wasm via a self-contained wasi-sdk (auto-downloaded and cached — no Docker, no
// system emscripten).
//
// Run after bumping web-tree-sitter or any tree-sitter-* devDependency:
//   npm run build:grammars
//
// IMPORTANT: the tree-sitter CLI version must match the web-tree-sitter runtime
// version (both pinned in package.json) — they share the wasm/ABI format. Each
// built grammar's queries are validated by tests/cli/test_repo_map.py; a grammar
// source bump can shift node types, so run `./dev test cli` afterwards.

import { execFileSync } from 'node:child_process';
import { mkdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'lib', 'repo-map', 'grammars');
const NM = path.join(ROOT, 'node_modules');

// output id → grammar source directory (relative to node_modules).
// Subdir entries (typescript/tsx, php) point at the specific grammar within a
// multi-grammar package. Keep this list in sync with the registry in
// lib/repo-map/languages.js.
const GRAMMARS = {
  go: 'tree-sitter-go',
  python: 'tree-sitter-python',
  javascript: 'tree-sitter-javascript',
  typescript: 'tree-sitter-typescript/typescript',
  tsx: 'tree-sitter-typescript/tsx',
  java: 'tree-sitter-java',
  rust: 'tree-sitter-rust',
  csharp: 'tree-sitter-c-sharp',
  cpp: 'tree-sitter-cpp',
  c: 'tree-sitter-c',
  scala: 'tree-sitter-scala',
  swift: 'tree-sitter-swift',
  php: 'tree-sitter-php/php',
  ruby: 'tree-sitter-ruby',
  kotlin: '@tree-sitter-grammars/tree-sitter-kotlin',
  lua: '@tree-sitter-grammars/tree-sitter-lua',
  dart: 'tree-sitter-dart',
};

mkdirSync(OUT, { recursive: true });

const cli = path.join(NM, '.bin', 'tree-sitter');
let ok = 0;
const failures = [];

for (const [id, src] of Object.entries(GRAMMARS)) {
  const out = path.join(OUT, `tree-sitter-${id}.wasm`);
  const srcDir = path.join(NM, src);
  try {
    execFileSync(cli, ['build', '--wasm', srcDir, '-o', out], { stdio: 'pipe' });
    const kb = Math.round(statSync(out).size / 1024);
    console.log(`  ✓ ${id.padEnd(12)} ${kb} KB`);
    ok++;
  } catch (err) {
    const msg = (err.stderr ? err.stderr.toString() : err.message).trim().split('\n').pop();
    console.error(`  ✗ ${id.padEnd(12)} ${msg}`);
    failures.push(id);
  }
}

console.log(`\n${ok}/${Object.keys(GRAMMARS).length} grammars built into lib/repo-map/grammars/`);
if (failures.length) {
  console.error(`Failed: ${failures.join(', ')}`);
  process.exit(1);
}
