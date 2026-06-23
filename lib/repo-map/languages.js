'use strict';

// Language registry for the repo-map generator.
//
// Each entry binds a tree-sitter grammar (vendored as wasm under ./grammars/ by
// scripts/build-grammars.mjs, or supplied by the project — see "Project extension
// seam" below) to the queries
// that extract two things from a parsed file: the raw import strings (which the
// resolver turns into the internal dependency graph) and the top-level symbol
// definitions (the informational symbol index).
//
// A language declares a **fidelity**:
//   'graph'   — has a resolver, so its imports become internal edges and feed
//               PageRank centrality. This is the output people trust most, so a
//               resolver ships only when its module-resolution rules are verified
//               correct for that ecosystem.
//   'symbols' — has queries but no resolver: it yields a symbol index, an
//               external-dependency listing, and module shape, but no internal
//               edges. Honest partial coverage, never a confidently-wrong graph.
//
// This is deliberately coarse: import-edge granularity, not a full reference
// graph. Serena answers precise per-symbol questions live; this map exists for
// whole-repo aggregates (centrality, module shape) that Serena cannot export.
//
// ── Adding a language ────────────────────────────────────────────────────────
// Most projects never need to: the built-ins below cover the common stacks, and
// a project can add its own without forking GroundWork via the extension seam
// (`.groundwork/config/repo-map.languages.js` — see loadProjectLanguages). A new
// built-in is the same object shape: extensions, a grammar, an `@imp` import
// query, a `@sym` symbol query, and (for 'graph' fidelity) a `resolve` function.

const path = require('path');
const fs = require('fs');

// Where the bundled tree-sitter grammars live. These are vendored into the
// package (built by scripts/build-grammars.mjs for the pinned web-tree-sitter
// version) so the runtime needs no build toolchain — see that script's header.
function bundledWasmDir() {
  return path.join(__dirname, 'grammars');
}

function stripQuotes(s) {
  return s.replace(/^['"`]|['"`]$/g, '');
}

// ── Resolvers ────────────────────────────────────────────────────────────────
// resolve(spec, fromFile, fileSet, ctx) → [internal repo-relative paths] | null
//   spec      the import string, quotes already stripped
//   fromFile  repo-relative path of the importing file (posix separators)
//   fileSet   Set of all repo-relative source paths (posix separators)
//   ctx       { goModule } — extra repo facts a resolver may need
// Returning null means "external" (third-party, stdlib, or unresolvable): the
// import is recorded under external_dependencies, never as an internal edge.

const JSTS_RESOLVE_EXTS = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'];
function jstsCandidates(base) {
  const out = [base];
  for (const e of JSTS_RESOLVE_EXTS) out.push(base + e);
  for (const e of JSTS_RESOLVE_EXTS) out.push(path.posix.join(base, 'index' + e));
  return out;
}

function resolveGo(spec, fromFile, fileSet, ctx) {
  const goModule = ctx.goModule;
  // Internal only when the import path sits under the module path.
  if (!goModule || !(spec === goModule || spec.startsWith(goModule + '/'))) return null;
  const rel = spec === goModule ? '.' : spec.slice(goModule.length + 1);
  // Go imports a package (directory); the targets are its .go files.
  const targets = [...fileSet].filter(
    (f) => f.endsWith('.go') && path.posix.dirname(f) === path.posix.normalize(rel)
  );
  return targets.length ? targets : null;
}

function resolvePython(spec, fromFile, fileSet) {
  const fromDir = path.posix.dirname(fromFile);
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

function resolveJsTs(spec, fromFile, fileSet) {
  // Only relative specifiers are internal; bare specifiers are packages.
  if (!spec.startsWith('.')) return null;
  const fromDir = path.posix.dirname(fromFile);
  const joined = path.posix.normalize(path.posix.join(fromDir, spec));
  for (const cand of jstsCandidates(joined)) {
    if (fileSet.has(cand)) return [cand];
  }
  return null;
}

// Dart: a `package:<self>/x/y.dart` import (where <self> is the project's own
// package, read from pubspec.yaml) maps to `lib/x/y.dart`; a relative import
// resolves against the importing file's directory. Imports of other packages
// (`package:flutter/...`) and `dart:` core libraries find no internal match and
// fall through to external.
function resolveDart(spec, fromFile, fileSet, ctx) {
  const m = spec.match(/^package:([^/]+)\/(.+)$/);
  if (m) {
    // Self-package import → lib/. Other packages are external.
    if (ctx.dartPackage && m[1] === ctx.dartPackage) {
      const target = path.posix.normalize('lib/' + m[2]);
      return fileSet.has(target) ? [target] : null;
    }
    return null;
  }
  if (spec.startsWith('dart:')) return null; // SDK library
  // Any other (schemeless) URI is relative to the importing file's directory —
  // covers `models/user.dart`, `./util.dart`, and `../shared/x.dart` alike.
  const joined = path.posix.normalize(path.posix.join(path.posix.dirname(fromFile), spec));
  return fileSet.has(joined) ? [joined] : null;
}

// Java: an import is a fully-qualified type name (`com.example.app.util.Helper`).
// By the language's near-universal convention the file path mirrors the package,
// so the type lives at `<source-root>/com/example/app/util/Helper.java`. We match
// any internal file whose path ends with that package-path suffix. Stdlib and
// third-party imports (java.*, com.google.*, …) simply find no internal match and
// fall through to external — exactly what we want.
function resolveJava(spec, fromFile, fileSet) {
  if (spec.endsWith('.*')) return null; // wildcard import — a package, not a file
  const suffix = '/' + spec.split('.').join('/') + '.java';
  const targets = [...fileSet].filter((f) => f.endsWith(suffix) || f === suffix.slice(1));
  return targets.length ? targets : null;
}

// ── Built-in language registry ───────────────────────────────────────────────
// Import-query capture name is always @imp (its node text is the raw module
// string); symbol-query capture name is always @sym. Queries are validated
// against the real grammars in tests/cli/test_repo_map.py.

const ESMODULE_IMPORT = `[
  (import_statement source: (string) @imp)
  (export_statement source: (string) @imp)
]`;
const JSTS_SYMBOLS = `[
  (function_declaration name: (identifier) @sym)
  (class_declaration name: (_) @sym)
]`;

const BUILTIN = [
  {
    id: 'go',
    exts: ['.go'],
    grammar: 'tree-sitter-go.wasm',
    fidelity: 'graph',
    importQuery: '(import_spec path: (interpreted_string_literal) @imp)',
    symbolQuery: `[
      (function_declaration name: (identifier) @sym)
      (method_declaration name: (field_identifier) @sym)
      (type_spec name: (type_identifier) @sym)
    ]`,
    resolve: resolveGo,
  },
  {
    id: 'python',
    exts: ['.py'],
    grammar: 'tree-sitter-python.wasm',
    fidelity: 'graph',
    importQuery: `[
      (import_statement (dotted_name) @imp)
      (import_statement (aliased_import (dotted_name) @imp))
      (import_from_statement module_name: (dotted_name) @imp)
      (import_from_statement module_name: (relative_import) @imp)
    ]`,
    symbolQuery: `[
      (function_definition name: (identifier) @sym)
      (class_definition name: (identifier) @sym)
    ]`,
    resolve: resolvePython,
  },
  {
    id: 'typescript',
    exts: ['.ts'],
    grammar: 'tree-sitter-typescript.wasm',
    fidelity: 'graph',
    importQuery: ESMODULE_IMPORT, // require()/dynamic import() are a known v1 gap
    symbolQuery: JSTS_SYMBOLS,
    resolve: resolveJsTs,
  },
  {
    id: 'tsx',
    exts: ['.tsx'],
    grammar: 'tree-sitter-tsx.wasm',
    fidelity: 'graph',
    importQuery: ESMODULE_IMPORT,
    symbolQuery: JSTS_SYMBOLS,
    resolve: resolveJsTs,
  },
  {
    id: 'javascript',
    exts: ['.js', '.jsx', '.mjs', '.cjs'],
    grammar: 'tree-sitter-javascript.wasm',
    fidelity: 'graph',
    importQuery: ESMODULE_IMPORT,
    symbolQuery: JSTS_SYMBOLS,
    resolve: resolveJsTs,
  },
  {
    id: 'java',
    exts: ['.java'],
    grammar: 'tree-sitter-java.wasm',
    fidelity: 'graph',
    importQuery: '(import_declaration (scoped_identifier) @imp)',
    symbolQuery: `[
      (class_declaration name: (identifier) @sym)
      (interface_declaration name: (identifier) @sym)
      (enum_declaration name: (identifier) @sym)
      (record_declaration name: (identifier) @sym)
    ]`,
    resolve: resolveJava,
  },
  {
    id: 'dart',
    exts: ['.dart'],
    grammar: 'tree-sitter-dart.wasm',
    fidelity: 'graph',
    importQuery:
      '(import_or_export (library_import (import_specification (configurable_uri (uri (string_literal) @imp)))))',
    symbolQuery: `[
      (class_definition name: (identifier) @sym)
      (mixin_declaration (identifier) @sym)
      (enum_declaration name: (identifier) @sym)
      (function_signature name: (identifier) @sym)
    ]`,
    resolve: resolveDart,
  },

  // ── Symbols tier: queries verified, no internal-edge resolver (yet). ────────
  {
    id: 'rust',
    exts: ['.rs'],
    grammar: 'tree-sitter-rust.wasm',
    fidelity: 'symbols',
    importQuery:
      '(use_declaration argument: [(scoped_identifier) (scoped_use_list) (use_as_clause) (identifier)] @imp)',
    symbolQuery: `[
      (function_item name: (identifier) @sym)
      (struct_item name: (type_identifier) @sym)
      (enum_item name: (type_identifier) @sym)
      (trait_item name: (type_identifier) @sym)
      (mod_item name: (identifier) @sym)
    ]`,
  },
  {
    id: 'kotlin',
    exts: ['.kt', '.kts'],
    grammar: 'tree-sitter-kotlin.wasm',
    fidelity: 'symbols',
    importQuery: '(import (qualified_identifier) @imp)',
    symbolQuery: `[
      (class_declaration name: (identifier) @sym)
      (function_declaration name: (identifier) @sym)
      (object_declaration name: (identifier) @sym)
    ]`,
  },
  {
    id: 'csharp',
    exts: ['.cs'],
    grammar: 'tree-sitter-csharp.wasm',
    fidelity: 'symbols',
    importQuery: '(using_directive [(qualified_name) (identifier)] @imp)',
    symbolQuery: `[
      (class_declaration name: (identifier) @sym)
      (interface_declaration name: (identifier) @sym)
      (struct_declaration name: (identifier) @sym)
      (enum_declaration name: (identifier) @sym)
      (record_declaration name: (identifier) @sym)
    ]`,
  },
  {
    id: 'cpp',
    exts: ['.cpp', '.cc', '.cxx', '.hpp', '.hh', '.hxx'],
    grammar: 'tree-sitter-cpp.wasm',
    fidelity: 'symbols',
    importQuery: '(preproc_include path: [(system_lib_string) (string_literal)] @imp)',
    symbolQuery: `[
      (class_specifier name: (type_identifier) @sym)
      (struct_specifier name: (type_identifier) @sym)
      (function_definition declarator: (function_declarator declarator: (identifier) @sym))
    ]`,
  },
  {
    id: 'c',
    exts: ['.c', '.h'],
    grammar: 'tree-sitter-c.wasm',
    fidelity: 'symbols',
    importQuery: '(preproc_include path: [(system_lib_string) (string_literal)] @imp)',
    symbolQuery: `[
      (struct_specifier name: (type_identifier) @sym)
      (function_definition declarator: (function_declarator declarator: (identifier) @sym))
    ]`,
  },
  {
    // Scala imports split into multiple `path:` fields (no single node holds the
    // dotted path), so we extract symbols only rather than capture a fragment.
    id: 'scala',
    exts: ['.scala', '.sc'],
    grammar: 'tree-sitter-scala.wasm',
    fidelity: 'symbols',
    symbolQuery: `[
      (class_definition name: (identifier) @sym)
      (object_definition name: (identifier) @sym)
      (trait_definition name: (identifier) @sym)
      (function_definition name: (identifier) @sym)
    ]`,
  },
  {
    id: 'swift',
    exts: ['.swift'],
    grammar: 'tree-sitter-swift.wasm',
    fidelity: 'symbols',
    importQuery: '(import_declaration (identifier) @imp)',
    symbolQuery: `[
      (class_declaration name: (type_identifier) @sym)
      (protocol_declaration name: (type_identifier) @sym)
      (function_declaration name: (simple_identifier) @sym)
    ]`,
  },
  {
    id: 'php',
    exts: ['.php'],
    grammar: 'tree-sitter-php.wasm',
    fidelity: 'symbols',
    importQuery: '(namespace_use_declaration (namespace_use_clause (qualified_name) @imp))',
    symbolQuery: `[
      (class_declaration name: (name) @sym)
      (interface_declaration name: (name) @sym)
      (trait_declaration name: (name) @sym)
      (function_definition name: (name) @sym)
    ]`,
  },
  {
    // Ruby imports go through require/require_relative calls, which are
    // indistinguishable from any other method call without predicate filtering
    // the flat-capture engine does not apply — so we extract symbols only rather
    // than pollute external_dependencies with arbitrary string arguments.
    id: 'ruby',
    exts: ['.rb'],
    grammar: 'tree-sitter-ruby.wasm',
    fidelity: 'symbols',
    symbolQuery: `[
      (class name: (constant) @sym)
      (module name: (constant) @sym)
      (method name: (identifier) @sym)
    ]`,
  },
  {
    id: 'lua',
    exts: ['.lua'],
    grammar: 'tree-sitter-lua.wasm',
    fidelity: 'symbols',
    symbolQuery: '(function_declaration name: (identifier) @sym)',
  },
];

// Common code languages that are NOT built in — used only to nudge the user
// toward the enablement path when their repo contains such files. `reason`
// explains why it is not built in (so the message is honest, not a shrug).
const NUDGE = {
  '.ex': { lang: 'Elixir', reason: 'no built-in queries yet' },
  '.exs': { lang: 'Elixir', reason: 'no built-in queries yet' },
  '.zig': { lang: 'Zig', reason: 'no built-in queries yet' },
  '.sol': { lang: 'Solidity', reason: 'no built-in queries yet' },
};

// ── Registry state (rebuilt per CLI invocation) ──────────────────────────────

let registry; // id → definition
let extToLang; // extension → id

function addToRegistry(def) {
  registry.set(def.id, def);
  for (const ext of def.exts) extToLang.set(ext.toLowerCase(), def.id);
}

function resetRegistry() {
  registry = new Map();
  extToLang = new Map();
  for (const def of BUILTIN) addToRegistry(def);
}

resetRegistry();

// ── Project extension seam ───────────────────────────────────────────────────
// A project enables a language repo-map does not cover — or overrides a built-in
// — by committing `.groundwork/config/repo-map.languages.js` that exports an
// array of definitions (or `{ languages: [...] }`). Each entry mirrors a built-in:
//
//   module.exports = [{
//     id: 'dart',
//     extensions: ['.dart'],
//     grammar: 'tree-sitter-dart.wasm',     // a bundled grammar by name, OR…
//     grammarPath: './grammars/my.wasm',    // …a path (relative to repo root) to your own
//     importQuery: "(import_or_export ... @imp)",
//     symbolQuery: "(class_definition name: (identifier) @sym)",
//     resolve(spec, fromFile, files) { return [...] | null }  // optional: enables edges
//   }]
//
// An entry whose extensions collide with a built-in replaces it (lets a project
// upgrade a resolver or swap in an ABI-compatible grammar). This executes
// project-supplied JS — by design: it is the project's own committed config,
// loaded only from within the repo being mapped.

function loadProjectLanguages(cwd) {
  const cfg = path.join(cwd, '.groundwork', 'config', 'repo-map.languages.js');
  if (!fs.existsSync(cfg)) return { loaded: [], errors: [] };
  let raw;
  try {
    delete require.cache[require.resolve(cfg)];
    raw = require(cfg);
  } catch (err) {
    return { loaded: [], errors: [`failed to load ${path.relative(cwd, cfg)}: ${err.message}`] };
  }
  const defs = Array.isArray(raw) ? raw : Array.isArray(raw && raw.languages) ? raw.languages : null;
  if (!defs) {
    return { loaded: [], errors: ['repo-map.languages.js must export an array or { languages: [...] }'] };
  }

  const loaded = [];
  const errors = [];
  defs.forEach((d, i) => {
    const where = d && d.id ? d.id : `entry ${i}`;
    if (!d || typeof d !== 'object') return errors.push(`${where}: not an object`);
    const exts = d.extensions || d.exts;
    if (!Array.isArray(exts) || !exts.length) return errors.push(`${where}: needs a non-empty extensions array`);
    if (!d.grammar && !d.grammarPath) return errors.push(`${where}: needs grammar or grammarPath`);
    if (d.resolve && typeof d.resolve !== 'function') return errors.push(`${where}: resolve must be a function`);
    const def = {
      id: d.id || exts[0].replace(/^\./, ''),
      exts: exts.map((e) => (e.startsWith('.') ? e : '.' + e).toLowerCase()),
      grammar: d.grammar,
      grammarPath: d.grammarPath ? path.resolve(cwd, d.grammarPath) : undefined,
      fidelity: d.resolve ? 'graph' : 'symbols',
      importQuery: d.importQuery,
      symbolQuery: d.symbolQuery,
      resolve: d.resolve,
      source: 'project',
    };
    addToRegistry(def);
    loaded.push(def.id);
  });
  return { loaded, errors };
}

// ── Lookups used by the engine ───────────────────────────────────────────────

function langForFile(relPath) {
  return extToLang.get(path.extname(relPath).toLowerCase()) || null;
}

function defFor(lang) {
  return registry.get(lang) || null;
}

// All extensions the registry currently maps (built-ins + project additions).
function sourceExtensions() {
  return [...extToLang.keys()];
}

// Absolute path to a language's grammar wasm (project-supplied path wins).
function grammarPathFor(lang) {
  const def = registry.get(lang);
  if (!def) return null;
  if (def.grammarPath) return def.grammarPath;
  return path.join(bundledWasmDir(), def.grammar);
}

function fidelityFor(lang) {
  const def = registry.get(lang);
  return def ? def.fidelity : null;
}

// Resolve a raw import to internal repo-relative path(s), or null when external.
function resolveImport(lang, fromFile, raw, fileSet, ctx) {
  const def = registry.get(lang);
  if (!def || !def.resolve) return null;
  return def.resolve(stripQuotes(raw), fromFile, fileSet, ctx || {});
}

// Code files of a language we do not map — for the enablement nudge.
function nudgeFor(ext) {
  return NUDGE[ext.toLowerCase()] || null;
}

module.exports = {
  stripQuotes,
  resetRegistry,
  loadProjectLanguages,
  langForFile,
  defFor,
  sourceExtensions,
  grammarPathFor,
  fidelityFor,
  resolveImport,
  nudgeFor,
  NUDGE,
};
