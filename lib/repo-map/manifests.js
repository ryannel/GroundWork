'use strict';

// The manifest-derived module graph: parse declared build manifests (SwiftPM,
// Cargo, npm/pnpm workspaces, .NET project references) into module/target-level
// dependency edges. This is the layer per-file import scanning cannot provide
// for symbols-fidelity languages — the manifest is the authoritative statement
// of module topology, present in exactly the ecosystems where import resolution
// is hardest. Everything here is deterministic text parsing of tracked files:
// no build toolchain, no dependency resolution, no network. That trade is
// honest and recorded — every provider reports `method: 'parsed'`, meaning a
// manifest that computes its target list dynamically is read only as far as its
// literal declarations.

const fs = require('fs');
const path = require('path');
const { pagerank } = require('./pagerank');

// ── text helpers ─────────────────────────────────────────────────────────────

// Index just past the matching close delimiter, honoring string literals so a
// ")" inside a name never closes a block. Returns -1 when unbalanced.
function balancedEnd(src, openIdx, open, close) {
  let depth = 0;
  let i = openIdx;
  while (i < src.length) {
    const ch = src[i];
    if (ch === '"') {
      i++;
      while (i < src.length && src[i] !== '"') i += src[i] === '\\' ? 2 : 1;
    } else if (ch === open) {
      depth++;
    } else if (ch === close) {
      depth--;
      if (depth === 0) return i + 1;
    }
    i++;
  }
  return -1;
}

// Every `<marker>(...)` block in the source, e.g. `.target(` → its full body.
function blocksFor(src, marker) {
  const out = [];
  let idx = 0;
  while ((idx = src.indexOf(marker, idx)) !== -1) {
    const open = idx + marker.length - 1; // marker includes the "("
    const end = balancedEnd(src, open, '(', ')');
    if (end === -1) break;
    out.push(src.slice(open + 1, end - 1));
    idx = end;
  }
  return out;
}

// The `[...]` body of a labeled array argument, e.g. `dependencies: [...]`.
function labeledArray(block, label) {
  const m = block.match(new RegExp(`${label}\\s*:\\s*\\[`));
  if (!m) return null;
  const open = m.index + m[0].length - 1;
  const end = balancedEnd(block, open, '[', ']');
  return end === -1 ? null : block.slice(open + 1, end - 1);
}

function firstString(block, label) {
  const m = block.match(new RegExp(`${label}\\s*:\\s*"([^"]+)"`));
  return m ? m[1] : null;
}

function allStrings(text) {
  return [...text.matchAll(/"([^"]+)"/g)].map((m) => m[1]);
}

// ── SwiftPM ──────────────────────────────────────────────────────────────────
// Package.swift declares the target DAG literally: `.target(name:, dependencies:)`
// plus product groupings. A dependency is a sibling target ("Foo" or
// .target(name:)), or another package's product (.product(name:, package:)).

const SWIFT_TARGET_KINDS = [
  ['.executableTarget(', 'executable'],
  ['.testTarget(', 'test'],
  ['.binaryTarget(', 'binary'],
  ['.macro(', 'macro'],
  ['.plugin(', 'plugin'],
  ['.target(', 'target'],
];

function parseSwiftManifest(src, manifestDir) {
  const modules = [];
  const rawDeps = []; // { from, ref: {kind, name} }

  let scrubbed = src;
  for (const [marker, kind] of SWIFT_TARGET_KINDS) {
    for (const block of blocksFor(scrubbed, marker)) {
      const name = firstString(block, 'name');
      if (!name) continue;
      modules.push({ name, kind, ecosystem: 'swiftpm', path: manifestDir, language: 'swift' });
      const deps = labeledArray(block, 'dependencies');
      if (!deps) continue;
      let rest = deps;
      for (const m of deps.matchAll(/\.product\s*\(\s*name\s*:\s*"([^"]+)"(?:\s*,\s*package\s*:\s*"([^"]+)")?[^)]*\)/g)) {
        rawDeps.push({ from: name, ref: { kind: 'product', name: m[1], package: m[2] || null } });
        rest = rest.replace(m[0], '');
      }
      for (const m of rest.matchAll(/\.(?:target|byName)\s*\(\s*name\s*:\s*"([^"]+)"[^)]*\)/g)) {
        rawDeps.push({ from: name, ref: { kind: 'byName', name: m[1] } });
        rest = rest.replace(m[0], '');
      }
      for (const bare of allStrings(rest)) rawDeps.push({ from: name, ref: { kind: 'byName', name: bare } });
    }
    // `.target(` would re-match inside `.executableTarget(`/`.testTarget(` blocks
    // already consumed — scrub processed markers so each block parses once.
    scrubbed = scrubbed.split(marker).join('.__done__(');
  }

  // Products group targets; keep them as nodes so the rendered DAG matches what
  // a package consumer sees (product → realizing targets).
  for (const marker of ['.library(', '.executable(']) {
    for (const block of blocksFor(src, marker)) {
      const name = firstString(block, 'name');
      const targets = labeledArray(block, 'targets');
      if (!name || !targets) continue;
      modules.push({ name, kind: 'product', ecosystem: 'swiftpm', path: manifestDir, language: 'swift' });
      for (const t of allStrings(targets)) rawDeps.push({ from: name, ref: { kind: 'byName', name: t } });
    }
  }

  return { modules, rawDeps };
}

const swiftpm = {
  id: 'swiftpm',
  detect: (files) => files.filter((f) => path.posix.basename(f) === 'Package.swift'),
  parse({ cwd, manifestPaths }) {
    const modules = [];
    const rawDeps = [];
    for (const rel of manifestPaths) {
      const src = fs.readFileSync(path.join(cwd, rel), 'utf8');
      const dir = path.posix.dirname(rel);
      const parsed = parseSwiftManifest(src, dir === '.' ? '' : dir);
      modules.push(...parsed.modules);
      rawDeps.push(...parsed.rawDeps);
    }
    // Resolve: a byName ref is a sibling target/product when one exists,
    // otherwise an external product; .product(package:) refs are always external.
    const internal = new Map(modules.map((m) => [m.name, m]));
    const edges = [];
    const externals = new Map();
    for (const { from, ref } of rawDeps) {
      if (ref.kind !== 'product' && internal.has(ref.name)) {
        edges.push({ from, to: ref.name });
        continue;
      }
      if (!externals.has(ref.name)) {
        externals.set(ref.name, {
          name: ref.name, kind: 'external', ecosystem: 'swiftpm',
          path: null, language: 'swift', package: ref.package || null,
        });
      }
      edges.push({ from, to: ref.name });
    }
    return { modules: [...modules, ...externals.values()], edges };
  },
};

// ── Cargo ────────────────────────────────────────────────────────────────────
// One module per [package]; edges are path dependencies only — a version-only
// dependency is a registry crate, part of external_dependencies' story, not the
// repo's internal topology.

function parseCargoToml(src) {
  let name = null;
  const pathDeps = []; // relative dirs
  let section = '';
  let dottedDep = null;
  for (const line of src.split('\n')) {
    const sec = line.match(/^\s*\[([^\]]+)\]/);
    if (sec) {
      section = sec[1].trim();
      dottedDep = section.match(/^(?:dev-|build-)?dependencies\.(.+)$/);
      continue;
    }
    if (section === 'package') {
      const m = line.match(/^\s*name\s*=\s*"([^"]+)"/);
      if (m && !name) name = m[1];
    } else if (/^(dev-|build-)?dependencies$/.test(section)) {
      const m = line.match(/^\s*[A-Za-z0-9_-]+\s*=\s*\{[^}]*path\s*=\s*"([^"]+)"/);
      if (m) pathDeps.push(m[1]);
    } else if (dottedDep) {
      const m = line.match(/^\s*path\s*=\s*"([^"]+)"/);
      if (m) pathDeps.push(m[1]);
    }
  }
  return { name, pathDeps };
}

const cargo = {
  id: 'cargo',
  detect: (files) => files.filter((f) => path.posix.basename(f) === 'Cargo.toml'),
  parse({ cwd, manifestPaths }) {
    const crates = []; // { name, dir, pathDeps }
    for (const rel of manifestPaths) {
      const { name, pathDeps } = parseCargoToml(fs.readFileSync(path.join(cwd, rel), 'utf8'));
      if (!name) continue; // a workspace-only root has no [package]
      crates.push({ name, dir: path.posix.dirname(rel), pathDeps });
    }
    const byDir = new Map(crates.map((c) => [c.dir, c]));
    const modules = crates.map((c) => ({
      name: c.name, kind: 'crate', ecosystem: 'cargo', path: c.dir === '.' ? '' : c.dir, language: 'rust',
    }));
    const edges = [];
    for (const c of crates) {
      for (const dep of c.pathDeps) {
        const target = byDir.get(path.posix.normalize(path.posix.join(c.dir, dep)));
        if (target) edges.push({ from: c.name, to: target.name });
      }
    }
    return { modules, edges };
  },
};

// ── npm / pnpm workspaces ────────────────────────────────────────────────────
// Activates only on a declared workspace (root `workspaces` or
// pnpm-workspace.yaml) — a single-package repo has no module topology to map.

function workspaceGlobs(cwd, files) {
  const globs = [];
  if (files.includes('package.json')) {
    try {
      const pkg = JSON.parse(fs.readFileSync(path.join(cwd, 'package.json'), 'utf8'));
      const ws = Array.isArray(pkg.workspaces) ? pkg.workspaces : pkg.workspaces && pkg.workspaces.packages;
      if (Array.isArray(ws)) globs.push(...ws);
    } catch { /* malformed root package.json — no workspace */ }
  }
  if (files.includes('pnpm-workspace.yaml')) {
    const src = fs.readFileSync(path.join(cwd, 'pnpm-workspace.yaml'), 'utf8');
    for (const m of src.matchAll(/^\s*-\s*["']?([^"'\n#]+?)["']?\s*$/gm)) globs.push(m[1].trim());
  }
  return globs;
}

function globToRegExp(glob) {
  const rx = glob
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*\*/g, ' ')
    .replace(/\*/g, '[^/]+')
    .replace(/ /g, '.+');
  return new RegExp(`^${rx}$`);
}

const npm = {
  id: 'npm',
  detect: (files) =>
    files.includes('pnpm-workspace.yaml') || files.includes('package.json') ? ['package.json'] : [],
  parse({ cwd, files }) {
    const globs = workspaceGlobs(cwd, files);
    if (!globs.length) return { modules: [], edges: [] };
    const patterns = globs.map(globToRegExp);
    const members = []; // { name, dir, deps: Set }
    for (const f of files) {
      if (path.posix.basename(f) !== 'package.json' || f === 'package.json') continue;
      const dir = path.posix.dirname(f);
      if (!patterns.some((p) => p.test(dir))) continue;
      try {
        const pkg = JSON.parse(fs.readFileSync(path.join(cwd, f), 'utf8'));
        if (!pkg.name) continue;
        const deps = new Set([
          ...Object.keys(pkg.dependencies || {}),
          ...Object.keys(pkg.devDependencies || {}),
          ...Object.keys(pkg.peerDependencies || {}),
        ]);
        members.push({ name: pkg.name, dir, deps });
      } catch { /* malformed member manifest — skip it, map the rest */ }
    }
    const names = new Set(members.map((m) => m.name));
    const modules = members.map((m) => ({
      name: m.name, kind: 'package', ecosystem: 'npm', path: m.dir, language: 'javascript',
    }));
    const edges = [];
    for (const m of members) {
      for (const d of m.deps) if (names.has(d) && d !== m.name) edges.push({ from: m.name, to: d });
    }
    return { modules, edges };
  },
};

// ── .NET project references ──────────────────────────────────────────────────

const dotnet = {
  id: 'dotnet',
  detect: (files) => files.filter((f) => /\.(cs|fs)proj$/.test(f)),
  parse({ cwd, manifestPaths }) {
    const projects = manifestPaths.map((rel) => ({
      rel,
      name: path.posix.basename(rel).replace(/\.(cs|fs)proj$/, ''),
      dir: path.posix.dirname(rel),
    }));
    const byRel = new Map(projects.map((p) => [p.rel, p]));
    const modules = projects.map((p) => ({
      name: p.name, kind: 'project', ecosystem: 'dotnet',
      path: p.dir === '.' ? '' : p.dir, language: 'csharp',
    }));
    const edges = [];
    for (const p of projects) {
      const src = fs.readFileSync(path.join(cwd, p.rel), 'utf8');
      for (const m of src.matchAll(/<ProjectReference[^>]*Include\s*=\s*"([^"]+)"/g)) {
        const ref = path.posix.normalize(path.posix.join(p.dir, m[1].replace(/\\/g, '/')));
        const target = byRel.get(ref);
        if (target) edges.push({ from: p.name, to: target.name });
      }
    }
    return { modules, edges };
  },
};

// ── Provider registry (mirrors languages.js: built-ins + project seam) ──────

const BUILTIN_PROVIDERS = [swiftpm, cargo, npm, dotnet];

let providers;

function resetProviders() {
  providers = new Map();
  for (const p of BUILTIN_PROVIDERS) providers.set(p.id, p);
}

resetProviders();

// A project maps a build system repo-map does not cover — or overrides a
// built-in provider — by committing `.groundwork/config/repo-map.manifests.js`
// exporting an array of providers (or `{ providers: [...] }`):
//
//   module.exports = [{
//     id: 'bazel',
//     detect(files) { return files.filter(f => f.endsWith('BUILD.bazel')); },
//     parse({ cwd, files, manifestPaths }) {
//       return { modules: [{ name, kind, ecosystem, path, language }], edges: [{ from, to }] };
//     },
//   }]
//
// An entry whose id collides with a built-in replaces it. Like the language
// seam, this executes the project's own committed JS by design.
function loadProjectProviders(cwd) {
  const cfg = path.join(cwd, '.groundwork', 'config', 'repo-map.manifests.js');
  if (!fs.existsSync(cfg)) return { loaded: [], errors: [] };
  let raw;
  try {
    delete require.cache[require.resolve(cfg)];
    raw = require(cfg);
  } catch (err) {
    return { loaded: [], errors: [`failed to load ${path.relative(cwd, cfg)}: ${err.message}`] };
  }
  const defs = Array.isArray(raw) ? raw : Array.isArray(raw && raw.providers) ? raw.providers : null;
  if (!defs) {
    return { loaded: [], errors: ['repo-map.manifests.js must export an array or { providers: [...] }'] };
  }
  const loaded = [];
  const errors = [];
  defs.forEach((d, i) => {
    const where = d && d.id ? d.id : `entry ${i}`;
    if (!d || typeof d !== 'object') return errors.push(`${where}: not an object`);
    if (typeof d.detect !== 'function' || typeof d.parse !== 'function') {
      return errors.push(`${where}: needs detect(files) and parse({cwd, files, manifestPaths}) functions`);
    }
    providers.set(d.id || `provider-${i}`, d);
    loaded.push(d.id || `provider-${i}`);
  });
  return { loaded, errors };
}

// ── build ────────────────────────────────────────────────────────────────────

// buildModuleGraph({ cwd, files }) → { module_graph, errors }
// Deterministic for a given tree: providers see only tracked files, in order.
function buildModuleGraph({ cwd, files }) {
  const modules = [];
  const edges = [];
  const sources = [];
  const errors = [];

  for (const provider of providers.values()) {
    let manifestPaths;
    try {
      manifestPaths = provider.detect(files) || [];
    } catch (err) {
      errors.push(`${provider.id}: detect failed: ${err.message}`);
      continue;
    }
    if (!manifestPaths.length) continue;
    let result;
    try {
      result = provider.parse({ cwd, files, manifestPaths });
    } catch (err) {
      errors.push(`${provider.id}: parse failed: ${err.message}`);
      continue;
    }
    if (!result || !Array.isArray(result.modules) || !result.modules.length) continue;
    modules.push(...result.modules);
    edges.push(...(result.edges || []));
    sources.push({ ecosystem: provider.id, manifests: manifestPaths.slice().sort(), method: 'parsed' });
  }

  // Dedupe (a name declared twice keeps its first, internal-most definition) and
  // drop edges whose endpoints are unknown — never fabricate a node from a typo.
  const seen = new Map();
  for (const m of modules) if (!seen.has(m.name) || seen.get(m.name).kind === 'external') seen.set(m.name, m);
  const finalModules = [...seen.values()].sort((a, b) => a.name.localeCompare(b.name));
  const names = new Set(seen.keys());
  const edgeKeys = new Set();
  const finalEdges = [];
  for (const e of edges) {
    const key = `${e.from} ${e.to}`;
    if (!names.has(e.from) || !names.has(e.to) || e.from === e.to || edgeKeys.has(key)) continue;
    edgeKeys.add(key);
    finalEdges.push({ from: e.from, to: e.to });
  }
  finalEdges.sort((a, b) => a.from.localeCompare(b.from) || a.to.localeCompare(b.to));

  const ranks = pagerank(finalModules.map((m) => m.name), finalEdges.map((e) => ({ ...e, weight: 1 })));
  const inDeg = new Map();
  const outDeg = new Map();
  for (const e of finalEdges) {
    inDeg.set(e.to, (inDeg.get(e.to) || 0) + 1);
    outDeg.set(e.from, (outDeg.get(e.from) || 0) + 1);
  }
  const module_centrality = finalModules
    .map((m) => ({
      module: m.name,
      rank: Number((ranks.get(m.name) || 0).toFixed(6)),
      in: inDeg.get(m.name) || 0,
      out: outDeg.get(m.name) || 0,
    }))
    .sort((a, b) => b.rank - a.rank || b.in - a.in || a.module.localeCompare(b.module));

  const module_graph = {
    modules: finalModules,
    edges: finalEdges,
    module_centrality,
    sources,
  };
  if (!finalModules.length) {
    module_graph.reason = 'no recognized build manifests (SwiftPM, Cargo, npm/pnpm workspaces, .NET)';
  }
  return { module_graph, errors };
}

// ── mermaid render ───────────────────────────────────────────────────────────
// The module graph as a mermaid flowchart, one subgraph per ecosystem — the
// human/docs view of the same data, replacing per-project one-off map tools.

function mermaidId(name) {
  return name.replace(/[^A-Za-z0-9_]/g, '_');
}

function mermaidNode(m) {
  const id = mermaidId(`${m.ecosystem}_${m.name}`);
  if (m.kind === 'product') return `${id}([${m.name}])`;
  if (m.kind === 'external') return `${id}{{${m.name}}}`;
  return `${id}[${m.name}]`;
}

function renderMermaid(moduleGraph) {
  const lines = ['graph LR'];
  const byEco = new Map();
  for (const m of moduleGraph.modules) {
    if (!byEco.has(m.ecosystem)) byEco.set(m.ecosystem, []);
    byEco.get(m.ecosystem).push(m);
  }
  for (const [eco, mods] of byEco) {
    lines.push(`  subgraph ${mermaidId(eco)}[${eco}]`);
    for (const m of mods) lines.push(`    ${mermaidNode(m)}`);
    lines.push('  end');
  }
  const byName = new Map(moduleGraph.modules.map((m) => [m.name, m]));
  for (const e of moduleGraph.edges) {
    const from = byName.get(e.from);
    const to = byName.get(e.to);
    lines.push(`  ${mermaidId(`${from.ecosystem}_${e.from}`)} --> ${mermaidId(`${to.ecosystem}_${e.to}`)}`);
  }
  return lines.join('\n') + '\n';
}

module.exports = { resetProviders, loadProjectProviders, buildModuleGraph, renderMermaid };
