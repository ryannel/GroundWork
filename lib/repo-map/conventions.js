'use strict';

// The deterministic project-conventions digest: runtimes pinned by manifests,
// test/build commands declared in config, the map's hub modules, and observed
// layout/naming patterns. This is the computable half of a "project context"
// document — everything here is read from tracked files or the already-computed
// map, so two runs over the same tree are byte-identical. No timestamps, no
// absolute paths, no inference: a convention appears only when a manifest or a
// file count states it. The prose half (judgment-distilled rules) is
// deliberately NOT here — docs/ is the living constitution, and an LLM
// paraphrase of it would be a second source of truth.

const fs = require('fs');
const path = require('path');

function readIfFile(cwd, rel) {
  const p = path.join(cwd, rel);
  try {
    if (fs.statSync(p).isFile()) return fs.readFileSync(p, 'utf8');
  } catch {
    /* absent — the digest simply omits it */
  }
  return null;
}

function readJson(cwd, rel) {
  const src = readIfFile(cwd, rel);
  if (src === null) return null;
  try {
    return JSON.parse(src);
  } catch {
    return null; // malformed manifest — omit, never crash
  }
}

// ── runtimes ─────────────────────────────────────────────────────────────────
// Versions the root manifests pin. Root-level only: nested packages are module
// topology (the module graph's job), not the repo-wide convention statement.

function detectRuntimes(cwd) {
  const runtimes = {};

  const pkg = readJson(cwd, 'package.json');
  if (pkg) {
    const node = {};
    if (pkg.engines && typeof pkg.engines === 'object') node.engines = pkg.engines;
    if (typeof pkg.type === 'string') node.type = pkg.type;
    if (Object.keys(node).length) runtimes.node = node;
  }

  const pyproject = readIfFile(cwd, 'pyproject.toml');
  if (pyproject) {
    const m = pyproject.match(/^\s*requires-python\s*=\s*"([^"]+)"/m);
    if (m) runtimes.python = { requires: m[1] };
  }

  const goMod = readIfFile(cwd, 'go.mod');
  if (goMod) {
    const m = goMod.match(/^\s*go\s+(\S+)/m);
    if (m) runtimes.go = { version: m[1] };
  }

  const cargo = readIfFile(cwd, 'Cargo.toml');
  if (cargo) {
    const m = cargo.match(/^\s*edition\s*=\s*"([^"]+)"/m);
    if (m) runtimes.rust = { edition: m[1] };
  }

  return runtimes;
}

// ── commands ─────────────────────────────────────────────────────────────────
// The test/build/lint entry points config declares. Only declared commands —
// never a guessed default the repo does not actually state.

const SCRIPT_KEYS = ['test', 'build', 'lint', 'dev'];

// Top-level verbs of a bash `./dev` script: case arms at indent ≤ 2 (nested
// dispatch sits deeper), `a|b)` alternates split apart. Best-effort by design —
// a dev CLI we cannot grep still reports `present: true`.
function devCliVerbs(src) {
  const verbs = [];
  for (const line of src.split('\n')) {
    const m = line.match(/^ {0,2}([a-z][a-z0-9_|-]*)\)/);
    if (!m) continue;
    for (const v of m[1].split('|')) if (v && !verbs.includes(v)) verbs.push(v);
  }
  return verbs;
}

// Top-level Makefile targets: `name:` at column 0, skipping variable
// assignments (`:=`), pattern/special targets, and recipe lines.
function makeTargets(src) {
  const targets = [];
  for (const line of src.split('\n')) {
    const m = line.match(/^([a-zA-Z0-9_-]+):(?!=)/);
    if (m && !targets.includes(m[1])) targets.push(m[1]);
  }
  return targets;
}

function detectCommands(cwd) {
  const commands = {};

  const pkg = readJson(cwd, 'package.json');
  if (pkg && pkg.scripts && typeof pkg.scripts === 'object') {
    const scripts = {};
    for (const key of SCRIPT_KEYS) {
      if (typeof pkg.scripts[key] === 'string') scripts[key] = pkg.scripts[key];
    }
    if (Object.keys(scripts).length) commands.npm_scripts = scripts;
  }

  const dev = readIfFile(cwd, 'dev');
  if (dev !== null) {
    const verbs = devCliVerbs(dev);
    commands.dev_cli = verbs.length ? { present: true, verbs } : { present: true };
  }

  const makefile = readIfFile(cwd, 'Makefile');
  if (makefile !== null) {
    const targets = makeTargets(makefile);
    if (targets.length) commands.make = targets;
  }

  const pyproject = readIfFile(cwd, 'pyproject.toml');
  if (pyproject && /^\s*\[tool\.pytest\.ini_options\]/m.test(pyproject)) {
    commands.pytest = true;
  }

  return commands;
}

// ── hubs ─────────────────────────────────────────────────────────────────────
// The map already ranked everything (PageRank) — reuse its output, never
// re-rank. File hubs come from `centrality`; module hubs from
// `module_graph.module_centrality`, only when the graph has real edges
// (rank over an edgeless module list is noise, not a hub statement).

function detectHubs(map) {
  const hubs = { files: [], modules: [] };
  if (map && Array.isArray(map.centrality)) {
    hubs.files = map.centrality.slice(0, 5).map((c) => c.file);
  }
  const mg = map && map.module_graph;
  if (mg && Array.isArray(mg.module_centrality) && Array.isArray(mg.edges) && mg.edges.length) {
    hubs.modules = mg.module_centrality.slice(0, 5).map((c) => c.module);
  }
  return hubs;
}

// ── layout ───────────────────────────────────────────────────────────────────
// Observed structure: which conventional top-level dirs exist, and the dominant
// test-file naming pattern per language — decided by counting, with a strict
// majority required (a tie is ambiguity, and the digest omits what it cannot
// state honestly).

const LAYOUT_DIRS = ['src', 'lib', 'apps', 'packages', 'tests', 'test'];

function dominant(counts) {
  // counts: [pattern, n][] → the strictly-largest pattern, or null on tie/zero.
  const sorted = counts.filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1]);
  if (!sorted.length) return null;
  if (sorted.length > 1 && sorted[0][1] === sorted[1][1]) return null;
  return sorted[0][0];
}

function detectLayout(files) {
  const topDirs = new Set();
  for (const f of files) {
    const i = f.indexOf('/');
    if (i > 0) topDirs.add(f.slice(0, i));
  }
  const source_dirs = LAYOUT_DIRS.filter((d) => topDirs.has(d));

  const count = (re) => files.filter((f) => re.test(path.posix.basename(f))).length;
  const test_patterns = {};

  const py = dominant([
    ['test_*.py', count(/^test_.+\.py$/)],
    ['*_test.py', count(/^(?!test_).+_test\.py$/)],
  ]);
  if (py) test_patterns.python = py;

  const ts = dominant([
    ['*.test.ts', count(/\.test\.tsx?$/)],
    ['*.spec.ts', count(/\.spec\.tsx?$/)],
  ]);
  if (ts) test_patterns.typescript = ts;

  const js = dominant([
    ['*.test.js', count(/\.test\.jsx?$/)],
    ['*.spec.js', count(/\.spec\.jsx?$/)],
  ]);
  if (js) test_patterns.javascript = js;

  if (count(/_test\.go$/) > 0) test_patterns.go = '*_test.go'; // Go has one convention

  return { source_dirs, test_patterns };
}

// ── digest ───────────────────────────────────────────────────────────────────

// conventions({ cwd, files, map }) → the digest. `files` are tracked repo files
// (posix rel paths); `map` is the already-generated repo map (may be minimal).
// Always returns all four keys — an empty section is valid, absence is not.
function conventions({ cwd, files, map }) {
  return {
    runtimes: detectRuntimes(cwd),
    commands: detectCommands(cwd),
    hubs: detectHubs(map || {}),
    layout: detectLayout(files || []),
  };
}

// ── markdown render ──────────────────────────────────────────────────────────
// The compact human/pack-facing view of the same digest — what milestone
// context packs point at. Sections render only when they have content; the
// file itself carries no timestamp so reruns stay byte-identical.

function renderMarkdown(digest) {
  const lines = [
    '# Project conventions',
    '',
    'Deterministic digest read from manifests, config, and the code map',
    '(`npx groundwork-method repo-map --conventions`). Only declared or counted',
    'facts appear here — byte-identical across runs on the same tree. Full data:',
    '`.groundwork/cache/repo-map.json` → `conventions`.',
    '',
  ];

  const r = digest.runtimes;
  if (Object.keys(r).length) {
    lines.push('## Runtimes', '');
    if (r.node) {
      const parts = [];
      if (r.node.engines) parts.push(...Object.entries(r.node.engines).map(([k, v]) => `${k} ${v}`));
      if (r.node.type) parts.push(`type: ${r.node.type}`);
      lines.push(`- node — ${parts.join(', ')}`);
    }
    if (r.python) lines.push(`- python — requires ${r.python.requires}`);
    if (r.go) lines.push(`- go — ${r.go.version}`);
    if (r.rust) lines.push(`- rust — edition ${r.rust.edition}`);
    lines.push('');
  }

  const c = digest.commands;
  if (Object.keys(c).length) {
    lines.push('## Commands', '');
    if (c.npm_scripts) {
      for (const [k, v] of Object.entries(c.npm_scripts)) lines.push(`- npm run ${k} — \`${v}\``);
    }
    if (c.dev_cli) {
      lines.push(c.dev_cli.verbs ? `- ./dev — verbs: ${c.dev_cli.verbs.join(', ')}` : '- ./dev — present');
    }
    if (c.make) lines.push(`- make — targets: ${c.make.join(', ')}`);
    if (c.pytest) lines.push('- pytest — configured in pyproject `[tool.pytest.ini_options]`');
    lines.push('');
  }

  if (digest.hubs.files.length || digest.hubs.modules.length) {
    lines.push('## Hubs (read these first)', '');
    if (digest.hubs.modules.length) lines.push(`- modules: ${digest.hubs.modules.join(', ')}`);
    if (digest.hubs.files.length) lines.push(`- files: ${digest.hubs.files.join(', ')}`);
    lines.push('');
  }

  const l = digest.layout;
  if (l.source_dirs.length || Object.keys(l.test_patterns).length) {
    lines.push('## Layout', '');
    if (l.source_dirs.length) lines.push(`- top-level source dirs: ${l.source_dirs.map((d) => `${d}/`).join(', ')}`);
    for (const [lang, pat] of Object.entries(l.test_patterns)) {
      lines.push(`- ${lang} tests — \`${pat}\``);
    }
    lines.push('');
  }

  return lines.join('\n');
}

// One-line CLI summary: how much the digest actually captured.
function summarize(digest) {
  return (
    `${Object.keys(digest.runtimes).length} runtime(s), ` +
    `${Object.keys(digest.commands).length} command surface(s), ` +
    `${digest.hubs.files.length + digest.hubs.modules.length} hub(s), ` +
    `${digest.layout.source_dirs.length} source dir(s)`
  );
}

module.exports = { conventions, renderMarkdown, summarize };
