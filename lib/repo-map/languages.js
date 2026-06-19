'use strict';

// Language configuration for the repo-map generator.
//
// Each entry maps a tree-sitter grammar (shipped as wasm by `tree-sitter-wasms`)
// to the queries that extract two things from a parsed file: the raw import
// strings (which resolve into the dependency graph) and the top-level symbol
// definitions (the informational symbol index). Resolution of an import string
// to an internal file is language-specific and lives in `resolveImport` below.
//
// This is deliberately coarse: import-edge granularity, not a full reference
// graph. Serena answers precise per-symbol questions live; this map exists for
// whole-repo aggregates (centrality, module shape) that Serena cannot export.

const path = require('path');

// extension → grammar key
const EXT_LANG = {
  '.go': 'go',
  '.py': 'python',
  '.ts': 'typescript',
  '.tsx': 'tsx',
  '.js': 'javascript',
  '.jsx': 'javascript',
  '.mjs': 'javascript',
  '.cjs': 'javascript',
};

// grammar key → wasm filename inside tree-sitter-wasms/out
const LANG_WASM = {
  go: 'tree-sitter-go.wasm',
  python: 'tree-sitter-python.wasm',
  typescript: 'tree-sitter-typescript.wasm',
  tsx: 'tree-sitter-tsx.wasm',
  javascript: 'tree-sitter-javascript.wasm',
};

// Import-extraction queries. Capture name is always @imp; the captured node text
// is the raw module string (quotes stripped downstream where present).
const IMPORT_QUERY = {
  go: '(import_spec path: (interpreted_string_literal) @imp)',
  python: `[
    (import_statement (dotted_name) @imp)
    (import_statement (aliased_import (dotted_name) @imp))
    (import_from_statement module_name: (dotted_name) @imp)
    (import_from_statement module_name: (relative_import) @imp)
  ]`,
  // ES-module imports/re-exports. require()/dynamic import() are a known v1 gap.
  esmodule: `[
    (import_statement source: (string) @imp)
    (export_statement source: (string) @imp)
  ]`,
};
IMPORT_QUERY.typescript = IMPORT_QUERY.esmodule;
IMPORT_QUERY.tsx = IMPORT_QUERY.esmodule;
IMPORT_QUERY.javascript = IMPORT_QUERY.esmodule;

// Top-level definition queries for the symbol index (best-effort, informational).
const SYMBOL_QUERY = {
  go: `[
    (function_declaration name: (identifier) @sym)
    (method_declaration name: (field_identifier) @sym)
    (type_spec name: (type_identifier) @sym)
  ]`,
  python: `[
    (function_definition name: (identifier) @sym)
    (class_definition name: (identifier) @sym)
  ]`,
  jsts: `[
    (function_declaration name: (identifier) @sym)
    (class_declaration name: (_) @sym)
  ]`,
};
SYMBOL_QUERY.typescript = SYMBOL_QUERY.jsts;
SYMBOL_QUERY.tsx = SYMBOL_QUERY.jsts;
SYMBOL_QUERY.javascript = SYMBOL_QUERY.jsts;

const SOURCE_EXTENSIONS = Object.keys(EXT_LANG);

function langForFile(relPath) {
  return EXT_LANG[path.extname(relPath).toLowerCase()] || null;
}

function stripQuotes(s) {
  return s.replace(/^['"`]|['"`]$/g, '');
}

// Candidate file paths a TS/JS specifier could resolve to.
const JSTS_RESOLVE_EXTS = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'];
function jstsCandidates(base) {
  const out = [base];
  for (const e of JSTS_RESOLVE_EXTS) out.push(base + e);
  for (const e of JSTS_RESOLVE_EXTS) out.push(path.posix.join(base, 'index' + e));
  return out;
}

// Resolve a raw import string to an internal repo-relative file path, or null
// when it is external (a third-party package, the stdlib, or unresolvable).
//
//   fromFile  repo-relative path of the importing file (posix separators)
//   raw       captured import text (may include quotes)
//   fileSet   Set of all repo-relative source paths (posix separators)
//   goModule  the `module` path from go.mod, or null
function resolveImport(lang, fromFile, raw, fileSet, goModule) {
  const spec = stripQuotes(raw);
  const fromDir = path.posix.dirname(fromFile);

  if (lang === 'go') {
    // Internal only when the import path sits under the module path.
    if (!goModule || !(spec === goModule || spec.startsWith(goModule + '/'))) return null;
    const rel = spec === goModule ? '.' : spec.slice(goModule.length + 1);
    // Go imports a package (directory); the targets are its .go files.
    const targets = [...fileSet].filter(
      (f) => f.endsWith('.go') && path.posix.dirname(f) === path.posix.normalize(rel)
    );
    return targets.length ? targets : null;
  }

  if (lang === 'python') {
    let dotted = spec;
    let baseDir = '';
    const lead = spec.match(/^\.+/);
    if (lead) {
      // Relative import: each dot after the first walks up one package level.
      const up = lead[0].length - 1;
      let dir = fromDir;
      for (let i = 0; i < up; i++) dir = path.posix.dirname(dir);
      baseDir = dir;
      dotted = spec.slice(lead[0].length);
    }
    const sub = dotted ? dotted.split('.').join('/') : '';
    const stem = baseDir ? path.posix.join(baseDir, sub) : sub;
    for (const cand of [stem + '.py', path.posix.join(stem, '__init__.py')]) {
      const norm = path.posix.normalize(cand);
      if (fileSet.has(norm)) return [norm];
    }
    return null;
  }

  // TS / TSX / JS — only relative specifiers are internal.
  if (!spec.startsWith('.')) return null;
  const joined = path.posix.normalize(path.posix.join(fromDir, spec));
  for (const cand of jstsCandidates(joined)) {
    if (fileSet.has(cand)) return [cand];
  }
  return null;
}

module.exports = {
  EXT_LANG,
  LANG_WASM,
  IMPORT_QUERY,
  SYMBOL_QUERY,
  SOURCE_EXTENSIONS,
  langForFile,
  stripQuotes,
  resolveImport,
};
