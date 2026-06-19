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

const {
  LANG_WASM,
  IMPORT_QUERY,
  SYMBOL_QUERY,
  SOURCE_EXTENSIONS,
  langForFile,
  stripQuotes,
  resolveImport,
} = require('./languages');
const { pagerank } = require('./pagerank');

const SCHEMA_VERSION = 1;

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

const CONTRACT_NAME = /(openapi|swagger|asyncapi)/i;
function isContractFile(rel) {
  const ext = path.extname(rel).toLowerCase();
  if (ext === '.proto' || ext === '.graphql') return true;
  if (['.yaml', '.yml', '.json'].includes(ext) && CONTRACT_NAME.test(path.basename(rel))) return true;
  return false;
}

// ── tree-sitter engine (lazy, cached per grammar) ───────────────────────────

let Parser = null;
const languageCache = new Map(); // lang → { language, importQuery, symbolQuery }

function wasmDir() {
  return path.join(path.dirname(require.resolve('tree-sitter-wasms/package.json')), 'out');
}

async function getLanguage(lang) {
  if (languageCache.has(lang)) return languageCache.get(lang);
  if (!Parser) {
    Parser = require('web-tree-sitter');
    await Parser.init();
  }
  const language = await Parser.Language.load(path.join(wasmDir(), LANG_WASM[lang]));
  const entry = {
    language,
    importQuery: language.query(IMPORT_QUERY[lang]),
    symbolQuery: language.query(SYMBOL_QUERY[lang]),
  };
  languageCache.set(lang, entry);
  return entry;
}

async function parseFile(lang, source) {
  const { language, importQuery, symbolQuery } = await getLanguage(lang);
  const parser = new Parser();
  parser.setLanguage(language);
  const tree = parser.parse(source);
  const imports = importQuery.captures(tree.rootNode).map((c) => c.node.text);
  const symbols = [...new Set(symbolQuery.captures(tree.rootNode).map((c) => c.node.text))];
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

// generate({ cwd, cacheDir }) → { map, stats: { parsed, cached } }
async function generate({ cwd, cacheDir }) {
  const allFiles = listRepoFiles(cwd);
  const sourceFiles = allFiles.filter((f) => SOURCE_EXTENSIONS.includes(path.extname(f).toLowerCase()));
  const fileSet = new Set(sourceFiles);
  const goModule = goModulePath(cwd);

  const prevCache = loadCache(cacheDir);
  const cache = {}; // rebuilt fresh so deleted files drop out
  let parsed = 0;
  let cached = 0;

  // Stage 1: per-file parse (incremental). Stores raw imports + symbols.
  for (const rel of sourceFiles) {
    const lang = langForFile(rel);
    if (!lang) continue;
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
    const { imports, symbols } = await parseFile(lang, buf.toString('utf8'));
    cache[rel] = { hash, lang, imports, symbols };
    parsed++;
  }

  // Stage 2: resolve imports → edges (recomputed every run; cheap).
  const edges = [];
  const externalSet = new Set();
  for (const rel of Object.keys(cache)) {
    const { lang, imports } = cache[rel];
    for (const raw of imports) {
      const targets = resolveImport(lang, rel, raw, fileSet, goModule);
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

  const contracts = allFiles.filter(isContractFile).sort();

  const map = {
    schema_version: SCHEMA_VERSION,
    generator: 'groundwork-method repo-map',
    generator_version: require(path.join(__dirname, '..', '..', 'package.json')).version,
    generated_at_commit: headCommit(cwd),
    stats: { files: sourceFiles.length, edges: edges.length, languages: langCounts },
    modules,
    centrality,
    edges: edges.sort((a, b) => a.from.localeCompare(b.from) || a.to.localeCompare(b.to)),
    symbols,
    contracts,
    external_dependencies: [...externalSet].sort(),
  };

  return { map, cache, stats: { parsed, cached } };
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

  const changedSource = changed.filter((f) => SOURCE_EXTENSIONS.includes(path.extname(f).toLowerCase()));
  return {
    state: changedSource.length ? 'stale' : 'fresh',
    changedSource,
    sinceCommit,
  };
}

module.exports = { generate, write, staleness, SCHEMA_VERSION };
