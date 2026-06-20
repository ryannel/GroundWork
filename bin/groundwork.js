#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const readline = require('readline');
const { execSync, execFileSync } = require('child_process');

const command = process.argv[2];
const PKG = require(path.join(__dirname, '..', 'package.json'));

// ─── Output helpers ─────────────────────────────────────────────────────────

const c = {
  ok: (msg) => console.log(`\x1b[32m✔\x1b[0m ${msg}`),
  warn: (msg) => console.warn(`\x1b[33m[warn]\x1b[0m ${msg}`),
  err: (msg) => console.error(`\x1b[31m✖\x1b[0m ${msg}`),
  info: (msg) => console.log(`\x1b[34m[info]\x1b[0m ${msg}`),
  dim: (msg) => console.log(`\x1b[2m${msg}\x1b[0m`),
};

function banner() {
  console.log(`\n\x1b[1m\x1b[36m▲ GroundWork\x1b[0m\n`);
}

function printHelp() {
  banner();
  console.log(`\x1b[1mCommands:\x1b[0m
  \x1b[36minit\x1b[0m      Install GroundWork skills, config, and the Serena code-intelligence MCP server into the current project
  \x1b[36mupdate\x1b[0m    Bring the install up to this package version: skills, seeded docs, the ./dev bundle,
            and scripted migrations. Judgment-lane work lands in an upgrade brief for your agent.
            \x1b[2m--dry-run prints the full plan without writing anything.\x1b[0m
  \x1b[36mcheck\x1b[0m     Report framework staleness (version gap, pending migrations) and documentation drift
  \x1b[36mrepo-map\x1b[0m  Build the deterministic code map (.groundwork/cache/repo-map.json): tree-sitter
            import edges + PageRank centrality for Go, Python, and TS/JS. Incremental —
            only changed files reparse. \x1b[2m--check reports staleness without rebuilding.\x1b[0m
  \x1b[36mhelp\x1b[0m      Show this message

\x1b[1minit flags:\x1b[0m
  \x1b[36m--agent <name>\x1b[0m   Wire a specific agent (repeatable, comma-friendly); skips the prompt
  \x1b[36m--yes, -y\x1b[0m        Non-interactive: wire the auto-detected agents (or Claude Code)
  \x1b[2mSupported agents: claude-code, cursor, codex, opencode, cline\x1b[0m

\x1b[1mExamples:\x1b[0m
  npx groundwork-method init
  npx groundwork-method init --agent claude-code --agent cursor
  npx groundwork-method init --yes
  npx groundwork-method update
  npx groundwork-method check

\x1b[1mExit codes (check):\x1b[0m
  0   documentation is current with the code it describes
  1   drift detected (stale docs), or check could not run (no git repo, no docs/)
  2   internal error — git history could not be read for a tracked doc

After init, ask your AI agent to run the \x1b[36mgroundwork-orchestrator\x1b[0m skill — it reads project
state and routes to the next lifecycle step (greenfield discovery, brownfield scan, or the bet loop).
`);

  // Print the generated workflow index so `npx groundwork-method help` shows the same
  // lifecycle map the orchestrator's help intent presents.
  const indexPath = path.join(__dirname, '..', 'src', 'skills', 'groundwork-orchestrator', 'workflow-index.md');
  if (fs.existsSync(indexPath)) {
    const body = fs.readFileSync(indexPath, 'utf8').replace(/^<!--[\s\S]*?-->\s*/, '');
    console.log(`\x1b[1mThe lifecycle map:\x1b[0m\n`);
    console.log(body.split('\n').map((l) => `  ${l}`).join('\n'));
  }
}

// ─── Shared install/copy machinery ──────────────────────────────────────────

function getPaths() {
  const targetDir = process.cwd();
  return {
    targetDir,
    targetSkillsDir: path.join(targetDir, '.agents', 'skills'),
    targetHiddenSkillsDir: path.join(targetDir, '.agents', 'groundwork', 'skills'),
    targetConfigDir: path.join(targetDir, '.groundwork', 'config'),
    targetCacheDir: path.join(targetDir, '.groundwork', 'cache'),
    sourceSkillsDir: path.join(__dirname, '..', 'src', 'skills'),
    sourceHiddenSkillsDir: path.join(__dirname, '..', 'src', 'hidden-skills'),
    sourceConfigDir: path.join(__dirname, '..', 'src', 'config'),
    sourceDocsDir: path.join(__dirname, '..', 'src', 'docs'),
    sourceAgentsMd: path.join(__dirname, '..', 'src', 'AGENTS.md'),
    sourceDevBundle: path.join(__dirname, '..', 'src', 'generators', 'workspace-dev-cli', 'cli-src', 'dist', 'dev-bundle.js'),
    sourceDevLauncher: path.join(__dirname, '..', 'src', 'generators', 'workspace-dev-cli', 'files', 'dev.template'),
  };
}

// True when the command runs inside the GroundWork package/source tree itself —
// installing there would rm-and-replace the repo's own skill sources.
function isSelfCopy(p) {
  return path.resolve(p.targetDir) === path.resolve(__dirname, '..');
}

// ─── Version stamp (decision D4) ────────────────────────────────────────────
// state.json's top-level `version` is the state-schema version; the framework
// version that wrote the install lives under `groundwork.version`.

function readStampedVersion(p) {
  const statePath = path.join(p.targetConfigDir, 'state.json');
  try {
    const state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
    return (state.groundwork && state.groundwork.version) || null;
  } catch {
    return null;
  }
}

function stampVersion(p) {
  const statePath = path.join(p.targetConfigDir, 'state.json');
  try {
    let state = {};
    if (fs.existsSync(statePath)) {
      state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
    }
    state.groundwork = { ...(state.groundwork || {}), version: PKG.version };
    fs.mkdirSync(p.targetConfigDir, { recursive: true });
    fs.writeFileSync(statePath, JSON.stringify(state, null, 2));
  } catch (err) {
    c.warn(`Could not stamp framework version into state.json: ${err.message}`);
  }
}

// ─── Changelog (migration notes on update) ──────────────────────────────────

function semverCompare(a, b) {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    if ((pa[i] || 0) !== (pb[i] || 0)) return (pa[i] || 0) - (pb[i] || 0);
  }
  return 0;
}

function parseChangelog() {
  const clPath = path.join(__dirname, '..', 'CHANGELOG.md');
  if (!fs.existsSync(clPath)) return [];
  const entries = [];
  let current = null;
  for (const line of fs.readFileSync(clPath, 'utf8').split('\n')) {
    const m = line.match(/^## \[(\d+\.\d+\.\d+)\] - (.+)$/);
    if (m) {
      current = { version: m[1], date: m[2], lines: [] };
      entries.push(current);
    } else if (current) {
      current.lines.push(line);
    }
  }
  return entries; // newest first, matching file order
}

// Prints the changelog entries in (fromVersion, toVersion], flagging [migration] lines.
function printChangelogSlice(fromVersion, toVersion) {
  const entries = parseChangelog().filter(
    (e) =>
      semverCompare(e.version, toVersion) <= 0 &&
      (fromVersion === null || semverCompare(e.version, fromVersion) > 0)
  );
  if (entries.length === 0) return;

  console.log(`\x1b[1mWhat changed:\x1b[0m`);
  const migrations = [];
  for (const e of entries) {
    console.log(`\n  \x1b[1m${e.version}\x1b[0m \x1b[2m(${e.date})\x1b[0m`);
    for (const line of e.lines) {
      if (!line.trim()) continue;
      if (/\[migration\]/i.test(line)) migrations.push(line.trim());
      if (line.startsWith('### ')) {
        console.log(`    \x1b[1m${line.slice(4)}\x1b[0m`);
      } else {
        console.log(`    ${line}`);
      }
    }
  }
  if (migrations.length > 0) {
    console.log(`\n\x1b[33m\x1b[1m⚠ Migration required:\x1b[0m`);
    for (const m of migrations) console.log(`  \x1b[33m${m.replace(/\[migration\]\s*/i, '')}\x1b[0m`);
  }
  console.log('');
}

function walkFiles(dir, base) {
  // Returns relative file paths under dir, sorted for stable diff output.
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const rel = base ? path.join(base, entry.name) : entry.name;
    if (entry.isDirectory()) {
      out.push(...walkFiles(path.join(dir, entry.name), rel));
    } else {
      out.push(rel);
    }
  }
  return out.sort();
}

function diffDirs(srcDir, destDir) {
  const srcFiles = walkFiles(srcDir, '');
  const destFiles = walkFiles(destDir, '');
  const destSet = new Set(destFiles);
  const srcSet = new Set(srcFiles);
  const added = srcFiles.filter((f) => !destSet.has(f));
  const removed = destFiles.filter((f) => !srcSet.has(f));
  const changed = srcFiles.filter((f) => {
    if (!destSet.has(f)) return false;
    return !fs.readFileSync(path.join(srcDir, f)).equals(fs.readFileSync(path.join(destDir, f)));
  });
  return { added, changed, removed };
}

// ─── Install manifest (upgrade-path plan WS-A) ─────────────────────────────
// The manifest records what was deployed, from which package version, and the
// content hash at deploy — the base every later update classifies against.
// It lives apart from state.json: state is lifecycle, the manifest is a ledger.

const MANIFEST_VERSION = 1;

function sha256(buf) {
  return crypto.createHash('sha256').update(buf).digest('hex');
}

function hashFile(file) {
  try {
    return sha256(fs.readFileSync(file));
  } catch {
    return null;
  }
}

function manifestPath(p) {
  return path.join(p.targetConfigDir, 'manifest.json');
}

function readManifest(p) {
  try {
    const m = JSON.parse(fs.readFileSync(manifestPath(p), 'utf8'));
    return m && typeof m === 'object' ? m : null;
  } catch {
    return null;
  }
}

function writeManifestFile(p, manifest) {
  fs.mkdirSync(p.targetConfigDir, { recursive: true });
  fs.writeFileSync(manifestPath(p), JSON.stringify(manifest, null, 2) + '\n');
}

function emptyManifest() {
  return {
    manifest_version: MANIFEST_VERSION,
    _schema:
      'files: { <project-relative path>: { tier, source, version, hash, provenance, base? } }. ' +
      'tier 1 = framework-owned (clean-replaced on update); tier 2 = framework-seeded, user-editable ' +
      '(hash-classified: pristine refreshes, edited queues for the groundwork-upgrade skill). ' +
      'provenance "deployed" = this CLI wrote it; "adopted" = found on disk with unknown ancestry, treated as user-edited. ' +
      'base (tier 2 only) = hash of the PACKAGE content this file was last reconciled against — a merge queues only ' +
      'when the package moves past it; null means unknown ancestry. ' +
      'generated: { <generator[:name]>: { generator, version, options, files } } — written by the Nx generators.',
    files: {},
    generated: {},
  };
}

// The deployable tier-1/tier-2 surface, as { rel, tier, source, sourcePath } specs.
// generators.json and the dev bundle/launcher are handled separately: the former's
// content is machine-resolved, the latter pair exists only in scaffolded projects.
function deployableSpecs(p) {
  const pkgRoot = path.resolve(__dirname, '..');
  const specs = [];
  const pushTree = (srcDir, destPrefix, tier) => {
    for (const f of walkFiles(srcDir, '')) {
      const sourcePath = path.join(srcDir, f);
      specs.push({ rel: path.join(destPrefix, f), tier, source: path.relative(pkgRoot, sourcePath), sourcePath });
    }
  };
  pushTree(p.sourceSkillsDir, path.join('.agents', 'skills'), 1);
  pushTree(p.sourceHiddenSkillsDir, path.join('.agents', 'groundwork', 'skills'), 1);
  if (fs.existsSync(p.sourceDocsDir)) {
    for (const f of walkFiles(p.sourceDocsDir, '')) {
      if (f === 'llms.txt') continue; // deployed to the project root, not docs/
      const sourcePath = path.join(p.sourceDocsDir, f);
      specs.push({ rel: path.join('docs', f), tier: 2, source: path.relative(pkgRoot, sourcePath), sourcePath });
    }
    const llms = path.join(p.sourceDocsDir, 'llms.txt');
    if (fs.existsSync(llms)) specs.push({ rel: 'llms.txt', tier: 2, source: path.relative(pkgRoot, llms), sourcePath: llms });
  }
  if (fs.existsSync(p.sourceAgentsMd)) {
    specs.push({ rel: 'AGENTS.md', tier: 2, source: path.relative(pkgRoot, p.sourceAgentsMd), sourcePath: p.sourceAgentsMd });
  }
  return specs;
}

// A3 — backfill a manifest for an install that predates manifests. Files matching
// the current package's bytes are recorded pristine; anything else on disk is
// `adopted` (unknown ancestry — treated as user-edited until proven otherwise).
function bootstrapManifest(p, stampedVersion) {
  const manifest = emptyManifest();
  const version = stampedVersion || 'unknown';
  for (const spec of deployableSpecs(p)) {
    const diskHash = hashFile(path.join(p.targetDir, spec.rel));
    if (diskHash === null) continue; // absent — nothing to record yet
    const pkgHash = hashFile(spec.sourcePath);
    const pristine = diskHash === pkgHash;
    manifest.files[spec.rel] = {
      tier: spec.tier,
      source: spec.source,
      version: pristine ? PKG.version : version,
      hash: diskHash,
      provenance: pristine ? 'deployed' : 'adopted',
      ...(spec.tier === 2 ? { base: pristine ? pkgHash : null } : {}),
    };
  }
  const genJson = path.join(p.targetConfigDir, 'generators.json');
  const genHash = hashFile(genJson);
  if (genHash !== null) {
    manifest.files[path.join('.groundwork', 'config', 'generators.json')] = {
      tier: 1, source: 'generators.json', version, hash: genHash, provenance: 'deployed',
    };
  }
  // Generator output without provenance: detect the dev CLI heuristically so the
  // bundle lands in tier 1 and the rest of its output gets a reconcile candidate.
  const bundleHash = hashFile(path.join(p.targetDir, '.dev', 'dev-bundle.js'));
  if (bundleHash !== null) {
    manifest.files[path.join('.dev', 'dev-bundle.js')] = {
      tier: 1, source: 'src/generators/workspace-dev-cli/cli-src/dist/dev-bundle.js',
      version, hash: bundleHash, provenance: 'deployed',
    };
    const launcherHash = hashFile(path.join(p.targetDir, 'dev'));
    if (launcherHash !== null) {
      manifest.files['dev'] = {
        tier: 1, source: 'src/generators/workspace-dev-cli/files/dev.template',
        version, hash: launcherHash, provenance: 'deployed',
      };
    }
    manifest.generated['workspace-dev-cli'] = {
      generator: 'workspace-dev-cli', version, options: null, files: null, provenance: 'adopted',
    };
  }
  return manifest;
}

// ─── Tier-2 refresh (upgrade-path plan WS-C) ────────────────────────────────
// Seeded docs stop fossilizing: pristine (disk hash == deploy hash) files refresh
// to the current package content; edited files are left alone and queued for the
// groundwork-upgrade skill; absent files are copied as before.

function classifyTier2(p, manifest) {
  const out = { copy: [], refresh: [], current: [], edited: [] };
  for (const spec of deployableSpecs(p)) {
    if (spec.tier !== 2) continue;
    const destPath = path.join(p.targetDir, spec.rel);
    const diskHash = hashFile(destPath);
    const pkgHash = hashFile(spec.sourcePath);
    if (diskHash === null) {
      out.copy.push(spec);
    } else if (diskHash === pkgHash) {
      out.current.push(spec);
    } else {
      const entry = manifest.files[spec.rel];
      const pristine = entry && entry.provenance === 'deployed' && entry.hash === diskHash;
      if (pristine) {
        out.refresh.push(spec);
      } else {
        // User-edited (or unknown ancestry). A merge is only owed when the package
        // has moved past the base this copy was last reconciled against — an edit
        // to a file the framework never changed is simply the user's file.
        const base = entry ? (entry.base !== undefined ? entry.base : entry.hash) : null;
        if (base === null || pkgHash !== base) out.edited.push({ ...spec, baseHash: base });
      }
    }
  }
  return out;
}

function applyTier2(p, tier2) {
  for (const spec of [...tier2.copy, ...tier2.refresh]) {
    const dest = path.join(p.targetDir, spec.rel);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(spec.sourcePath, dest);
  }
}

// Rebuild the manifest's `files` section after an update has deployed everything.
// Edited/adopted tier-2 entries keep their original record — the deploy-time hash
// is the merge base the upgrade skill reasons against (decision O5).
function rebuildManifest(p, previous, tier2, generatorsConfig, devCli) {
  const manifest = emptyManifest();
  manifest.generated = (previous && previous.generated) || {};
  const editedSet = new Set((tier2 ? tier2.edited : []).map((s) => s.rel));
  for (const spec of deployableSpecs(p)) {
    if (spec.tier === 2 && editedSet.has(spec.rel)) {
      const prior = previous && previous.files[spec.rel];
      manifest.files[spec.rel] = prior || {
        tier: 2, source: spec.source, version: 'unknown',
        hash: hashFile(path.join(p.targetDir, spec.rel)), provenance: 'adopted', base: null,
      };
      continue;
    }
    const hash = hashFile(path.join(p.targetDir, spec.rel));
    if (hash === null) continue;
    manifest.files[spec.rel] = {
      tier: spec.tier, source: spec.source, version: PKG.version, hash, provenance: 'deployed',
      ...(spec.tier === 2 ? { base: hash } : {}),
    };
  }
  if (generatorsConfig) {
    manifest.files[path.join('.groundwork', 'config', 'generators.json')] = {
      tier: 1, source: 'generators.json', version: PKG.version, hash: sha256(generatorsConfig), provenance: 'deployed',
    };
  }
  if (devCli) {
    for (const [rel, source] of [
      [path.join('.dev', 'dev-bundle.js'), 'src/generators/workspace-dev-cli/cli-src/dist/dev-bundle.js'],
      ['dev', 'src/generators/workspace-dev-cli/files/dev.template'],
    ]) {
      const hash = hashFile(path.join(p.targetDir, rel));
      if (hash === null) continue;
      const prior = previous && previous.files[rel];
      const refreshed = (devCli.replaceBundle && rel !== 'dev') || (devCli.replaceLauncher && rel === 'dev');
      manifest.files[rel] = refreshed || !prior
        ? { tier: 1, source, version: PKG.version, hash, provenance: 'deployed' }
        : prior;
    }
  }
  return manifest;
}

// ─── Dev CLI refresh (upgrade-path plan WS-D, D1) ───────────────────────────
// The ./dev bundle + launcher are framework-owned (decision S7): built from
// cli-src, copied verbatim, never meant to be user-edited. A scaffolded project
// gets them clean-replaced on update; a customized launcher (hash matches neither
// the manifest nor the shipped template) is queued for judgment instead.

function classifyDevCli(p, manifest) {
  const out = { present: false, replaceBundle: false, replaceLauncher: false, customLauncher: false };
  const bundleDisk = hashFile(path.join(p.targetDir, '.dev', 'dev-bundle.js'));
  if (bundleDisk === null) return out; // not a scaffolded project — nothing to track
  out.present = true;
  const bundlePkg = hashFile(p.sourceDevBundle);
  if (bundlePkg !== null && bundleDisk !== bundlePkg) out.replaceBundle = true;
  const launcherDisk = hashFile(path.join(p.targetDir, 'dev'));
  const launcherPkg = hashFile(p.sourceDevLauncher);
  if (launcherDisk !== null && launcherPkg !== null && launcherDisk !== launcherPkg) {
    const entry = manifest.files['dev'];
    if (entry && entry.hash === launcherDisk) out.replaceLauncher = true;
    else out.customLauncher = true;
  }
  return out;
}

function applyDevCli(p, devCli) {
  if (devCli.replaceBundle) {
    fs.copyFileSync(p.sourceDevBundle, path.join(p.targetDir, '.dev', 'dev-bundle.js'));
  }
  if (devCli.replaceLauncher) {
    const dest = path.join(p.targetDir, 'dev');
    fs.copyFileSync(p.sourceDevLauncher, dest);
    fs.chmodSync(dest, 0o755);
  }
}

// ─── Migration registry (upgrade-path plan WS-B) ────────────────────────────
// migrations/index.json ships in the package. `cli` migrations are scripted and
// run inside update; `agent` migrations are briefs the groundwork-upgrade skill
// executes. All migrations are forward-only, idempotent, and detect-first.
// GROUNDWORK_MIGRATIONS_DIR overrides the registry location (test seam).

function migrationsDir() {
  return process.env.GROUNDWORK_MIGRATIONS_DIR || path.join(__dirname, '..', 'migrations');
}

function loadMigrationRegistry() {
  const dir = migrationsDir();
  const indexPath = path.join(dir, 'index.json');
  if (!fs.existsSync(indexPath)) return { dir, entries: [] };
  try {
    const index = JSON.parse(fs.readFileSync(indexPath, 'utf8'));
    return { dir, entries: Array.isArray(index.migrations) ? index.migrations : [] };
  } catch (err) {
    c.warn(`Could not read migration registry: ${err.message}`);
    return { dir, entries: [] };
  }
}

function readCompletedMigrations(p) {
  const statePath = path.join(p.targetConfigDir, 'state.json');
  try {
    const state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
    return (state.groundwork && Array.isArray(state.groundwork.migrations)) ? state.groundwork.migrations : [];
  } catch {
    return [];
  }
}

function recordMigrations(p, ids) {
  if (ids.length === 0) return;
  const statePath = path.join(p.targetConfigDir, 'state.json');
  try {
    let state = {};
    if (fs.existsSync(statePath)) state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
    state.groundwork = state.groundwork || {};
    const done = new Set(Array.isArray(state.groundwork.migrations) ? state.groundwork.migrations : []);
    for (const id of ids) done.add(id);
    state.groundwork.migrations = [...done];
    fs.mkdirSync(p.targetConfigDir, { recursive: true });
    fs.writeFileSync(statePath, JSON.stringify(state, null, 2));
  } catch (err) {
    c.warn(`Could not record migrations in state.json: ${err.message}`);
  }
}

// Partition unrecorded registry entries into work. cli entries are asked via
// detect(); agent entries are version-gated — their brief's own Detect section
// decides applicability when the skill picks the item up.
function pendingMigrations(p, registry, stamped) {
  const done = new Set(readCompletedMigrations(p));
  const ctx = { targetDir: p.targetDir, packageRoot: path.resolve(__dirname, '..') };
  const cli = [];
  const agent = [];
  const settled = []; // detect said done/n-a — record so detect isn't re-asked forever
  for (const entry of registry.entries) {
    if (done.has(entry.id)) continue;
    if (entry.kind === 'cli') {
      let mod;
      try {
        mod = require(path.join(registry.dir, `${entry.id}.js`));
      } catch (err) {
        c.warn(`Migration ${entry.id} could not be loaded: ${err.message}`);
        continue;
      }
      let verdict;
      try {
        verdict = mod.detect(ctx);
      } catch (err) {
        c.warn(`Migration ${entry.id} detect() failed: ${err.message}`);
        continue;
      }
      if (verdict === 'pending') cli.push({ entry, mod, ctx });
      else settled.push(entry.id);
    } else if (entry.kind === 'agent') {
      if (stamped === null || semverCompare(entry.version, stamped) > 0) agent.push(entry);
      else settled.push(entry.id);
    }
  }
  return { cli, agent, settled };
}

// B2 — run pending cli migrations in registry order. A failure stops the run with
// the migration named and the version stamp is NOT advanced past it.
function runCliMigrations(p, pending) {
  const completed = [];
  for (const { entry, mod, ctx } of pending) {
    try {
      mod.run(ctx);
      completed.push(entry.id);
      c.ok(`Migration ${entry.id} — ${entry.title}`);
    } catch (err) {
      recordMigrations(p, completed);
      c.err(`Migration ${entry.id} failed: ${err.message}`);
      console.error(`  The version stamp was not advanced. Fix the issue and re-run \x1b[36mnpx groundwork-method update\x1b[0m —`);
      console.error(`  migrations are idempotent, so completed ones are skipped and this one retries.\n`);
      return { completed, failed: entry };
    }
  }
  recordMigrations(p, completed);
  return { completed, failed: null };
}

// ─── The upgrade brief (upgrade-path plan WS-E input) ───────────────────────
// Everything that needs judgment — agent migrations, edited tier-2 merges,
// generator-output reconciliation — is compiled into a brief the
// groundwork-upgrade skill works through conversationally. Briefs and incoming
// content are copied into .groundwork/cache so the skill needs nothing from the
// npx package cache.

function upgradeBriefPath(p) {
  return path.join(p.targetDir, '.groundwork', 'cache', 'upgrade-brief.json');
}

function buildBriefItems(p, registry, agentEntries, tier2, devCli, manifest) {
  const items = [];
  for (const entry of agentEntries) {
    items.push({
      type: 'agent-migration',
      id: entry.id,
      title: entry.title,
      summary: entry.summary,
      brief: path.join('.groundwork', 'cache', 'upgrade', 'briefs', `${entry.id}.md`),
      status: 'pending',
    });
  }
  for (const spec of tier2.edited) {
    items.push({
      type: 'tier2-merge',
      id: `tier2:${spec.rel}`,
      path: spec.rel,
      incoming: path.join('.groundwork', 'cache', 'upgrade', 'tier2', spec.rel),
      base_hash: spec.baseHash,
      summary: `Framework improvements to ${spec.rel} need merging into your edited copy.`,
      status: 'pending',
    });
  }
  if (devCli.customLauncher) {
    items.push({
      type: 'tier1-custom',
      id: 'tier1:dev',
      path: 'dev',
      incoming: path.join('.groundwork', 'cache', 'upgrade', 'tier1', 'dev'),
      summary: 'The ./dev launcher was customized; the framework ships a newer one. Reconcile by hand.',
      status: 'pending',
    });
  }
  for (const [key, gen] of Object.entries(manifest.generated || {})) {
    if (gen.version === PKG.version) continue;
    items.push({
      type: 'regenerate',
      id: `regen:${key}`,
      artifact: key,
      generator: gen.generator,
      options: gen.options,
      recorded_version: gen.version,
      summary: `Generator output recorded at ${gen.version}; regenerate with recorded options and reconcile the diff.`,
      status: 'pending',
    });
  }
  return items;
}

// Write the brief (merging an existing one by item id — completed work survives)
// and stage every referenced payload into the cache.
function writeUpgradeBrief(p, registry, items, stamped) {
  const briefPath = upgradeBriefPath(p);
  let brief = { brief_version: 1, from: stamped, to: PKG.version, items: [] };
  try {
    if (fs.existsSync(briefPath)) {
      const existing = JSON.parse(fs.readFileSync(briefPath, 'utf8'));
      if (existing && Array.isArray(existing.items)) {
        brief.items = existing.items;
        // The brief spans the whole catch-up: keep the original `from` so a
        // re-run after stamping doesn't rewrite history (and stays a no-op).
        if (existing.from !== undefined) brief.from = existing.from;
      }
    }
  } catch { /* corrupt brief — rebuild from scratch */ }
  const have = new Set(brief.items.map((i) => i.id));
  for (const item of items) {
    if (!have.has(item.id)) brief.items.push(item);
  }
  if (brief.items.length === 0) return 0;

  for (const item of brief.items) {
    if (item.status !== 'pending') continue;
    if (item.type === 'agent-migration') {
      const src = path.join(registry.dir, item.id, 'brief.md');
      const dest = path.join(p.targetDir, item.brief);
      if (fs.existsSync(src)) {
        fs.mkdirSync(path.dirname(dest), { recursive: true });
        fs.copyFileSync(src, dest);
      }
    } else if (item.type === 'tier2-merge') {
      const spec = deployableSpecs(p).find((s) => s.rel === item.path);
      if (spec) {
        const dest = path.join(p.targetDir, item.incoming);
        fs.mkdirSync(path.dirname(dest), { recursive: true });
        fs.copyFileSync(spec.sourcePath, dest);
      }
    } else if (item.type === 'tier1-custom' && item.path === 'dev') {
      const dest = path.join(p.targetDir, item.incoming);
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.copyFileSync(p.sourceDevLauncher, dest);
    }
  }
  fs.mkdirSync(path.dirname(briefPath), { recursive: true });
  fs.writeFileSync(briefPath, JSON.stringify(brief, null, 2) + '\n');
  return brief.items.filter((i) => i.status === 'pending').length;
}

// Clean-copy the two skill trees. Removing first prevents deprecated skills from lingering.
// Throws on copy failure — callers abort rather than report success over a partial install.
function installSkillTrees(p) {
  for (const [src, dest, label] of [
    [p.sourceSkillsDir, p.targetSkillsDir, 'Registered skills'],
    [p.sourceHiddenSkillsDir, p.targetHiddenSkillsDir, 'Hidden methodology skills'],
  ]) {
    if (fs.existsSync(dest)) {
      try {
        fs.rmSync(dest, { recursive: true, force: true });
      } catch (err) {
        c.warn(`Failed to clean ${label.toLowerCase()} dir: ${err.message}`);
      }
    }
    fs.mkdirSync(dest, { recursive: true });
    try {
      execSync(`cp -R "${src}/"* "${dest}/"`);
    } catch (err) {
      throw new Error(`Failed to install ${label.toLowerCase()}: ${err.message}`);
    }
  }
}

// generators.json ships with repo-relative factory/schema paths; resolve them against the
// installed package location so the scaffold skill can invoke generators from any project.
function buildGeneratorsConfig() {
  const sourceGeneratorsJson = path.join(__dirname, '..', 'generators.json');
  if (!fs.existsSync(sourceGeneratorsJson)) return null;
  const pkgRoot = path.resolve(__dirname, '..');
  const generatorsJson = JSON.parse(fs.readFileSync(sourceGeneratorsJson, 'utf8'));
  for (const gen of Object.values(generatorsJson.generators)) {
    gen.factory = path.resolve(pkgRoot, gen.factory.replace(/^\.\//, ''));
    gen.schema = path.resolve(pkgRoot, gen.schema.replace(/^\.\//, ''));
  }
  return JSON.stringify(generatorsJson, null, 2);
}

// ─── Agent wiring ─────────────────────────────────────────────────────────────
// GroundWork keeps one canonical source of truth — AGENTS.md (instructions) + .agents/
// (skills) — and wires each agent tool to it with symlinks rather than copies, so there is
// never a second copy to drift. AGENTS.md is ALWAYS the real file; agent-specific files
// (CLAUDE.md, …) are symlinks pointing at it, so adding or switching agents never moves or
// orphans the canonical.
//
// `native: true` agents (Cursor, Codex, OpenCode, Cline) read AGENTS.md and .agents/skills/
// directly — generating the canonical files is the entire wiring; they need no symlink.
const AGENT_ADAPTERS = {
  'claude-code': {
    label: 'Claude Code',
    detect: ['.claude', 'CLAUDE.md'],
    dirLink: { link: '.claude', target: '.agents' },
    fileLink: { link: 'CLAUDE.md', target: 'AGENTS.md' },
  },
  'cursor':   { label: 'Cursor',   detect: ['.cursor', '.cursorrules'], native: true },
  'codex':    { label: 'Codex',    detect: ['.codex'], native: true },
  'opencode': { label: 'OpenCode', detect: ['.opencode', 'opencode.json'], native: true },
  'cline':    { label: 'Cline',    detect: ['.clinerules', '.cline'], native: true },
};
const AGENT_KEYS = Object.keys(AGENT_ADAPTERS);

// Agents whose marker files/dirs already exist in the target — used to pre-select the prompt
// and as the non-interactive default.
function detectAgents(targetDir) {
  return AGENT_KEYS.filter((key) =>
    AGENT_ADAPTERS[key].detect.some((marker) => fs.existsSync(path.join(targetDir, marker)))
  );
}

// Deploy the canonical AGENTS.md router to the project root (idempotent — never overwrites a
// user-authored AGENTS.md). Returns true only when it actually created the file.
function ensureAgentsMd(p) {
  if (!fs.existsSync(p.sourceAgentsMd)) return false;
  const target = path.join(p.targetDir, 'AGENTS.md');
  if (fs.existsSync(target)) return false;
  try {
    fs.copyFileSync(p.sourceAgentsMd, target);
    return true;
  } catch (err) {
    c.err(`Failed to install AGENTS.md: ${err.message}`);
    return false;
  }
}

// Create one symlink (link → target) relative to targetDir, gracefully handling an existing
// real file/dir and Windows symlink restrictions. `type` is 'junction' for directory links.
function linkOne(targetDir, link, target, type) {
  const linkPath = path.join(targetDir, link);
  const isDir = type === 'junction';
  try {
    const stat = fs.existsSync(linkPath) ? fs.lstatSync(linkPath) : null;
    if (!stat) {
      fs.symlinkSync(target, linkPath, type);
      c.ok(`Linked ${link} → ${target}`);
    } else if (stat.isSymbolicLink()) {
      // already a symlink — no-op regardless of where it points
    } else {
      c.warn(`${link} already exists as a real ${isDir ? 'directory' : 'file'}. To enable the link:`);
      console.warn(`         move its contents into ${target}${isDir ? '/' : ''}, delete ${link}${isDir ? '/' : ''}, then run: ln -s ${target} ${link}`);
    }
  } catch (err) {
    c.warn(`Could not create ${link} symlink: ${err.message}`);
    console.warn(`         On Windows, enable Developer Mode or run as Administrator and retry,`);
    console.warn(`         or create it manually: ln -s ${target} ${link}`);
  }
}

// Wire the selected agent tools to the canonical AGENTS.md + .agents/ source of truth.
// Idempotent: re-running never duplicates or clobbers, so init and update can both call it.
function wireAgents(targetDir, selectedKeys) {
  const keys = selectedKeys.filter((k) => AGENT_ADAPTERS[k]);
  if (keys.length === 0) return;

  const native = [];
  for (const key of keys) {
    const a = AGENT_ADAPTERS[key];
    if (a.native) {
      native.push(a.label);
      continue;
    }
    if (a.dirLink) linkOne(targetDir, a.dirLink.link, a.dirLink.target, 'junction');
    // The file symlink only fires once the canonical AGENTS.md exists (init generates it first).
    if (a.fileLink && fs.existsSync(path.join(targetDir, a.fileLink.target))) {
      linkOne(targetDir, a.fileLink.link, a.fileLink.target);
    }
  }
  if (native.length) {
    c.ok(`${native.join(', ')} read AGENTS.md + .agents/skills/ natively — no link needed`);
  }
}

// Record the wired agents so `update` self-heals the same links and re-init stays idempotent.
function persistAgents(p, keys) {
  const statePath = path.join(p.targetConfigDir, 'state.json');
  try {
    let state = {};
    if (fs.existsSync(statePath)) state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
    state.groundwork = { ...(state.groundwork || {}), agents: keys };
    fs.mkdirSync(p.targetConfigDir, { recursive: true });
    fs.writeFileSync(statePath, JSON.stringify(state, null, 2));
  } catch (err) {
    c.warn(`Could not record wired agents in state.json: ${err.message}`);
  }
}

function readPersistedAgents(p) {
  const statePath = path.join(p.targetConfigDir, 'state.json');
  try {
    const state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
    return state.groundwork && Array.isArray(state.groundwork.agents) ? state.groundwork.agents : null;
  } catch {
    return null;
  }
}

// The native tools (Cursor, Codex, OpenCode, Cline) read AGENTS.md + .agents/skills/ directly, so
// they need no setup. The ONLY decision worth a prompt is whether to wire Claude Code, which looks
// for CLAUDE.md / .claude/ instead and gets symlinks to the canonical. So the interactive prompt
// is a single yes/no, not a five-box picker where four boxes are no-ops.
// No TTY (piped npx, CI): wire any detected wired tool, else default to Claude Code, so unattended
// installs still wire the verified host.
function promptAgents(detected) {
  const wiredKeys = AGENT_KEYS.filter((k) => !AGENT_ADAPTERS[k].native);
  const nativeLabels = AGENT_KEYS.filter((k) => AGENT_ADAPTERS[k].native).map((k) => AGENT_ADAPTERS[k].label);

  return new Promise((resolve) => {
    if (!process.stdin.isTTY || !process.stdout.isTTY) {
      const det = wiredKeys.filter((k) => detected.includes(k));
      resolve(det.length ? det : ['claude-code']);
      return;
    }

    // Today there is exactly one wired (non-native) tool: Claude Code. If a second is ever added,
    // restore a checkbox picker over `wiredKeys` here — this single yes/no only covers one.
    const only = wiredKeys[0];
    const a = AGENT_ADAPTERS[only];
    const claudeDetected = detected.includes(only);
    const nativeDetected = AGENT_KEYS.some((k) => AGENT_ADAPTERS[k].native && detected.includes(k));
    // Default yes unless a native tool is the only thing we detected (then they're already set up).
    const defaultYes = claudeDetected || !nativeDetected;

    // Lead with the consequence: the native tools already work, so the question is only about
    // Claude Code — and a "yes" is the one answer that writes files.
    const nativeList = nativeLabels.length > 1
      ? `${nativeLabels.slice(0, -1).join(', ')}, and ${nativeLabels[nativeLabels.length - 1]}`
      : nativeLabels[0] || '';
    console.log(`\n\x1b[1mGroundWork keeps all your project guidance in ${a.fileLink.target} and the ${a.dirLink.target}/ folder.\x1b[0m`);
    if (nativeList) {
      console.log(`  \x1b[32m✓\x1b[0m \x1b[2m${nativeList} read them automatically — nothing to set up.\x1b[0m`);
    }
    console.log(`  \x1b[2m${a.label} looks for ${a.fileLink.link} / ${a.dirLink.link}/ instead, so it needs links to them.\x1b[0m`);

    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const choices = defaultYes ? '\x1b[2m[Y/n]\x1b[0m' : '\x1b[2m[y/N]\x1b[0m';
    let settled = false;
    const settle = (yes) => {
      if (settled) return;
      settled = true;
      rl.close();
      resolve(yes ? [only] : []);
    };
    // Enter answers; an empty line or EOF (Ctrl-D / a closed pipe) takes the shown default so the
    // prompt can never hang an install.
    rl.on('close', () => settle(defaultYes));
    rl.question(`\nAre you using ${a.label} in this project?  ${choices} `, (ans) => {
      const t = ans.trim().toLowerCase();
      settle(t === '' ? defaultYes : t[0] === 'y');
    });
  });
}

// Parse `--agent <key>` / `--agent=<key>` (repeatable, comma-friendly) and `--yes`/`-y`.
function parseInitFlags(argv) {
  const requested = [];
  let yes = false;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--yes' || arg === '-y') {
      yes = true;
    } else if (arg === '--agent' || arg === '--agents') {
      const val = argv[i + 1];
      if (val && !val.startsWith('-')) { requested.push(...val.split(',')); i++; }
    } else if (arg.startsWith('--agent=') || arg.startsWith('--agents=')) {
      requested.push(...arg.slice(arg.indexOf('=') + 1).split(','));
    }
  }
  const normalized = requested.map((s) => s.trim()).filter(Boolean);
  return {
    agents: normalized.filter((a) => AGENT_ADAPTERS[a]),
    invalid: normalized.filter((a) => !AGENT_ADAPTERS[a]),
    yes,
  };
}

// The "switch implications" guidance: make the single-source-of-truth model explicit.
function printWiringGuidance(selectedKeys) {
  const labels = selectedKeys.map((k) => AGENT_ADAPTERS[k] && AGENT_ADAPTERS[k].label).filter(Boolean).join(', ');
  // No wired tool (e.g. a Cursor/Codex user) is not "nothing set up" — their tool reads AGENTS.md
  // directly, so frame the empty case around the canonical, not around a missing link.
  const reads = labels
    ? `${labels} ${selectedKeys.length === 1 ? 'reads' : 'read'} them.`
    : `Your AI tool reads them directly — no links needed.`;
  console.log(`\n\x1b[1mAgent wiring\x1b[0m`);
  console.log(`  \x1b[2mAGENTS.md and .agents/ are your single source of truth.\x1b[0m ${reads}`);
  console.log(`  \x1b[2mAdd one later:\x1b[0m npx groundwork-method init --agent <name>  \x1b[2m(non-destructive)\x1b[0m`);
  console.log(`  \x1b[2mEdit AGENTS.md, never a symlinked copy — switching agents never moves it.\x1b[0m`);
}

// Register Serena (github.com/oraios/serena) as a project-scoped MCP server. Serena is an
// LSP-based code-intelligence tool (40+ languages) that GroundWork treats as a first-class
// code map: the brownfield scan, the architecture extractor, and groundwork-check reason over
// its symbol/reference queries (and build repo-map.json from them), and the engineer skills
// use its symbolic editing. The registration is idempotent and additive — it never clobbers
// other servers — and it removes any prior depwire entry so a re-init/upgrade swaps cleanly.
// Every consumer degrades gracefully when Serena is absent (it needs `uv`), so this is a
// force-multiplier, never a hard dependency.
const SERENA_MCP_SERVER = {
  command: 'uvx',
  args: ['--from', 'serena-agent==1.5.3', 'serena', 'start-mcp-server', '--context', 'ide-assistant', '--project', '.'],
};
function registerSerenaMcp(targetDir) {
  const mcpPath = path.join(targetDir, '.mcp.json');
  try {
    let config = { mcpServers: {} };
    if (fs.existsSync(mcpPath)) {
      config = JSON.parse(fs.readFileSync(mcpPath, 'utf8'));
      if (!config.mcpServers || typeof config.mcpServers !== 'object') {
        config.mcpServers = {};
      }
    }
    const hadDepwire = Boolean(config.mcpServers.depwire);
    if (hadDepwire) delete config.mcpServers.depwire; // pull out the retired server
    if (config.mcpServers.serena && !hadDepwire) {
      return; // already registered and nothing to remove — preserve the user's configuration
    }
    config.mcpServers.serena = SERENA_MCP_SERVER;
    fs.writeFileSync(mcpPath, JSON.stringify(config, null, 2));
    c.ok(`Registered Serena code-intelligence MCP server (.mcp.json)`);
  } catch (err) {
    c.warn(`Could not register Serena MCP server: ${err.message}`);
    console.warn(`         GroundWork still works without it — the code map falls back to LLM inference.`);
  }
}

// ─── init ───────────────────────────────────────────────────────────────────

async function initGroundWork(options = {}) {
  const p = getPaths();

  banner();
  c.info(`Initializing in \x1b[2m${p.targetDir}\x1b[0m\n`);

  if (isSelfCopy(p)) {
    c.warn(`You are running this command inside the GroundWork source repository itself.`);
    console.warn(`       Skipping skill installation to prevent recursive copying.\n`);
    return;
  }

  for (const dir of [p.targetSkillsDir, p.targetHiddenSkillsDir, p.targetConfigDir, p.targetCacheDir]) {
    fs.mkdirSync(dir, { recursive: true });
  }

  try {
    installSkillTrees(p);
  } catch (err) {
    c.err(err.message);
    c.err(`Install aborted — resolve the issue and re-run npx groundwork-method init.`);
    process.exitCode = 1;
    return;
  }
  c.ok(`Installed orchestrator, registered skills, and hidden methodology skills`);

  const generatorsConfig = buildGeneratorsConfig();
  if (generatorsConfig) {
    try {
      fs.writeFileSync(path.join(p.targetConfigDir, 'generators.json'), generatorsConfig);
      c.ok(`Installed generators config`);
    } catch (err) {
      c.err(`Failed to install generators config: ${err.message}`);
    }
  }

  // Create state file only if it doesn't exist — preserves completed phase history across updates
  const sourceState = path.join(p.sourceConfigDir, 'groundwork-state.json');
  const targetState = path.join(p.targetConfigDir, 'state.json');
  if (fs.existsSync(sourceState) && !fs.existsSync(targetState)) {
    try {
      fs.copyFileSync(sourceState, targetState);
      c.ok(`Initialized project state`);
    } catch (err) {
      c.err(`Failed to initialize state: ${err.message}`);
    }
  }

  // Seed the user config once; it is user-owned and never overwritten afterwards.
  const sourceConfigToml = path.join(p.sourceConfigDir, 'config.toml');
  const targetConfigToml = path.join(p.targetConfigDir, 'config.toml');
  if (fs.existsSync(sourceConfigToml) && !fs.existsSync(targetConfigToml)) {
    try {
      fs.copyFileSync(sourceConfigToml, targetConfigToml);
      c.ok(`Seeded user config (.groundwork/config/config.toml)`);
    } catch (err) {
      c.err(`Failed to seed user config: ${err.message}`);
    }
  }

  // Deploy documentation foundations + llms.txt + AGENTS.md (tier 2: copy when
  // absent, never overwrite what exists — classification handles the rest on update).
  // AGENTS.md must precede wireAgents so the CLAUDE.md → AGENTS.md link resolves.
  try {
    const tier2 = classifyTier2(p, emptyManifest());
    applyTier2(p, tier2);
    c.ok(`Installed documentation foundations`);
    if (tier2.copy.some((s) => s.rel === 'AGENTS.md')) c.ok(`Installed canonical AGENTS.md`);
  } catch (err) {
    c.err(`Failed to install documentation foundations: ${err.message}`);
  }

  stampVersion(p);

  // A fresh install needs no migrations: record the whole registry as settled so
  // update never queues catch-up work this init already delivered (detect-honesty).
  const registry = loadMigrationRegistry();
  recordMigrations(p, registry.entries.map((e) => e.id));

  // Write the install manifest — the provenance ledger every future update
  // classifies against (what was deployed, from which version, with which hash).
  try {
    writeManifestFile(p, rebuildManifest(p, readManifest(p), classifyTier2(p, emptyManifest()), generatorsConfig, classifyDevCli(p, emptyManifest())));
    c.ok(`Wrote install manifest (.groundwork/config/manifest.json)`);
  } catch (err) {
    c.warn(`Could not write install manifest: ${err.message}`);
  }

  // Decide which agent tools to wire to the canonical source: explicit --agent flags win,
  // then --yes uses the detected set, otherwise prompt (detected agents pre-selected).
  const detected = detectAgents(p.targetDir);
  let selected;
  if (options.agents && options.agents.length) {
    selected = options.agents;
  } else if (options.yes) {
    selected = detected.length ? detected : ['claude-code'];
  } else {
    selected = await promptAgents(detected);
  }
  wireAgents(p.targetDir, selected);
  persistAgents(p, selected);

  registerSerenaMcp(p.targetDir);

  printWiringGuidance(selected);

  console.log(`\n\x1b[32m[success]\x1b[0m GroundWork ${PKG.version} initialization complete!`);
  console.log(`          Ask your AI to run the \x1b[36mgroundwork-orchestrator\x1b[0m skill to find out what to do next.\n`);
}

// ─── update ─────────────────────────────────────────────────────────────────

function reportDiff(label, diff) {
  if (diff.added.length + diff.changed.length + diff.removed.length === 0) return;
  console.log(`\x1b[1m${label}\x1b[0m`);
  for (const f of diff.added) console.log(`  \x1b[32m+ ${f}\x1b[0m`);
  for (const f of diff.changed) console.log(`  \x1b[33m~ ${f}\x1b[0m`);
  for (const f of diff.removed) console.log(`  \x1b[31m- ${f}\x1b[0m`);
}

function reportTier2(tier2, devCli) {
  if (tier2.copy.length + tier2.refresh.length + tier2.edited.length === 0 && !devCli.replaceBundle && !devCli.replaceLauncher && !devCli.customLauncher) return;
  console.log(`\x1b[1mSeeded docs & framework files\x1b[0m`);
  for (const s of tier2.copy) console.log(`  \x1b[32m+ ${s.rel}\x1b[0m \x1b[2m(missing — copied)\x1b[0m`);
  for (const s of tier2.refresh) console.log(`  \x1b[33m~ ${s.rel}\x1b[0m \x1b[2m(pristine — refreshed)\x1b[0m`);
  for (const s of tier2.edited) console.log(`  \x1b[36m⊜ ${s.rel}\x1b[0m \x1b[2m(edited — queued for the upgrade skill, your copy untouched)\x1b[0m`);
  if (devCli.replaceBundle) console.log(`  \x1b[33m~ .dev/dev-bundle.js\x1b[0m \x1b[2m(framework-owned — replaced with the current bundle)\x1b[0m`);
  if (devCli.replaceLauncher) console.log(`  \x1b[33m~ dev\x1b[0m \x1b[2m(framework-owned — replaced with the current launcher)\x1b[0m`);
  if (devCli.customLauncher) console.log(`  \x1b[36m⊜ dev\x1b[0m \x1b[2m(customized — queued for the upgrade skill, your copy untouched)\x1b[0m`);
}

function updateGroundWork(flags = {}) {
  const p = getPaths();
  const dryRun = !!flags.dryRun;

  banner();

  if (isSelfCopy(p)) {
    c.warn(`You are running this command inside the GroundWork source repository itself.`);
    console.warn(`       Skipping update to prevent recursive copying.\n`);
    return;
  }

  if (!fs.existsSync(p.targetSkillsDir) && !fs.existsSync(p.targetHiddenSkillsDir)) {
    c.err(`No GroundWork installation found in ${p.targetDir}`);
    console.error(`  Run \x1b[36mnpx groundwork-method init\x1b[0m first.\n`);
    process.exitCode = 1;
    return;
  }

  const stamped = readStampedVersion(p);

  // A3 — a pre-manifest install gets its manifest backfilled before anything
  // reads it: tier-2 classification needs a base to compare against.
  let manifest = readManifest(p);
  const bootstrapped = manifest === null;
  if (bootstrapped) {
    manifest = bootstrapManifest(p, stamped);
    if (!dryRun) {
      writeManifestFile(p, manifest);
      c.ok(`Bootstrapped install manifest (.groundwork/config/manifest.json)`);
    }
  }

  // Classify everything before touching anything, so the summary (and --dry-run)
  // reflects exactly what a real run performs.
  const skillsDiff = diffDirs(p.sourceSkillsDir, p.targetSkillsDir);
  const hiddenDiff = diffDirs(p.sourceHiddenSkillsDir, p.targetHiddenSkillsDir);

  const generatorsConfig = buildGeneratorsConfig();
  const targetGeneratorsJson = path.join(p.targetConfigDir, 'generators.json');
  const generatorsChanged =
    generatorsConfig !== null &&
    (!fs.existsSync(targetGeneratorsJson) ||
      fs.readFileSync(targetGeneratorsJson, 'utf8') !== generatorsConfig);

  const tier2 = classifyTier2(p, manifest);
  const devCli = classifyDevCli(p, manifest);
  const registry = loadMigrationRegistry();
  const pending = pendingMigrations(p, registry, stamped);
  const briefItems = buildBriefItems(p, registry, pending.agent, tier2, devCli, manifest);

  const total =
    skillsDiff.added.length + skillsDiff.changed.length + skillsDiff.removed.length +
    hiddenDiff.added.length + hiddenDiff.changed.length + hiddenDiff.removed.length +
    (generatorsChanged ? 1 : 0) +
    tier2.copy.length + tier2.refresh.length +
    (devCli.replaceBundle ? 1 : 0) + (devCli.replaceLauncher ? 1 : 0) +
    pending.cli.length + briefItems.length;

  if (total === 0) {
    if (!dryRun) {
      recordMigrations(p, pending.settled);
      if (stamped !== PKG.version) stampVersion(p); // files identical, stamp drifted — repair silently
      if (bootstrapped) writeManifestFile(p, rebuildManifest(p, manifest, tier2, generatorsConfig, devCli));
    }
    c.ok(`Already up to date — installed skills match groundwork ${PKG.version}.`);
    console.log(`  \x1b[2m.groundwork/config and docs/ were not touched.\x1b[0m\n`);
    return;
  }

  if (stamped && stamped !== PKG.version) {
    c.info(`Updating ${stamped} → ${PKG.version}\n`);
  } else if (!stamped) {
    c.info(`No version stamp found (pre-0.9 install) — updating to ${PKG.version}\n`);
  }

  // B4 — dry run: print the full plan, mutate nothing.
  if (dryRun) {
    console.log(`\x1b[1mDry run — nothing will be written.\x1b[0m\n`);
    reportDiff('.agents/skills/', skillsDiff);
    reportDiff('.agents/groundwork/skills/', hiddenDiff);
    if (generatorsChanged) console.log(`\x1b[1m.groundwork/config/\x1b[0m\n  \x1b[33m~ generators.json\x1b[0m`);
    reportTier2(tier2, devCli);
    if (pending.cli.length) {
      console.log(`\x1b[1mScripted migrations to run:\x1b[0m`);
      for (const { entry } of pending.cli) console.log(`  \x1b[33m▸ ${entry.id}\x1b[0m — ${entry.title}`);
    }
    if (briefItems.length) {
      console.log(`\x1b[1mUpgrade brief (judgment lane — handled by the groundwork-upgrade skill):\x1b[0m`);
      for (const item of briefItems) console.log(`  \x1b[36m▸ ${item.id}\x1b[0m — ${item.summary || item.title}`);
    }
    console.log('');
    return;
  }

  // ── Mechanical lane ──
  // Any I/O failure here aborts before the stamp and manifest advance: a partial
  // apply must read as "update failed, re-run" — never as a clean update whose
  // half-copied files classify as user edits on the next run.
  try {
    installSkillTrees(p);
    if (generatorsChanged) {
      fs.mkdirSync(p.targetConfigDir, { recursive: true });
      fs.writeFileSync(targetGeneratorsJson, generatorsConfig);
    }
    applyTier2(p, tier2);
    applyDevCli(p, devCli);
  } catch (err) {
    c.err(`Update failed while copying files: ${err.message}`);
    c.err(`Aborted — version stamp and manifest were not advanced. Re-run npx groundwork-method update after resolving.`);
    process.exitCode = 1;
    return;
  }

  c.ok(`Updated GroundWork skills\n`);
  reportDiff('.agents/skills/', skillsDiff);
  reportDiff('.agents/groundwork/skills/', hiddenDiff);
  if (generatorsChanged) console.log(`\x1b[1m.groundwork/config/\x1b[0m\n  \x1b[33m~ generators.json\x1b[0m`);
  reportTier2(tier2, devCli);

  console.log(`\n  \x1b[2mPreserved: .groundwork/config (state, settings), .groundwork/cache, and every doc you edited.\x1b[0m\n`);

  // B2 — run pending scripted migrations in registry order; record completions.
  let migrationResult = { completed: [], failed: null };
  if (pending.cli.length) {
    console.log(`\x1b[1mRunning migrations:\x1b[0m`);
    migrationResult = runCliMigrations(p, pending.cli);
    console.log('');
  }
  recordMigrations(p, pending.settled);

  // Migration notes: surface the changelog slice between the stamped and current versions.
  if (stamped === null || semverCompare(stamped, PKG.version) < 0) {
    printChangelogSlice(stamped, PKG.version);
  }

  // Self-heal agent wiring: ensure the canonical AGENTS.md exists and the recorded agents'
  // symlinks are intact (idempotent). Pre-0.9 installs have no record — fall back to detection.
  if (ensureAgentsMd(p)) c.ok(`Installed canonical AGENTS.md`);
  const agents = readPersistedAgents(p) || detectAgents(p.targetDir);
  if (agents.length) {
    wireAgents(p.targetDir, agents);
    if (!readPersistedAgents(p)) persistAgents(p, agents);
  }

  // E4 — compile the judgment lane's work list. Written even when a migration
  // failed: the brief is how the rest of the catch-up happens.
  const briefCount = writeUpgradeBrief(p, registry, briefItems, stamped);

  // A failed migration stops the stamp from advancing past it (decision S4:
  // idempotent + detect-first makes the re-run safe).
  if (migrationResult.failed) {
    process.exitCode = 1;
    return;
  }

  writeManifestFile(p, rebuildManifest(p, manifest, tier2, generatorsConfig, devCli));
  stampVersion(p);

  if (briefCount > 0) {
    console.log(`\n\x1b[33m\x1b[1m⚠ ${briefCount} item(s) need a working session:\x1b[0m open your agent and say \x1b[36m"upgrade groundwork"\x1b[0m.`);
    console.log(`  \x1b[2mThe work list is at .groundwork/cache/upgrade-brief.json — the groundwork-upgrade skill consumes it.\x1b[0m\n`);
  }
}

// ─── check ──────────────────────────────────────────────────────────────────

function parseFrontmatter(content) {
  // Minimal YAML frontmatter reader: flat `key: value` pairs between --- fences.
  if (!content.startsWith('---')) return null;
  const end = content.indexOf('\n---', 3);
  if (end === -1) return null;
  const fm = {};
  for (const line of content.slice(3, end).split('\n')) {
    const m = line.match(/^([A-Za-z_][\w-]*):\s*(.*)$/);
    if (m) fm[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
  }
  return fm;
}

// F1 — the framework section of `check`: is this install behind the framework?
// No network: the package running the check IS the newest version the user
// fetched (decision O2). Returns true when the install is stale.
function reportFrameworkStatus(p) {
  const installed = fs.existsSync(p.targetSkillsDir) || fs.existsSync(p.targetHiddenSkillsDir);
  if (!installed) return false;

  let stale = false;
  const stamped = readStampedVersion(p);
  console.log(`\x1b[1mFramework:\x1b[0m installed ${stamped || 'unstamped (pre-0.9)'} · package ${PKG.version}`);

  if (!stamped || stamped !== PKG.version) {
    stale = true;
    c.warn(`This install trails the framework — run \x1b[36mnpx groundwork-method update\x1b[0m.`);
  } else {
    // Same version: any divergence from the package is a user edit to framework-owned
    // files, which clean-replace will revert — name it instead of surprising them.
    const mismatched = [];
    for (const [src, dest, prefix] of [
      [p.sourceSkillsDir, p.targetSkillsDir, '.agents/skills'],
      [p.sourceHiddenSkillsDir, p.targetHiddenSkillsDir, '.agents/groundwork/skills'],
    ]) {
      const d = diffDirs(src, dest);
      for (const f of [...d.changed, ...d.removed]) mismatched.push(path.join(prefix, f));
    }
    if (mismatched.length) {
      stale = true;
      c.warn(`${mismatched.length} framework-owned file(s) differ from the package (edits here are lost on update):`);
      for (const f of mismatched.slice(0, 10)) console.log(`         ${f}`);
      if (mismatched.length > 10) console.log(`         … and ${mismatched.length - 10} more`);
    }
  }

  const registry = loadMigrationRegistry();
  const pending = pendingMigrations(p, registry, stamped);
  const pendingCount = pending.cli.length + pending.agent.length;
  if (pendingCount > 0) {
    stale = true;
    c.warn(`${pendingCount} pending migration(s): ${[...pending.cli.map((m) => m.entry.id), ...pending.agent.map((e) => e.id)].join(', ')}`);
    console.log(`         Run \x1b[36mnpx groundwork-method update\x1b[0m — scripted ones run there; the rest land in the upgrade brief.`);
  }

  try {
    const brief = JSON.parse(fs.readFileSync(upgradeBriefPath(p), 'utf8'));
    const open = (brief.items || []).filter((i) => i.status === 'pending').length;
    if (open > 0) {
      stale = true;
      c.warn(`Unconsumed upgrade brief: ${open} item(s) await a working session — say \x1b[36m"upgrade groundwork"\x1b[0m to your agent.`);
    }
  } catch { /* no brief — nothing pending */ }

  if (!stale) c.ok(`Install is current with the framework.`);
  console.log('');
  return stale;
}

function checkGroundWork() {
  const p = getPaths();
  const docsDir = path.join(p.targetDir, 'docs');

  banner();

  // Framework staleness first — it needs no git history and tells the project it
  // has been left behind even when doc drift cannot run.
  const frameworkStale = reportFrameworkStatus(p);
  if (frameworkStale) process.exitCode = 1;

  // Drift detection compares last_reviewed against git history — without a repo,
  // every per-doc `git log` would fail with a cryptic error.
  try {
    execFileSync('git', ['rev-parse', '--git-dir'], { cwd: p.targetDir, stdio: 'ignore' });
  } catch {
    c.err(`groundwork check requires a git repository (drift detection reads git history).`);
    console.error(`  Run it from your project root, or \x1b[36mgit init\x1b[0m first.\n`);
    process.exitCode = 1;
    return;
  }

  // Code-map freshness — advisory, never fails the build (Serena/LLM fallbacks exist).
  reportRepoMapStatus(p);

  if (!fs.existsSync(docsDir)) {
    c.err(`No docs/ directory found in ${p.targetDir} — nothing to check.`);
    process.exitCode = 1;
    return;
  }

  // The drift-tracked set: code-coupled docs that carry source_of_truth frontmatter.
  const candidates = [];
  for (const sub of ['services', 'api', 'domain']) {
    const dir = path.join(docsDir, sub);
    if (!fs.existsSync(dir)) continue;
    for (const f of fs.readdirSync(dir)) {
      if (f.endsWith('.md')) candidates.push(path.join(dir, f));
    }
  }
  const archDoc = path.join(docsDir, 'architecture.md');
  if (fs.existsSync(archDoc)) candidates.push(archDoc);

  if (candidates.length === 0) {
    c.warn(`No drift-tracked docs found (docs/services/, docs/api/, docs/domain/, docs/architecture.md).`);
    console.log(`  Nothing to check yet — docs gain drift tracking once scaffold or brownfield adoption stamps them.\n`);
    return;
  }

  const stale = [];
  const current = [];
  const unassessed = [];

  for (const docPath of candidates) {
    const rel = path.relative(p.targetDir, docPath);
    const fm = parseFrontmatter(fs.readFileSync(docPath, 'utf8'));
    if (!fm || !fm.last_reviewed || !fm.source_of_truth) {
      unassessed.push({ rel, reason: !fm ? 'no frontmatter' : 'missing last_reviewed or source_of_truth' });
      continue;
    }
    const sources = fm.source_of_truth.split(/[;,]/).map((s) => s.trim()).filter(Boolean);
    let commits;
    try {
      commits = execFileSync(
        'git',
        ['log', `--since=${fm.last_reviewed}`, '--oneline', '--', ...sources],
        { cwd: p.targetDir, encoding: 'utf8' }
      ).trim();
    } catch (err) {
      c.err(`git log failed for ${rel}: ${err.message}`);
      process.exitCode = 2;
      return;
    }
    if (commits) {
      stale.push({ rel, fm, count: commits.split('\n').length });
    } else {
      current.push(rel);
    }
  }

  console.log(`Checked ${candidates.length} drift-tracked doc(s): \x1b[32m${current.length} current\x1b[0m, \x1b[31m${stale.length} stale\x1b[0m, \x1b[33m${unassessed.length} unassessed\x1b[0m\n`);

  if (stale.length > 0) {
    console.log(`\x1b[1mStale — code changed after last_reviewed:\x1b[0m`);
    const recovery = {
      generated: 're-run the generator that produced it',
      extracted: 'run the groundwork-update skill',
      authored: 'manual review required',
    };
    for (const s of stale) {
      const mode = s.fm.generation_mode || 'authored';
      console.log(`  \x1b[31m✖\x1b[0m ${s.rel} — ${s.count} commit(s) since ${s.fm.last_reviewed} → ${recovery[mode] || recovery.authored}`);
    }
    console.log('');
  }

  if (unassessed.length > 0) {
    console.log(`\x1b[1mUnassessed — cannot be drift-checked:\x1b[0m`);
    for (const u of unassessed) {
      console.log(`  \x1b[33m?\x1b[0m ${u.rel} (${u.reason})`);
    }
    console.log('');
  }

  if (stale.length > 0) {
    console.log(`Repair: ask your AI agent to run the \x1b[36mgroundwork-update\x1b[0m skill — it maps the`);
    console.log(`commits behind this report to surgical doc edits and gates them through review.`);
    console.log(`For dependency-graph-aware detection beyond file paths, run the \x1b[36mgroundwork-check\x1b[0m skill.\n`);
    process.exitCode = 1;
  } else {
    c.ok(`Documentation is current with the code it describes.\n`);
  }
}

// ─── repo-map ─────────────────────────────────────────────────────────────
// The deterministic code map: tree-sitter import edges + PageRank centrality,
// cached to .groundwork/cache/repo-map.json. Complements Serena — Serena answers
// precise per-symbol questions live; this is the whole-repo aggregate it cannot
// export. Engine lives in lib/repo-map so the CLI stays require-only.

function loadRepoMapEngine() {
  try {
    return require(path.join(__dirname, '..', 'lib', 'repo-map'));
  } catch (err) {
    c.err(`repo-map engine unavailable: ${err.message}`);
    console.error(`  The tree-sitter dependencies failed to load. Reinstall, or rely on`);
    console.error(`  the LLM-inference fallback path in the groundwork-scan skill.\n`);
    return null;
  }
}

// Advisory used by `check`: warn (never fail) when the cached map trails HEAD.
function reportRepoMapStatus(p) {
  const engine = loadRepoMapEngine();
  if (!engine) return;
  const s = engine.staleness({ cwd: p.targetDir, cacheDir: p.targetCacheDir });
  if (s.state === 'absent') return; // no map yet — not every project builds one
  if (s.state === 'stale') {
    c.warn(`Code map is stale — ${s.changedSource.length} source file(s) changed since it was generated.`);
    console.warn(`         Refresh with \x1b[36mnpx groundwork-method repo-map\x1b[0m (incremental — only changed files reparse).\n`);
  } else if (s.state === 'fresh') {
    c.ok(`Code map (repo-map.json) is current with HEAD.`);
  }
}

async function repoMapCommand(argv) {
  const p = getPaths();
  banner();
  const engine = loadRepoMapEngine();
  if (!engine) { process.exitCode = 1; return; }

  if (argv.includes('--check')) {
    const s = engine.staleness({ cwd: p.targetDir, cacheDir: p.targetCacheDir });
    if (s.state === 'absent') {
      c.warn(`No code map yet (.groundwork/cache/repo-map.json). Run \x1b[36mnpx groundwork-method repo-map\x1b[0m to build one.\n`);
    } else if (s.state === 'stale') {
      c.warn(`Code map is stale — ${s.changedSource.length} source file(s) changed since ${s.sinceCommit.slice(0, 8)}.`);
      console.warn(`         Refresh: \x1b[36mnpx groundwork-method repo-map\x1b[0m\n`);
    } else if (s.state === 'unknown') {
      c.info(`Code map freshness indeterminate (${s.reason}).\n`);
    } else {
      c.ok(`Code map is current with HEAD.\n`);
    }
    return; // advisory: never fails the build
  }

  const { map, cache, stats } = await engine.generate({ cwd: p.targetDir, cacheDir: p.targetCacheDir });
  if (map.stats.files === 0) {
    c.warn(`No supported source files found (Go, Python, TS/JS). Nothing to map.\n`);
    return;
  }
  engine.write({ cacheDir: p.targetCacheDir, map, cache });

  const langs = Object.entries(map.stats.languages).map(([l, n]) => `${l}:${n}`).join(' ');
  c.ok(`Wrote .groundwork/cache/repo-map.json — ${map.stats.files} files, ${map.stats.edges} edges (${langs})`);
  c.dim(`  ${stats.parsed} parsed, ${stats.cached} reused from cache`);
  if (map.centrality.length) {
    console.log(`\n\x1b[1mMost-referenced files (centrality):\x1b[0m`);
    for (const hub of map.centrality.slice(0, 5)) {
      console.log(`  ${hub.file} \x1b[2m(rank ${hub.rank}, ${hub.in} incoming)\x1b[0m`);
    }
  }
  console.log('');
}

// ─── Dispatch ───────────────────────────────────────────────────────────────

if (!command || command === 'help' || command === '--help' || command === '-h') {
  printHelp();
  process.exit(0);
}

switch (command) {
  case 'init': {
    const flags = parseInitFlags(process.argv.slice(3));
    if (flags.invalid.length) {
      c.warn(`Unknown agent(s) ignored: ${flags.invalid.join(', ')}`);
      console.warn(`         Supported: ${AGENT_KEYS.join(', ')}`);
    }
    initGroundWork(flags).catch((err) => {
      c.err(`init failed: ${err.message}`);
      process.exit(1);
    });
    break;
  }
  case 'update':
    updateGroundWork({ dryRun: process.argv.includes('--dry-run') });
    break;
  case 'check':
    // `check --help` documents behavior (incl. exit codes) instead of running.
    if (process.argv.includes('--help') || process.argv.includes('-h')) {
      printHelp();
      process.exit(0);
    }
    checkGroundWork();
    break;
  case 'repo-map':
    if (process.argv.includes('--help') || process.argv.includes('-h')) {
      printHelp();
      process.exit(0);
    }
    repoMapCommand(process.argv.slice(3)).catch((err) => {
      c.err(`repo-map failed: ${err.message}`);
      process.exit(1);
    });
    break;
  default:
    console.log(`Unknown command: ${command}`);
    printHelp();
    process.exit(1);
}
