'use strict';

// The deterministic repo-map generator: parse the tracked source tree with
// tree-sitter, resolve import edges, rank files by PageRank centrality, and emit
// `.groundwork/cache/repo-map.json`. A per-file parse cache keyed by content
// hash makes every run after the first incremental — only changed files are
// reparsed — which is what makes automatic refresh cheap enough to be worth it.

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');

const langs = require('./languages');
const { langForFile, stripQuotes, resolveImport } = langs;
const { pagerank } = require('./pagerank');
const manifests = require('./manifests');

const SCHEMA_VERSION = 2;

function sha256(buf) {
  return crypto.createHash('sha256').update(buf).digest('hex');
}

function gitOutput(args, cwd) {
  return execFileSync('git', args, { cwd, encoding: 'utf8' });
}

function isGitRepo(cwd) {
  try {
    execFileSync('git', ['rev-parse', '--git-dir'], { cwd, stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function headCommit(cwd) {
  try {
    return gitOutput(['rev-parse', 'HEAD'], cwd).trim();
  } catch {
    return null;
  }
}

// All tracked files (posix paths). Falls back to a filtered walk outside git.
function listRepoFiles(cwd) {
  if (isGitRepo(cwd)) {
    return gitOutput(['ls-files'], cwd).split('\n').map((s) => s.trim()).filter(Boolean);
  }
  const SKIP = new Set(['.git', 'node_modules', 'dist', 'build', 'vendor', '.groundwork', '.claude']);
  const out = [];
  (function walk(dir, rel) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.name.startsWith('.') && entry.name !== '.') {
        if (SKIP.has(entry.name)) continue;
      }
      if (SKIP.has(entry.name)) continue;
      const abs = path.join(dir, entry.name);
      const r = rel ? `${rel}/${entry.name}` : entry.name;
      if (entry.isDirectory()) walk(abs, r);
      else if (entry.isFile()) out.push(r);
    }
  })(cwd, '');
  return out;
}

function goModulePath(cwd) {
  const goMod = path.join(cwd, 'go.mod');
  if (!fs.existsSync(goMod)) return null;
  const m = fs.readFileSync(goMod, 'utf8').match(/^\s*module\s+(\S+)/m);
  return m ? m[1] : null;
}

// The project's own Dart package name (pubspec.yaml `name:`), so the Dart
// resolver can map `package:<self>/x` → `lib/x`. Null when there is no pubspec.
function dartPackageName(cwd) {
  const pubspec = path.join(cwd, 'pubspec.yaml');
  if (!fs.existsSync(pubspec)) return null;
  const m = fs.readFileSync(pubspec, 'utf8').match(/^\s*name\s*:\s*(\S+)/m);
  return m ? m[1] : null;
}

const CONTRACT_NAME = /(openapi|swagger|asyncapi)/i;
function isContractFile(rel) {
  const ext = path.extname(rel).toLowerCase();
  if (ext === '.proto' || ext === '.graphql') return true;
  if (['.yaml', '.yml', '.json'].includes(ext) && CONTRACT_NAME.test(path.basename(rel))) return true;
  return false;
}

// ── tree-sitter engine (lazy, cached per grammar) ───────────────────────────

let TS = null; // the web-tree-sitter module: { Parser, Language, Query }
const languageCache = new Map(); // lang → { language, importQuery, symbolQuery } | { error }

// Load a grammar and compile its queries. A grammar can fail to load — most
// often a project-supplied wasm that does not exist or an ABI mismatch (the wasm
// was built for a different web-tree-sitter than the one installed). We cache the
// failure and let the caller degrade: that language is skipped and reported,
// never a crash. Queries are optional — a 'symbols' language may have no import
// query, and some have no symbol query.
async function getLanguage(lang) {
  if (languageCache.has(lang)) return languageCache.get(lang);
  let entry;
  try {
    if (!TS) {
      TS = require('web-tree-sitter');
      await TS.Parser.init();
    }
    const def = langs.defFor(lang);
    const language = await TS.Language.load(langs.grammarPathFor(lang));
    entry = {
      language,
      importQuery: def.importQuery ? new TS.Query(language, def.importQuery) : null,
      symbolQuery: def.symbolQuery ? new TS.Query(language, def.symbolQuery) : null,
    };
  } catch (err) {
    entry = { error: err.message };
  }
  languageCache.set(lang, entry);
  return entry;
}

// parseFile → { imports, symbols } | { error }
async function parseFile(lang, source) {
  const entry = await getLanguage(lang);
  if (entry.error) return { error: entry.error };
  const { language, importQuery, symbolQuery } = entry;
  const parser = new TS.Parser();
  parser.setLanguage(language);
  const tree = parser.parse(source);
  const imports = importQuery ? importQuery.captures(tree.rootNode).map((c) => c.node.text) : [];
  const symbols = symbolQuery
    ? [...new Set(symbolQuery.captures(tree.rootNode).map((c) => c.node.text))]
    : [];
  tree.delete();
  parser.delete();
  return { imports, symbols };
}

// ── cache ───────────────────────────────────────────────────────────────────

function cachePath(cacheDir) {
  return path.join(cacheDir, 'repo-map.cache.json');
}

function loadCache(cacheDir) {
  try {
    const data = JSON.parse(fs.readFileSync(cachePath(cacheDir), 'utf8'));
    if (data.schema_version === SCHEMA_VERSION && data.files) return data.files;
  } catch {
    /* no/stale cache — full parse */
  }
  return {};
}

// ── generate ──────────────────────────────────────────────────────────────

// generate({ cwd, cacheDir }) → { map, cache, stats, diagnostics }
async function generate({ cwd, cacheDir }) {
  // Rebuild the registry and fold in any project-local language definitions, so
  // a repo can map a language repo-map does not cover without forking GroundWork.
  langs.resetRegistry();
  const project = langs.loadProjectLanguages(cwd);

  const allFiles = listRepoFiles(cwd);
  const sourceExts = new Set(langs.sourceExtensions());
  // Map the app, not GroundWork's own machinery: `.groundwork/` holds the cache,
  // config (incl. repo-map.languages.js itself), and skills — never app source.
  const sourceFiles = allFiles.filter(
    (f) => !f.startsWith('.groundwork/') && sourceExts.has(path.extname(f).toLowerCase())
  );
  const fileSet = new Set(sourceFiles);
  const goModule = goModulePath(cwd);
  const ctx = { goModule, dartPackage: dartPackageName(cwd) };

  const prevCache = loadCache(cacheDir);
  const cache = {}; // rebuilt fresh so deleted files drop out
  let parsed = 0;
  let cached = 0;
  const unusable = new Map(); // lang → reason (grammar failed to load, e.g. ABI mismatch)

  // Stage 1: per-file parse (incremental). Stores raw imports + symbols.
  for (const rel of sourceFiles) {
    const lang = langForFile(rel);
    if (!lang || unusable.has(lang)) continue; // skip a language whose grammar won't load
    let buf;
    try {
      buf = fs.readFileSync(path.join(cwd, rel));
    } catch {
      continue;
    }
    const hash = sha256(buf);
    const prev = prevCache[rel];
    if (prev && prev.hash === hash && prev.lang === lang) {
      cache[rel] = prev;
      cached++;
      continue;
    }
    const res = await parseFile(lang, buf.toString('utf8'));
    if (res.error) {
      unusable.set(lang, res.error); // degrade: report this language, never crash
      continue;
    }
    cache[rel] = { hash, lang, imports: res.imports, symbols: res.symbols };
    parsed++;
  }

  // Stage 2: resolve imports → edges (recomputed every run; cheap).
  const edges = [];
  const externalSet = new Set();
  for (const rel of Object.keys(cache)) {
    const { lang, imports } = cache[rel];
    for (const raw of imports) {
      const targets = resolveImport(lang, rel, raw, fileSet, ctx);
      if (!targets) {
        const spec = stripQuotes(raw);
        if (!spec.startsWith('.')) externalSet.add(spec);
        continue;
      }
      const weight = 1 / targets.length; // a package import splits weight across its files
      for (const to of targets) {
        if (to !== rel) edges.push({ from: rel, to, weight });
      }
    }
  }

  // Stage 3: centrality.
  const ranks = pagerank(sourceFiles, edges);
  const inDeg = new Map();
  const outDeg = new Map();
  for (const e of edges) {
    inDeg.set(e.to, (inDeg.get(e.to) || 0) + 1);
    outDeg.set(e.from, (outDeg.get(e.from) || 0) + 1);
  }
  const centrality = sourceFiles
    .map((f) => ({
      file: f,
      rank: Number((ranks.get(f) || 0).toFixed(6)),
      in: inDeg.get(f) || 0,
      out: outDeg.get(f) || 0,
    }))
    .sort((a, b) => b.rank - a.rank || b.in - a.in || a.file.localeCompare(b.file));

  // Stage 4: modules (top-level directory) + symbols + contracts.
  const moduleCounts = new Map();
  for (const f of sourceFiles) {
    const top = f.includes('/') ? f.slice(0, f.indexOf('/')) : '.';
    moduleCounts.set(top, (moduleCounts.get(top) || 0) + 1);
  }
  const modules = [...moduleCounts.entries()]
    .map(([p, files]) => ({ path: p, files }))
    .sort((a, b) => b.files - a.files || a.path.localeCompare(b.path));

  const symbols = {};
  for (const rel of Object.keys(cache).sort()) {
    if (cache[rel].symbols.length) symbols[rel] = cache[rel].symbols;
  }

  const langCounts = {};
  for (const rel of Object.keys(cache)) langCounts[cache[rel].lang] = (langCounts[cache[rel].lang] || 0) + 1;

  // Per-language coverage: how many files, and at what fidelity ('graph' = the
  // language contributes internal edges + centrality; 'symbols' = symbol index
  // and external deps only). Lets consumers trust the graph where it is real.
  const coverage = {};
  for (const lang of Object.keys(langCounts)) {
    coverage[lang] = { files: langCounts[lang], fidelity: langs.fidelityFor(lang) };
  }

  // Languages present in the repo but NOT mapped — either a registry grammar that
  // failed to load (unusable), or a known code language with no built-in support
  // (NUDGE). Surfaced so the user can enable them via the extension seam rather
  // than silently believing the map is complete.
  const unmapped = unmappedLanguages({ allFiles, sourceFiles, unusable });

  const contracts = allFiles.filter(isContractFile).sort();

  // Stage 5: the manifest-derived module graph — module/target-level topology
  // read from build manifests (SwiftPM, Cargo, npm workspaces, .NET). This is
  // the aerial view for symbols-fidelity languages, whose per-file imports
  // yield no edges: the manifest declares the module DAG authoritatively.
  manifests.resetProviders();
  const projectProviders = manifests.loadProjectProviders(cwd);
  const moduleGraph = manifests.buildModuleGraph({ cwd, files: allFiles });

  const map = {
    schema_version: SCHEMA_VERSION,
    generator: 'groundwork-method repo-map',
    generator_version: require(path.join(__dirname, '..', '..', 'package.json')).version,
    generated_at_commit: headCommit(cwd),
    stats: { files: sourceFiles.length, edges: edges.length, languages: langCounts },
    coverage,
    modules,
    module_graph: moduleGraph.module_graph,
    centrality,
    edges: edges.sort((a, b) => a.from.localeCompare(b.from) || a.to.localeCompare(b.to)),
    symbols,
    contracts,
    external_dependencies: [...externalSet].sort(),
    unmapped,
  };

  return {
    map,
    cache,
    stats: { parsed, cached },
    diagnostics: {
      projectLanguages: project.loaded,
      projectErrors: project.errors,
      projectProviders: projectProviders.loaded,
      manifestErrors: [...projectProviders.errors, ...moduleGraph.errors],
      unmapped,
    },
  };
}

// Build the `unmapped` list: registry languages whose grammar failed to load,
// plus known code languages with no built-in coverage. Each entry carries a file
// count and an honest reason, so the CLI nudge is specific, not a shrug.
function unmappedLanguages({ allFiles, sourceFiles, unusable }) {
  const out = [];

  for (const [lang, reason] of unusable) {
    const files = sourceFiles.filter((f) => langForFile(f) === lang).length;
    out.push({ language: lang, files, reason });
  }

  // Group unmapped-but-known extensions by their language.
  const byLang = new Map();
  const mapped = new Set(langs.sourceExtensions());
  for (const f of allFiles) {
    const ext = path.extname(f).toLowerCase();
    if (mapped.has(ext)) continue;
    const n = langs.nudgeFor(ext);
    if (!n) continue;
    const cur = byLang.get(n.lang) || { language: n.lang, files: 0, reason: n.reason };
    cur.files += 1;
    byLang.set(n.lang, cur);
  }
  for (const entry of byLang.values()) out.push(entry);

  return out.sort((a, b) => b.files - a.files || String(a.language).localeCompare(String(b.language)));
}

// Write the emitted map + cache to disk. `generated_at` is stamped here (kept
// out of generate() so the pure result is deterministic for tests).
function write({ cacheDir, map, cache }) {
  fs.mkdirSync(cacheDir, { recursive: true });
  const stamped = { ...map, generated_at: new Date().toISOString() };
  fs.writeFileSync(path.join(cacheDir, 'repo-map.json'), JSON.stringify(stamped, null, 2));
  fs.writeFileSync(
    cachePath(cacheDir),
    JSON.stringify({ schema_version: SCHEMA_VERSION, files: cache }, null, 2)
  );
  return stamped;
}

// ── staleness (pure git, no parsing) ────────────────────────────────────────

// staleness({ cwd, cacheDir }) → { state, ...detail }
//   state: 'absent' | 'fresh' | 'stale' | 'unknown'
function staleness({ cwd, cacheDir }) {
  // Account for project-local language extensions when deciding what counts as a
  // source change (a repo may map .dart/.rs/etc. via the extension seam).
  langs.resetRegistry();
  langs.loadProjectLanguages(cwd);
  const sourceExts = new Set(langs.sourceExtensions());

  const mapFile = path.join(cacheDir, 'repo-map.json');
  if (!fs.existsSync(mapFile)) return { state: 'absent' };
  let map;
  try {
    map = JSON.parse(fs.readFileSync(mapFile, 'utf8'));
  } catch {
    return { state: 'absent' };
  }
  const sinceCommit = map.generated_at_commit;
  if (!sinceCommit || !isGitRepo(cwd)) return { state: 'unknown', reason: 'no commit provenance or not a git repo' };

  let changed;
  try {
    const committed = gitOutput(['diff', '--name-only', `${sinceCommit}..HEAD`], cwd);
    const working = gitOutput(['status', '--porcelain'], cwd)
      .split('\n')
      .map((l) => l.slice(3).trim())
      .filter(Boolean);
    changed = [...new Set([...committed.split('\n'), ...working])].map((s) => s.trim()).filter(Boolean);
  } catch {
    return { state: 'unknown', reason: 'could not read git history (commit may be gone)' };
  }

  const changedSource = changed.filter((f) => sourceExts.has(path.extname(f).toLowerCase()));
  return {
    state: changedSource.length ? 'stale' : 'fresh',
    changedSource,
    sinceCommit,
  };
}

module.exports = {
  generate,
  write,
  staleness,
  renderModuleGraphMermaid: manifests.renderMermaid,
  SCHEMA_VERSION,
};
