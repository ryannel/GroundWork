#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const readline = require('readline');
const { execSync, execFileSync } = require('child_process');
const https = require('https');

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
            \x1b[2m--dry-run prints the full plan without writing anything; --full shows complete changelog entries.\x1b[0m
  \x1b[36mcheck\x1b[0m     Report framework staleness (version gap, pending migrations) and documentation drift
  \x1b[36mrepo-map\x1b[0m  Build the deterministic code map (.groundwork/cache/repo-map.json): a manifest-derived
            module graph (SwiftPM, Cargo, npm workspaces, .NET) + tree-sitter import edges with
            PageRank centrality (Go, Python, TS/JS, Java) plus a symbol index for many more
            languages; extensible per-project. Incremental — only changed files reparse.
            \x1b[2m--check reports staleness without rebuilding; --mermaid also renders the module graph;\x1b[0m
            \x1b[2m--conventions also emits the deterministic project-conventions digest (conventions.md).\x1b[0m
  \x1b[36mpolicy\x1b[0m    Print the resolved additive policy layer (policy.toml + policy.user.toml) as JSON
  \x1b[36mgate\x1b[0m      Mechanical delivery gates (fail-closed): gate readiness | gate decomposition --bet <slug>.
            \x1b[2mfiles exist, slice links + meta pages resolve, Proof-of-work + Test file named, approved tag present.\x1b[0m
  \x1b[36mseal\x1b[0m      seal verify --bet <slug>: the sealed prose (decomposition + technical-design) still matches
            the bet/<slug>/approved tag. Non-zero on undeclared drift — the mechanical prose-integrity check.
  \x1b[36mfindings\x1b[0m  Per-bet findings ledger (.groundwork/bets/<slug>/findings.json): add | disposition | check | list.
            \x1b[2mcheck exits non-zero on any open finding — the mechanical milestone-close gate.\x1b[0m
  \x1b[36mdecisions\x1b[0m Per-bet default+veto queue (.groundwork/bets/<slug>/decisions.json): add | pending | ratify | list.
            \x1b[2mratify records the owner's verbatim response as durable state; the approved tag moves only here.\x1b[0m
  \x1b[36mhonesty\x1b[0m   scan --bet <slug>: the computable half of the milestone honesty audit, diffed against
            bet/<slug>/approved — deleted/thinned test guards, hand-edits inside generated files,
            zero-caller exports (best-effort). Findings are leads for the audit agent, not verdicts.
            \x1b[2mExits 0 clean / 1 leads / 2 no tag or not a git repo; --json for machine output.\x1b[0m
  \x1b[36mwiring\x1b[0m    scan --bet <slug>: built-but-never-wired controls, diffed against bet/<slug>/approved —
            interactive bindings whose handler body is empty or TODO-only, plus handler-shaped
            functions with no reachable caller (best-effort). Leads for the review wave, not verdicts.
            \x1b[2mExits 0 clean / 1 leads / 2 no tag or not a git repo; --json for machine output.\x1b[0m
  \x1b[36mmutate\x1b[0m    --bet <slug> --slice <test-file> -- <test command...>: the deletion test, mechanized —
            revert the slice's source changes to bet/<slug>/approved (tests stay at HEAD), run the
            test command, demand red. Green-after-deletion = the tests do not bite (exit 1).
            \x1b[2mRefuses to run on a dirty working tree (exit 2) — never stashes or destroys uncommitted
            work; every reverted file is restored to HEAD unconditionally. --since <sha> scopes the
            revert to one slice's commit range; --timeout <s> (default 120); --json for machines.\x1b[0m
  \x1b[36mtokens\x1b[0m    scan --bet <slug>: mechanical token-conformance scan over UI source files changed since
            bet/<slug>/approved — raw color/font/spacing/motion literals that bypass the project's
            design-token set (tailwind config, token/theme files, CSS custom properties). Findings
            are leads for slice review, not verdicts.
            \x1b[2mExits 0 clean / 1 findings / 2 no tag or not a git repo; --json for machine output.\x1b[0m
  \x1b[36mpack\x1b[0m      Milestone context pack (.groundwork/cache/bets/<slug>/milestone-<NN>-context.md): build | refresh | check.
            \x1b[2mPointers and learnings, never contract text. Stale = compiled_from ≠ the approved-tag sha;
            refresh regenerates (preserving the driver-notes block), check is the CI-safe probe (exit 1 = stale/missing).\x1b[0m
  \x1b[36mstate\x1b[0m     --bet <slug>: the composed bet-state view — seal, findings, decisions, pack freshness,
            board pointer, in one document. \x1b[2m--check exits 1 on seal drift, open findings, or a stale
            pack (the aggregate gate); the board and pitch status report but never gate. --json for machines.\x1b[0m
  \x1b[36mstatus\x1b[0m    [--bet <slug>]: the ready-to-paste checkpoint snapshot — program (delivered, in flight,
            queued, patches), the bet's goal and milestone ladder, and the current milestone's slices.
            \x1b[2mRenders from committed truth only (suite + git + pitch frontmatter + decomposition prose);
            never reads board.yaml. --bet is optional when exactly one bet is in flight. --json for machines.\x1b[0m
  \x1b[36mhelp\x1b[0m      Show this message

\x1b[1minit flags:\x1b[0m
  \x1b[36m--agent <name>\x1b[0m   Wire a specific agent (repeatable, comma-friendly); skips the prompt
  \x1b[36m--yes, -y\x1b[0m        Non-interactive: wire the auto-detected agents (or Claude Code)
  \x1b[36m--set key=value\x1b[0m  Seed a config.toml default at install time (repeatable; e.g. defaults.stack=go)
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
    targetHiddenSkillsDir: path.join(targetDir, '.groundwork', 'skills'),
    targetConfigDir: path.join(targetDir, '.groundwork', 'config'),
    targetCacheDir: path.join(targetDir, '.groundwork', 'cache'),
    sourceSkillsDir: path.join(__dirname, '..', 'src', 'skills'),
    sourceHiddenSkillsDir: path.join(__dirname, '..', 'src', 'hidden-skills'),
    sourceConfigDir: path.join(__dirname, '..', 'src', 'config'),
    sourceDocsDir: path.join(__dirname, '..', 'src', 'docs'),
    sourceAgentsMd: path.join(__dirname, '..', 'src', 'AGENTS.md'),
    sourceDevBundle: path.join(__dirname, '..', 'src', 'generators', 'workspace-dev-cli', 'cli-src', 'dist', 'dev-bundle.js'),
    sourceDevLauncher: path.join(__dirname, '..', 'src', 'generators', 'workspace-dev-cli', 'files', 'dev.template'),
    sourceCaptureHook: path.join(__dirname, '..', 'src', 'hooks', 'capture-reminder.js'),
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

// Reduces a `### Category (headline, date)` section header to a scannable label.
// Older bare `### Category` headers (and the `[no-migration]` backtick tag some
// headers carry, optionally scoped to a surface group — `[no-migration: dev-cli]`)
// degrade to just the category word.
function changelogHeadline(header) {
  const body = header
    .slice(4)
    .replace(/\s*`\[(?:no-)?migration(?::[^\]]*)?\]`\s*$/i, '')
    .trim();
  const m = body.match(/^(\w+)\s*\(([\s\S]*)\)\s*$/);
  if (!m) return { category: body.split(/\s+/)[0] || body, text: null };
  const text = m[2].replace(/,\s*\d{4}-\d{2}-\d{2}\s*$/, '').trim();
  return { category: m[1], text };
}

// Collects the genuine `- [migration]` bullets from a slice's lines. Matches only
// bullet-leading tokens, not prose that mentions `[migration]` in passing (e.g. the
// upgrade-path note that the token references registry ids) — that false match used
// to leak a stray, prefix-stripped line into the "Migration required" list. The
// token may carry a repo-internal surface-group scope (`[migration: dev-cli]`);
// it means nothing to users, so the strip swallows it.
function collectMigrations(entries) {
  const out = [];
  for (const e of entries) {
    for (const line of e.lines) {
      if (/^\s*-\s*\[migration(?::[^\]]*)?\]/i.test(line)) {
        out.push(line.trim().replace(/^-\s*\[migration(?::[^\]]*)?\]\s*/i, ''));
      }
    }
  }
  return out;
}

// Prints the changelog entries in (fromVersion, toVersion]. By default it renders a
// scannable one-line-per-change summary; `full` dumps the entry bodies verbatim.
// Genuine [migration] bullets are always surfaced separately.
function printChangelogSlice(fromVersion, toVersion, full = false) {
  const entries = parseChangelog().filter(
    (e) =>
      semverCompare(e.version, toVersion) <= 0 &&
      (fromVersion === null || semverCompare(e.version, fromVersion) > 0)
  );
  if (entries.length === 0) return;

  console.log(`\x1b[1mWhat changed:\x1b[0m`);
  if (full) {
    for (const e of entries) {
      console.log(`\n  \x1b[1m${e.version}\x1b[0m \x1b[2m(${e.date})\x1b[0m`);
      for (const line of e.lines) {
        if (!line.trim()) continue;
        if (line.startsWith('### ')) console.log(`    \x1b[1m${line.slice(4)}\x1b[0m`);
        else console.log(`    ${line}`);
      }
    }
  } else {
    for (const e of entries) {
      const headlines = e.lines.filter((l) => l.startsWith('### ')).map(changelogHeadline);
      const n = headlines.length;
      console.log(
        `\n  \x1b[1m${e.version}\x1b[0m \x1b[2m(${e.date}` +
          (n ? ` · ${n} change${n === 1 ? '' : 's'}` : '') +
          `)\x1b[0m`
      );
      for (const { category, text } of headlines) {
        const label = text ? `\x1b[1m${category}\x1b[0m ${text}` : `\x1b[1m${category}\x1b[0m`;
        console.log(`    \x1b[2m•\x1b[0m ${label}`);
      }
    }
    console.log(
      `\n  \x1b[2mFull detail in CHANGELOG.md — or re-run with \x1b[0m\x1b[36m--full\x1b[0m\x1b[2m for the complete entries.\x1b[0m`
    );
  }

  const migrations = collectMigrations(entries);
  if (migrations.length > 0) {
    console.log(`\n\x1b[33m\x1b[1m⚠ Migration required:\x1b[0m`);
    for (const m of migrations) console.log(`  \x1b[33m- ${m}\x1b[0m`);
  }
  console.log('');
}

// OS/editor junk that must never deploy into a project or enter the manifest.
// The name set is unambiguous and safe to DELETE anywhere; `*~` (editor backups)
// is only safe to FILTER on walks — a user's `notes.md~` in a shared tree must
// never be deleted, so removeJunkFiles takes a conservative mode.
const JUNK_FILE_NAMES = new Set(['.DS_Store', 'Thumbs.db', 'desktop.ini']);

function isJunkFile(name) {
  return JUNK_FILE_NAMES.has(name) || name.endsWith('~');
}

// Scrub junk after a raw `cp -R` (which copies everything in the source tree,
// npm-linked dev checkouts included). conservative=true restricts deletion to
// the unambiguous names — use it on trees that also hold user-authored files.
function removeJunkFiles(dir, { conservative = false } = {}) {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      removeJunkFiles(full, { conservative });
    } else if (conservative ? JUNK_FILE_NAMES.has(entry.name) : isJunkFile(entry.name)) {
      fs.rmSync(full, { force: true });
    }
  }
}

function walkFiles(dir, base) {
  // Returns relative file paths under dir, sorted for stable diff output.
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (isJunkFile(entry.name)) continue;
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
      '(hash-classified: pristine refreshes, edited queues for the groundwork-update skill). ' +
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
  pushTree(p.sourceHiddenSkillsDir, path.join('.groundwork', 'skills'), 1);
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
// groundwork-update skill; absent files are copied as before.

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
// is the merge base the update skill reasons against (decision O5).
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
// migrations/index.json ships in the package. Every registry entry is a scripted
// `cli` migration — mechanical, forward-only, idempotent, detect-first file ops run
// inside update. Structural/judgment advancement is no longer a per-change migration:
// the groundwork-update skill reconciles each artifact family to the current canonical.
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

// Partition unrecorded registry entries into work. The registry is cli-only now:
// each entry is asked via its detect(). Structural advancement moved out of the
// registry to the groundwork-update skill's reconcile pass.
function pendingMigrations(p, registry) {
  const done = new Set(readCompletedMigrations(p));
  const ctx = { targetDir: p.targetDir, packageRoot: path.resolve(__dirname, '..') };
  const cli = [];
  const settled = []; // detect said done/n-a — record so detect isn't re-asked forever
  for (const entry of registry.entries) {
    if (done.has(entry.id)) continue;
    if (entry.kind !== 'cli') continue; // registry is cli-only; ignore stray kinds
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
  }
  return { cli, settled };
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
// The file-level judgment work — edited tier-2 merges, a customized launcher,
// generator-output reconciliation — is compiled into a brief the groundwork-update
// skill works through conversationally (its Phase A). Incoming content is copied
// into .groundwork/cache so the skill needs nothing from the npx package cache.
// Structural advancement is the skill's Phase B reconcile, not a brief item.

function upgradeBriefPath(p) {
  return path.join(p.targetDir, '.groundwork', 'cache', 'upgrade-brief.json');
}

function buildBriefItems(p, tier2, devCli, manifest) {
  const items = [];
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

// Item types the groundwork-update skill's Phase A still executes. A brief written
// before the agent-migration retirement can carry orphaned `agent-migration` items
// (their work is now the skill's Phase B reconcile); they are pruned on the next
// update so the skill is never handed a type it cannot run.
const SUPPORTED_BRIEF_ITEM_TYPES = new Set(['tier2-merge', 'tier1-custom', 'regenerate']);

// Normalize a pre-cutover brief on disk: clear the orphaned agent-migration payload
// cache, drop items whose type the current skill can't run, and delete the brief
// when nothing supported survives. Idempotent and safe when no brief exists. Called
// on both update paths so a stale brief is cleaned even when nothing else changed.
function pruneStaleBrief(p) {
  // The briefs/ cache staged agent-migration payloads only; the current brief never
  // writes there, so a lingering dir is orphaned by the retirement.
  const orphanedBriefs = path.join(p.targetDir, '.groundwork', 'cache', 'upgrade', 'briefs');
  if (fs.existsSync(orphanedBriefs)) fs.rmSync(orphanedBriefs, { recursive: true, force: true });

  const briefPath = upgradeBriefPath(p);
  if (!fs.existsSync(briefPath)) return;
  let brief;
  try { brief = JSON.parse(fs.readFileSync(briefPath, 'utf8')); }
  catch { return; } // corrupt brief — leave for writeUpgradeBrief to rebuild
  if (!brief || !Array.isArray(brief.items)) return;

  const kept = brief.items.filter((i) => SUPPORTED_BRIEF_ITEM_TYPES.has(i.type));
  if (kept.length === brief.items.length) return; // nothing to prune
  if (kept.length === 0) {
    // Pruning emptied the brief — remove it so `check` and the skill don't see a
    // phantom work list.
    fs.rmSync(briefPath, { force: true });
    return;
  }
  brief.items = kept;
  fs.writeFileSync(briefPath, JSON.stringify(brief, null, 2) + '\n');
}

// Write the brief (merging an existing one by item id — completed work survives)
// and stage every referenced payload into the cache.
function writeUpgradeBrief(p, items, stamped) {
  pruneStaleBrief(p); // normalize any pre-cutover brief before merging into it
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
    if (item.type === 'tier2-merge') {
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

// Top-level skill names under .agents/skills/ that the framework owns, per the manifest:
// the first path segment of every tier-1 .agents/skills/<name>/... entry. Used to prune
// framework skills that a past version shipped but the current one dropped. Returns [] for
// a null/empty manifest (older or adopted installs) — in that case only currently-shipped
// names are pruned, which can leave a since-removed framework skill lingering once. That is
// strictly safer than the alternative: deleting a project-authored skill we don't recognize.
function frameworkSkillNamesFromManifest(manifest) {
  const names = new Set();
  const files = (manifest && manifest.files) || {};
  for (const [rel, entry] of Object.entries(files)) {
    if (!entry || entry.tier !== 1) continue;
    const m = rel.replace(/\\/g, '/').match(/^\.agents\/skills\/([^/]+)\//);
    if (m) names.add(m[1]);
  }
  return [...names];
}

// The top-level .agents/skills/ entries the framework owns — the ONLY ones an update may
// remove. Owned = names the framework ships in EITHER tree (registered src/skills/ ∪ hidden
// src/hidden-skills/ — a hidden skill must never linger here after the .groundwork/skills
// relocation) ∪ tier-1 skills the manifest remembers (to prune a registered skill a past
// version shipped and this one dropped). Promoted engineer skills (separate src/engineer-skills/
// tree) and any project-authored skill match none of these, so they are preserved. Both the
// installer and the update report read ownership from here, so the report can never claim a
// removal the install won't perform. Pass the already-loaded manifest to avoid re-reading it.
function ownedRegisteredSkillNames(p, manifest) {
  // Junk filtered so a stray src/skills/.DS_Store never counts as an owned skill name.
  const list = (dir) => (fs.existsSync(dir) ? fs.readdirSync(dir).filter((n) => !isJunkFile(n)) : []);
  const shipped = list(p.sourceSkillsDir);
  const hidden = list(p.sourceHiddenSkillsDir);
  const m = manifest === undefined ? readManifest(p) : manifest;
  return new Set([...shipped, ...hidden, ...frameworkSkillNamesFromManifest(m)]);
}

// The registered-tree diff, scoped to what installRegisteredSkills actually does: removals are
// limited to files under framework-owned skill names. An authored skill (e.g. groundwork-swift-
// engineer) lives outside that set, so the install leaves it untouched — and the report must not
// flag its files as removed, which would read as "your skill is being deleted" when it isn't.
function diffRegisteredSkills(p, manifest) {
  const diff = diffDirs(p.sourceSkillsDir, p.targetSkillsDir);
  const owned = ownedRegisteredSkillNames(p, manifest);
  diff.removed = diff.removed.filter((f) => owned.has(f.split(path.sep)[0]));
  return diff;
}

// .agents/skills/ is a SHARED directory: framework skills sit beside engineer skills the
// scaffold promotes (tracked in manifest.generated) and any project-authored skills. We must
// remove ONLY framework-owned top-level entries — never the whole tree — so an update can't
// delete an authored skill (see ownedRegisteredSkillNames). Throws on copy failure — callers
// abort over a partial install.
function installRegisteredSkills(p) {
  const dest = p.targetSkillsDir;
  const shipped = fs.existsSync(p.sourceSkillsDir) ? fs.readdirSync(p.sourceSkillsDir) : [];
  const owned = ownedRegisteredSkillNames(p);
  fs.mkdirSync(dest, { recursive: true });
  for (const name of owned) {
    fs.rmSync(path.join(dest, name), { recursive: true, force: true });
  }
  if (shipped.length) {
    try {
      execSync(`cp -R "${p.sourceSkillsDir}/"* "${dest}/"`);
    } catch (err) {
      throw new Error(`Failed to install registered skills: ${err.message}`);
    }
  }
  // The shell copy takes everything, junk included; the tree is shared with
  // user-authored skills, so only the unambiguous names are swept.
  removeJunkFiles(dest, { conservative: true });
}

// The hidden methodology tree is exclusively framework-owned — nothing else is allowed to
// live there — so a wholesale clean-replace is safe and prunes deprecated skills. Throws on
// copy failure for the same reason as installRegisteredSkills.
function installHiddenSkills(p) {
  const dest = p.targetHiddenSkillsDir;
  if (fs.existsSync(dest)) {
    try {
      fs.rmSync(dest, { recursive: true, force: true });
    } catch (err) {
      c.warn(`Failed to clean hidden methodology skills dir: ${err.message}`);
    }
  }
  fs.mkdirSync(dest, { recursive: true });
  try {
    execSync(`cp -R "${p.sourceHiddenSkillsDir}/"* "${dest}/"`);
  } catch (err) {
    throw new Error(`Failed to install hidden methodology skills: ${err.message}`);
  }
  // Exclusively framework-owned tree — the full junk predicate applies.
  removeJunkFiles(dest);
}

// Install both skill trees. The registered tree (.agents/skills/) is cleaned per-skill so
// promoted engineer skills and project-authored skills survive; the hidden tree is clean-replaced.
function installSkillTrees(p) {
  installRegisteredSkills(p);
  installHiddenSkills(p);
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
// The host registry is data, kept in src/config/hosts.json so detect/wire/prompt stay
// data-driven and the matrix in docs/host-support.md has a single machine-readable source.
// Each host either symlinks to the canonical files (`links[]`) or reads them natively —
// there is deliberately no body-template or copy semantics in the schema.
const AGENT_ADAPTERS = Object.fromEntries(
  JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'src', 'config', 'hosts.json'), 'utf8'))
    .hosts.map((h) => [h.key, h])
);
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
    for (const l of a.links || []) {
      if (l.type === 'junction') {
        linkOne(targetDir, l.link, l.target, 'junction');
      } else if (fs.existsSync(path.join(targetDir, l.target))) {
        // A file symlink only fires once its canonical target (AGENTS.md) exists (init generates it first).
        linkOne(targetDir, l.link, l.target);
      }
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
    const dirLink = (a.links || []).find((l) => l.type === 'junction');
    const fileLink = (a.links || []).find((l) => l.type !== 'junction');
    const claudeDetected = detected.includes(only);
    const nativeDetected = AGENT_KEYS.some((k) => AGENT_ADAPTERS[k].native && detected.includes(k));
    // Default yes unless a native tool is the only thing we detected (then they're already set up).
    const defaultYes = claudeDetected || !nativeDetected;

    // Lead with the consequence: the native tools already work, so the question is only about
    // Claude Code — and a "yes" is the one answer that writes files.
    const nativeList = nativeLabels.length > 1
      ? `${nativeLabels.slice(0, -1).join(', ')}, and ${nativeLabels[nativeLabels.length - 1]}`
      : nativeLabels[0] || '';
    console.log(`\n\x1b[1mGroundWork keeps all your project guidance in ${fileLink.target} and the ${dirLink.target}/ folder.\x1b[0m`);
    if (nativeList) {
      console.log(`  \x1b[32m✓\x1b[0m \x1b[2m${nativeList} read them automatically — nothing to set up.\x1b[0m`);
    }
    console.log(`  \x1b[2m${a.label} looks for ${fileLink.link} / ${dirLink.link}/ instead, so it needs links to them.\x1b[0m`);

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

// Parse `--agent <key>` / `--agent=<key>` (repeatable, comma-friendly), `--yes`/`-y`, and
// `--set key=value` (repeatable — seeds config.toml at install time).
function parseInitFlags(argv) {
  const requested = [];
  const sets = [];
  const badSets = [];
  let yes = false;
  const addSet = (raw) => {
    const eq = raw.indexOf('=');
    if (eq <= 0) { badSets.push(raw); return; }
    sets.push({ key: raw.slice(0, eq).trim(), value: raw.slice(eq + 1) });
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--yes' || arg === '-y') {
      yes = true;
    } else if (arg === '--agent' || arg === '--agents') {
      const val = argv[i + 1];
      if (val && !val.startsWith('-')) { requested.push(...val.split(',')); i++; }
    } else if (arg.startsWith('--agent=') || arg.startsWith('--agents=')) {
      requested.push(...arg.slice(arg.indexOf('=') + 1).split(','));
    } else if (arg === '--set') {
      const val = argv[i + 1];
      if (val !== undefined && !val.startsWith('--')) { addSet(val); i++; }
      else badSets.push('--set (missing key=value)');
    } else if (arg.startsWith('--set=')) {
      addSet(arg.slice('--set='.length));
    }
  }
  const normalized = requested.map((s) => s.trim()).filter(Boolean);
  return {
    agents: normalized.filter((a) => AGENT_ADAPTERS[a]),
    invalid: normalized.filter((a) => !AGENT_ADAPTERS[a]),
    sets,
    badSets,
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
// force-multiplier, never a hard dependency. --open-web-dashboard false stops Serena's
// browser tab popping on every MCP launch (the user-level serena_config.yml default);
// the dashboard itself stays up and manually reachable.
const SERENA_MCP_SERVER = {
  command: 'uvx',
  args: ['--from', 'serena-agent==1.5.3', 'serena', 'start-mcp-server', '--context', 'ide-assistant', '--project', '.', '--open-web-dashboard', 'false'],
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

// Approve the project-scoped Serena server in the committed .claude/settings.json.
// Claude Code asks per-user whether to enable .mcp.json servers and saves the answer to
// .claude/settings.local.json — a write that fails through the .claude → .agents dir
// symlink, so the prompt returns every session ("could not be saved … you will be asked
// again next startup"). Approving in the committed file sidesteps the prompt for everyone
// on the project, and every worktree inherits it. Idempotent; other entries preserved.
function mergeSerenaEnableSettings(settingsPath) {
  let settings = {};
  if (fs.existsSync(settingsPath)) {
    try {
      settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8')) || {};
    } catch {
      c.warn(`Could not parse ${path.basename(settingsPath)} — left it untouched; add "serena" to enabledMcpjsonServers by hand.`);
      return false;
    }
  }
  const enabled = Array.isArray(settings.enabledMcpjsonServers) ? settings.enabledMcpjsonServers : [];
  if (enabled.includes('serena')) return false; // user keeps their config; we never duplicate
  settings.enabledMcpjsonServers = [...enabled, 'serena'];
  fs.mkdirSync(path.dirname(settingsPath), { recursive: true });
  fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + '\n');
  return true;
}

// Only acts for a Claude Code install — enabledMcpjsonServers is a Claude Code settings
// key, and native-only installs have no .claude dir to write into. Same gate as the
// capture hook: the wired-agent set, falling back to the presence of a .claude dir.
function enableSerenaMcp(p, selectedKeys) {
  const wantsClaude = (selectedKeys && selectedKeys.includes('claude-code')) || fs.existsSync(path.join(p.targetDir, '.claude'));
  if (!wantsClaude) return;
  try {
    const added = mergeSerenaEnableSettings(path.join(p.targetDir, '.claude', 'settings.json'));
    if (added) c.ok(`Approved the Serena MCP server for Claude Code (.claude/settings.json)`);
  } catch (err) {
    c.warn(`Could not approve the Serena MCP server in settings: ${err.message}`);
  }
}

// ─── Capture reminder hook (quick-bet lane WS-A) ────────────────────────────
// GroundWork's front door only works if a build/change/fix request actually
// reaches the orchestrator. Soft instructions (AGENTS.md, the orchestrator
// description) fire reliably only on a fresh session; mid-session a direct
// imperative tends to get satisfied directly. This seeds a non-blocking Claude
// Code PreToolUse hook that, on an Edit/Write outside any active GroundWork lane,
// adds a one-line reminder to route the work through the orchestrator. It never
// blocks the edit. Claude Code-specific — native agents (Cursor/Codex/Cline) do
// not run it, so for them capture stays soft (a documented residual).

const CAPTURE_HOOK_COMMAND = 'node "$CLAUDE_PROJECT_DIR/.groundwork/hooks/capture-reminder.js"';

// Merge our PreToolUse entry into the project's .claude/settings.json without
// disturbing other hooks. Idempotent: re-running detects our command and skips.
// .claude resolves through the Claude Code dir symlink to .agents/, the shared
// committed tree, so the hook applies to everyone on the project.
function mergeCaptureHookSettings(settingsPath) {
  let settings = {};
  if (fs.existsSync(settingsPath)) {
    try {
      settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8')) || {};
    } catch {
      c.warn(`Could not parse ${path.basename(settingsPath)} — left it untouched; add the capture hook by hand.`);
      return false;
    }
  }
  if (!settings.hooks || typeof settings.hooks !== 'object') settings.hooks = {};
  const pre = Array.isArray(settings.hooks.PreToolUse) ? settings.hooks.PreToolUse : [];
  const already = pre.some(
    (g) => Array.isArray(g && g.hooks) && g.hooks.some((h) => h && typeof h.command === 'string' && h.command.includes('capture-reminder'))
  );
  if (already) return false; // user keeps their config; we never duplicate
  pre.push({ matcher: 'Edit|Write', hooks: [{ type: 'command', command: CAPTURE_HOOK_COMMAND }] });
  settings.hooks.PreToolUse = pre;
  fs.mkdirSync(path.dirname(settingsPath), { recursive: true });
  fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + '\n');
  return true;
}

// Seed the hook script into .groundwork/hooks/ (always refreshed — framework-owned)
// and wire it into .claude/settings.json. Only acts for a Claude Code install:
// gated on the wired-agent set, falling back to the presence of a .claude dir so a
// re-run/update still seeds it. Best-effort: any failure warns, never aborts.
function seedCaptureHook(p, selectedKeys) {
  const wantsClaude = (selectedKeys && selectedKeys.includes('claude-code')) || fs.existsSync(path.join(p.targetDir, '.claude'));
  if (!wantsClaude) return;
  if (!fs.existsSync(p.sourceCaptureHook)) return;
  try {
    const hookDir = path.join(p.targetDir, '.groundwork', 'hooks');
    fs.mkdirSync(hookDir, { recursive: true });
    const dest = path.join(hookDir, 'capture-reminder.js');
    fs.copyFileSync(p.sourceCaptureHook, dest);
    fs.chmodSync(dest, 0o755);
    const added = mergeCaptureHookSettings(path.join(p.targetDir, '.claude', 'settings.json'));
    if (added) c.ok(`Seeded the capture reminder hook (.claude/settings.json)`);
  } catch (err) {
    c.warn(`Could not seed the capture reminder hook: ${err.message}`);
  }
}

// ─── init ───────────────────────────────────────────────────────────────────

// The `--set key=value` allowlist is derived from the seed template itself: every scalar
// assignment it shows (commented example or active) is a settable key, dotted by its section.
// Deriving the allowlist from the template means it can never drift from what config.toml
// actually supports.
function settableConfigKeys(templateText) {
  const allowed = new Map(); // "section.key" -> { section, key }
  let section = '';
  for (const raw of templateText.split('\n')) {
    const line = raw.trim();
    const sec = line.match(/^\[([^\]]+)\]$/);
    if (sec) { section = sec[1]; continue; }
    const kv = line.replace(/^#\s*/, '').match(/^([A-Za-z0-9_.\-"]+)\s*=/);
    if (kv && section) {
      const key = kv[1].replace(/"/g, '');
      allowed.set(`${section}.${key}`, { section, key });
    }
  }
  return allowed;
}

function renderTomlValue(v) {
  if (v === 'true' || v === 'false') return v;
  if (/^-?\d+(\.\d+)?$/.test(v)) return v;
  return `"${v.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

// Apply `--set` pairs to the seed template, returning the rewritten text or a list of
// errors. A key must be in the template-derived allowlist; prototype-pollution tokens are
// rejected outright. Returns { text, errors } — text is null when any set is invalid, so a
// bad --set fails the whole seed rather than half-writing.
function applyConfigSets(templateText, sets) {
  const allowed = settableConfigKeys(templateText);
  const errors = [];
  const bySection = new Map(); // section -> Map(key -> "key = value")
  for (const { key: dotted, value } of sets) {
    if (/(^|\.)(__proto__|prototype|constructor)(\.|$)/.test(dotted)) {
      errors.push(`unsafe key rejected: ${dotted}`);
      continue;
    }
    const entry = allowed.get(dotted);
    if (!entry) {
      errors.push(`unknown config key: ${dotted}`);
      continue;
    }
    if (!bySection.has(entry.section)) bySection.set(entry.section, new Map());
    bySection.get(entry.section).set(entry.key, `${entry.key} = ${renderTomlValue(value)}`);
  }
  if (errors.length) return { text: null, errors };

  let section = '';
  const applied = new Set();
  const out = templateText.split('\n').map((raw) => {
    const t = raw.trim();
    const sec = t.match(/^\[([^\]]+)\]$/);
    if (sec) { section = sec[1]; return raw; }
    const secMap = bySection.get(section);
    if (!secMap) return raw;
    const kv = t.replace(/^#\s*/, '').match(/^([A-Za-z0-9_.\-"]+)\s*=/);
    if (kv) {
      const key = kv[1].replace(/"/g, '');
      const id = `${section}.${key}`;
      if (secMap.has(key) && !applied.has(id)) {
        applied.add(id);
        return secMap.get(key);
      }
    }
    return raw;
  });
  return { text: out.join('\n'), errors };
}

// ── Policy layer (vendored TOML subset) ──────────────────────────────────────
// A deliberately small TOML reader for the additive policy files (decision §10.1:
// vendor the parser so the dependency-free CLI can validate and resolve policy).
// It handles the declared v1 surface only: `[table]` and `[[array.of.tables]]`
// headers with dotted names, `key = "string" | number | true/false`, and
// `key = ["multi", "line", "arrays"]`. Anything outside that surface throws — a
// parse error the user sees from `groundwork check`.
function parsePolicyToml(text) {
  const root = {};
  const descend = (parts) => parts.reduce((o, k) => (o[k] = o[k] || {}), root);
  const parseScalar = (raw) => {
    const s = raw.trim();
    if (/^".*"$/.test(s)) return s.slice(1, -1).replace(/\\"/g, '"').replace(/\\\\/g, '\\');
    if (s === 'true') return true;
    if (s === 'false') return false;
    if (/^-?\d+(\.\d+)?$/.test(s)) return Number(s);
    throw new Error(`unsupported value: ${s}`);
  };
  const parseArray = (body) =>
    body.split(',').map((x) => x.trim()).filter((x) => x.length).map(parseScalar);

  let cur = root;
  const lines = text.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    let line = lines[i].trim();
    if (!line || line.startsWith('#')) continue;   // blank or full-comment line
    // Strip an inline comment only when the line carries no quoted string — a value
    // may legitimately contain a '#' inside quotes.
    if (!line.includes('"') && line.includes('#')) line = line.slice(0, line.indexOf('#')).trim();
    if (!line) continue;
    let m;
    if ((m = line.match(/^\[\[(.+)\]\]$/))) {
      const parts = m[1].split('.').map((s) => s.trim());
      const key = parts.pop();
      const parent = descend(parts);
      parent[key] = parent[key] || [];
      const obj = {};
      parent[key].push(obj);
      cur = obj;
    } else if ((m = line.match(/^\[(.+)\]$/))) {
      cur = descend(m[1].split('.').map((s) => s.trim()));
    } else if ((m = line.match(/^([A-Za-z0-9_"-]+)\s*=\s*(.*)$/))) {
      const key = m[1].replace(/"/g, '');
      let val = m[2].trim();
      if (val.startsWith('[')) {
        // Arrays may span lines — accumulate until the closing bracket.
        while (!val.includes(']') && i + 1 < lines.length) {
          i += 1;
          let nxt = lines[i].trim();
          if (nxt.startsWith('#')) continue;   // comment line inside the array
          if (!nxt.includes('"') && nxt.includes('#')) nxt = nxt.slice(0, nxt.indexOf('#')).trim();
          val += ' ' + nxt;
        }
        cur[key] = parseArray(val.slice(val.indexOf('[') + 1, val.lastIndexOf(']')));
      } else {
        cur[key] = parseScalar(val);
      }
    } else {
      throw new Error(`unparseable policy line: ${line}`);
    }
  }
  return root;
}

// Merge team then user policy: scalars — user wins; arrays — concatenate, team first.
function mergePolicy(team, user) {
  const out = {};
  const keys = new Set([...Object.keys(team || {}), ...Object.keys(user || {})]);
  for (const k of keys) {
    const t = team ? team[k] : undefined;
    const u = user ? user[k] : undefined;
    if (Array.isArray(t) || Array.isArray(u)) out[k] = [...(t || []), ...(u || [])];
    else if (t && typeof t === 'object' && u && typeof u === 'object') out[k] = mergePolicy(t, u);
    else out[k] = u !== undefined ? u : t;
  }
  return out;
}

function resolvePolicy(targetConfigDir) {
  const read = (name) => {
    const f = path.join(targetConfigDir, name);
    return fs.existsSync(f) ? parsePolicyToml(fs.readFileSync(f, 'utf8')) : {};
  };
  return mergePolicy(read('policy.toml'), read('policy.user.toml'));
}

// Validate both policy files: parse errors, broken `file:` refs, missing lens brief
// paths, and unknown top-level keys named. Returns a list of problem strings.
function validatePolicy(targetDir, targetConfigDir) {
  const problems = [];
  const known = new Set(['facts', 'lenses', 'checklists', 'phases']);
  for (const name of ['policy.toml', 'policy.user.toml']) {
    const f = path.join(targetConfigDir, name);
    if (!fs.existsSync(f)) continue;
    let parsed;
    try { parsed = parsePolicyToml(fs.readFileSync(f, 'utf8')); }
    catch (err) { problems.push(`${name}: parse error — ${err.message}`); continue; }
    for (const key of Object.keys(parsed)) {
      if (!known.has(key)) problems.push(`${name}: unknown key [${key}] (known: ${[...known].join(', ')})`);
    }
    for (const item of (parsed.facts && parsed.facts.items) || []) {
      if (typeof item === 'string' && item.startsWith('file:')) {
        const rel = item.slice('file:'.length);
        if (!fs.existsSync(path.join(targetDir, rel))) problems.push(`${name}: [facts] file: ref does not resolve — ${rel}`);
      }
    }
    for (const lens of (parsed.lenses && parsed.lenses.slice) || []) {
      if (!lens.brief || !fs.existsSync(path.join(targetDir, lens.brief))) {
        problems.push(`${name}: [[lenses.slice]] "${lens.name || '?'}" brief path missing — ${lens.brief || '(none)'}`);
      }
    }
  }
  return problems;
}

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

  // The cache is transient by design — repo-map, drafts, hand-offs, and the per-bet
  // working state (board.yaml, memlog, packs) never belong in git. Seed a .gitignore that
  // ignores everything under it but itself, so the rule ships and self-heals.
  const cacheIgnore = path.join(p.targetCacheDir, '.gitignore');
  if (!fs.existsSync(cacheIgnore)) {
    try {
      fs.writeFileSync(cacheIgnore, '# GroundWork cache is transient — never commit it.\n*\n!.gitignore\n');
    } catch (err) {
      c.warn(`Could not seed .groundwork/cache/.gitignore: ${err.message}`);
    }
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
  // `--set key=value` writes into the config only at this seed moment — on an existing
  // install the file is yours, so a --set there refuses rather than mutating it.
  const sourceConfigToml = path.join(p.sourceConfigDir, 'config.toml');
  const targetConfigToml = path.join(p.targetConfigDir, 'config.toml');
  const sets = options.sets || [];
  if (fs.existsSync(sourceConfigToml) && !fs.existsSync(targetConfigToml)) {
    try {
      let text = fs.readFileSync(sourceConfigToml, 'utf8');
      if (sets.length) {
        const result = applyConfigSets(text, sets);
        if (result.errors.length) {
          c.err(`--set rejected: ${result.errors.join('; ')}`);
          console.warn(`         Settable keys: ${[...settableConfigKeys(text).keys()].join(', ')}`);
          process.exitCode = 1;
          return;
        }
        text = result.text;
      }
      fs.writeFileSync(targetConfigToml, text);
      c.ok(`Seeded user config (.groundwork/config/config.toml)${sets.length ? ` with ${sets.length} --set value(s)` : ''}`);
    } catch (err) {
      c.err(`Failed to seed user config: ${err.message}`);
    }
  } else if (sets.length) {
    c.warn(`Ignoring --set: .groundwork/config/config.toml already exists and is yours to edit — GroundWork never mutates it.`);
  }

  // Seed the additive team policy once (user-owned thereafter, never overwritten), and
  // gitignore the personal policy.user.toml so it stays local.
  const sourcePolicy = path.join(p.sourceConfigDir, 'policy.toml');
  const targetPolicy = path.join(p.targetConfigDir, 'policy.toml');
  if (fs.existsSync(sourcePolicy) && !fs.existsSync(targetPolicy)) {
    try {
      fs.copyFileSync(sourcePolicy, targetPolicy);
      c.ok(`Seeded team policy (.groundwork/config/policy.toml)`);
    } catch (err) {
      c.err(`Failed to seed policy: ${err.message}`);
    }
  }
  const configIgnore = path.join(p.targetConfigDir, '.gitignore');
  if (!fs.existsSync(configIgnore)) {
    try {
      fs.writeFileSync(configIgnore, '# Personal, machine-local policy overrides — never committed.\npolicy.user.toml\n');
    } catch (err) {
      c.warn(`Could not seed .groundwork/config/.gitignore: ${err.message}`);
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
  enableSerenaMcp(p, selected);
  seedCaptureHook(p, selected);

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
  for (const s of tier2.edited) console.log(`  \x1b[36m⊜ ${s.rel}\x1b[0m \x1b[2m(edited — queued for the update skill, your copy untouched)\x1b[0m`);
  if (devCli.replaceBundle) console.log(`  \x1b[33m~ .dev/dev-bundle.js\x1b[0m \x1b[2m(framework-owned — replaced with the current bundle)\x1b[0m`);
  if (devCli.replaceLauncher) console.log(`  \x1b[33m~ dev\x1b[0m \x1b[2m(framework-owned — replaced with the current launcher)\x1b[0m`);
  if (devCli.customLauncher) console.log(`  \x1b[36m⊜ dev\x1b[0m \x1b[2m(customized — queued for the update skill, your copy untouched)\x1b[0m`);
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
  const skillsDiff = diffRegisteredSkills(p, manifest);
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
  const pending = pendingMigrations(p, registry);
  const briefItems = buildBriefItems(p, tier2, devCli, manifest);

  const total =
    skillsDiff.added.length + skillsDiff.changed.length + skillsDiff.removed.length +
    hiddenDiff.added.length + hiddenDiff.changed.length + hiddenDiff.removed.length +
    (generatorsChanged ? 1 : 0) +
    tier2.copy.length + tier2.refresh.length +
    (devCli.replaceBundle ? 1 : 0) + (devCli.replaceLauncher ? 1 : 0) +
    pending.cli.length + briefItems.length;

  if (total === 0) {
    if (!dryRun) {
      pruneStaleBrief(p); // a pre-cutover brief is the one thing `total` can't see — clean it
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
    reportDiff('.groundwork/skills/', hiddenDiff);
    if (generatorsChanged) console.log(`\x1b[1m.groundwork/config/\x1b[0m\n  \x1b[33m~ generators.json\x1b[0m`);
    reportTier2(tier2, devCli);
    if (pending.cli.length) {
      console.log(`\x1b[1mScripted migrations to run:\x1b[0m`);
      for (const { entry } of pending.cli) console.log(`  \x1b[33m▸ ${entry.id}\x1b[0m — ${entry.title}`);
    }
    if (briefItems.length) {
      console.log(`\x1b[1mUpgrade brief (judgment lane — handled by the groundwork-update skill):\x1b[0m`);
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
    enableSerenaMcp(p, readPersistedAgents(p) || []);
    seedCaptureHook(p, readPersistedAgents(p) || []);
  } catch (err) {
    c.err(`Update failed while copying files: ${err.message}`);
    c.err(`Aborted — version stamp and manifest were not advanced. Re-run npx groundwork-method update after resolving.`);
    process.exitCode = 1;
    return;
  }

  c.ok(`Updated GroundWork skills\n`);
  reportDiff('.agents/skills/', skillsDiff);
  reportDiff('.groundwork/skills/', hiddenDiff);
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
    printChangelogSlice(stamped, PKG.version, !!flags.full);
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
  const briefCount = writeUpgradeBrief(p, briefItems, stamped);

  // A failed migration stops the stamp from advancing past it (decision S4:
  // idempotent + detect-first makes the re-run safe).
  if (migrationResult.failed) {
    process.exitCode = 1;
    return;
  }

  writeManifestFile(p, rebuildManifest(p, manifest, tier2, generatorsConfig, devCli));
  stampVersion(p);

  if (briefCount > 0) {
    console.log(`\n\x1b[33m\x1b[1m⚠ ${briefCount} item(s) need a working session:\x1b[0m open your agent and say \x1b[36m"update groundwork"\x1b[0m.`);
    console.log(`  \x1b[2mThe work list is at .groundwork/cache/upgrade-brief.json — the groundwork-update skill consumes it, then reconciles structure.\x1b[0m\n`);
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
      [p.sourceHiddenSkillsDir, p.targetHiddenSkillsDir, '.groundwork/skills'],
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
  const pending = pendingMigrations(p, registry);
  const pendingCount = pending.cli.length;
  if (pendingCount > 0) {
    stale = true;
    c.warn(`${pendingCount} pending migration(s): ${pending.cli.map((m) => m.entry.id).join(', ')}`);
    console.log(`         Run \x1b[36mnpx groundwork-method update\x1b[0m — these scripted migrations run there.`);
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

  // Validate the additive policy layer (parse errors, broken file: refs, missing lens
  // briefs, unknown keys) — a broken policy file silently drops the rigor it was meant to add.
  const policyProblems = validatePolicy(p.targetDir, p.targetConfigDir);
  if (policyProblems.length) {
    c.err(`Policy layer has ${policyProblems.length} problem(s):`);
    for (const prob of policyProblems) console.warn(`         • ${prob}`);
    process.exitCode = 1;
  }

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
    c.warn(`No drift-tracked docs found (docs/architecture/services/, docs/architecture/api/, docs/architecture/domain/, docs/architecture/index.md).`);
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
    console.log(`Repair: ask your AI agent to run the \x1b[36mgroundwork-doc-sync\x1b[0m skill — it maps the`);
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

  const { map, cache, stats, diagnostics } = await engine.generate({ cwd: p.targetDir, cacheDir: p.targetCacheDir });

  // A malformed project-local language/manifest config is the user's to fix — surface it.
  for (const e of diagnostics.projectErrors || []) c.warn(`repo-map.languages.js: ${e}`);
  for (const e of diagnostics.manifestErrors || []) c.warn(`module graph: ${e}`);

  const mg = map.module_graph;
  if (map.stats.files === 0 && !mg.modules.length) {
    c.warn(`No mappable source files found. Nothing to map.`);
    // --conventions still delivers: manifests/config conventions exist without
    // mappable source (hubs simply stay empty).
    if (argv.includes('--conventions')) writeConventions(p, engine, map);
    reportUnmapped(diagnostics.unmapped);
    return;
  }
  // --conventions rides the same build: the digest embeds in repo-map.json (so
  // staleness is repo-map's existing per-worktree refresh, no separate machinery)
  // and also lands as .groundwork/cache/conventions.md for packs and humans.
  if (argv.includes('--conventions')) {
    map.conventions = engine.buildConventions({ cwd: p.targetDir, map });
  }
  engine.write({ cacheDir: p.targetCacheDir, map, cache });

  const langList = Object.entries(map.stats.languages).map(([l, n]) => `${l}:${n}`).join(' ');
  c.ok(`Wrote .groundwork/cache/repo-map.json — ${map.stats.files} files, ${map.stats.edges} edges (${langList})`);
  c.dim(`  ${stats.parsed} parsed, ${stats.cached} reused from cache`);
  if (map.conventions) writeConventions(p, engine, map);
  if (diagnostics.projectLanguages && diagnostics.projectLanguages.length) {
    c.dim(`  project languages: ${diagnostics.projectLanguages.join(', ')}`);
  }
  if (mg.modules.length) {
    const ecos = mg.sources.map((s) => s.ecosystem).join(', ');
    c.dim(`  module graph: ${mg.modules.length} modules, ${mg.edges.length} edges (${ecos})`);
  }
  if (map.centrality.length) {
    console.log(`\n\x1b[1mMost-referenced files (centrality):\x1b[0m`);
    for (const hub of map.centrality.slice(0, 5)) {
      console.log(`  ${hub.file} \x1b[2m(rank ${hub.rank}, ${hub.in} incoming)\x1b[0m`);
    }
  }
  if (mg.module_centrality.length && mg.edges.length) {
    console.log(`\n\x1b[1mModule hubs (manifest-declared dependencies):\x1b[0m`);
    for (const hub of mg.module_centrality.slice(0, 5)) {
      console.log(`  ${hub.module} \x1b[2m(rank ${hub.rank}, ${hub.in} incoming)\x1b[0m`);
    }
  }

  // --mermaid: also render the module graph for humans/docs — the one map view,
  // replacing per-project one-off graph tools.
  if (argv.includes('--mermaid')) {
    if (!mg.modules.length) {
      c.warn(`--mermaid: no module graph to render (${mg.reason || 'no modules found'}).`);
    } else {
      const mmd = engine.renderModuleGraphMermaid(mg);
      const out = path.join(p.targetCacheDir, 'module-graph.mmd');
      fs.writeFileSync(out, mmd);
      c.ok(`Wrote .groundwork/cache/module-graph.mmd`);
      console.log('\n' + mmd);
    }
  }
  reportUnmapped(diagnostics.unmapped);
  console.log('');
}

// Write the human/pack-facing conventions digest (computing it first when the
// map build was skipped) — deterministic by contract, so no timestamp is added.
function writeConventions(p, engine, map) {
  const digest = map.conventions || engine.buildConventions({ cwd: p.targetDir, map });
  fs.mkdirSync(p.targetCacheDir, { recursive: true });
  fs.writeFileSync(path.join(p.targetCacheDir, 'conventions.md'), engine.renderConventionsMarkdown(digest));
  c.ok(`Wrote .groundwork/cache/conventions.md — ${engine.summarizeConventions(digest)}`);
}

// Nudge: name the languages present in the repo but not mapped, and point at the
// one place that explains how to enable them. This is the "lay the groundwork"
// path — repo-map says what it cannot see rather than implying full coverage.
function reportUnmapped(unmapped) {
  if (!unmapped || !unmapped.length) return;
  console.log('');
  c.warn(`Some languages in this repo are not mapped:`);
  for (const u of unmapped) {
    console.warn(`         • ${u.language} — ${u.files} file(s); ${u.reason}`);
  }
  console.warn(
    `         Enable them by adding \x1b[36m.groundwork/config/repo-map.languages.js\x1b[0m —`
  );
  console.warn(`         see \x1b[36m.groundwork/skills/code-intelligence.md\x1b[0m (“Enable repo-map for your language”).`);
}

// ─── Update notice ───────────────────────────────────────────────────────────

// True when `latest`'s x.y.z is greater than `current`'s (pre-release tags ignored —
// the `latest` dist-tag is stable).
function isNewerVersion(latest, current) {
  const parse = (v) => String(v).split('-')[0].split('.').map((n) => parseInt(n, 10) || 0);
  const a = parse(latest);
  const b = parse(current);
  for (let i = 0; i < 3; i++) {
    if ((a[i] || 0) > (b[i] || 0)) return true;
    if ((a[i] || 0) < (b[i] || 0)) return false;
  }
  return false;
}

// Non-blocking, best-effort "a newer version exists" line printed after the command's
// own output. All errors are swallowed — an update check must never break a command or
// hang an install. Suppressed on non-TTY, CI, GROUNDWORK_NO_UPDATE_CHECK, and `update`
// (which already reports version state). Success commands drain the loop naturally, so
// the in-flight request keeps the process alive just long enough to print, capped at 1500ms.
function maybeCheckForUpdate(cmd) {
  if (cmd === 'update') return;
  if (!process.stdout.isTTY || process.env.CI || process.env.GROUNDWORK_NO_UPDATE_CHECK) return;
  let req;
  try {
    req = https.get('https://registry.npmjs.org/groundwork-method/latest', { timeout: 1500 }, (res) => {
      if (res.statusCode !== 200) { res.resume(); return; }
      let body = '';
      res.on('data', (d) => { body += d; });
      res.on('end', () => {
        try {
          const latest = JSON.parse(body).version;
          if (latest && isNewerVersion(latest, PKG.version)) {
            // Print at exit so the notice lands after the command's output.
            process.on('exit', () => {
              console.error(`\x1b[2mA newer groundwork-method is available: ${PKG.version} → ${latest}. Run: npx groundwork-method@latest update\x1b[0m`);
            });
          }
        } catch { /* swallow malformed responses */ }
      });
    });
    req.on('timeout', () => req.destroy());
    req.on('error', () => {});
  } catch { /* swallow — never let the check throw */ }
}

// ─── Engine state verbs: findings & decisions ───────────────────────────────
// Durable per-bet state (`.groundwork/bets/<slug>/`) the delivery workflow used
// to ask the driver to keep by hand. Logic lives in lib/bet-state; these handlers
// parse flags, orchestrate IO, and print. CI-safe: `findings check` exits non-zero
// on any open finding, the mechanical form of the milestone-close gate.

// Minimal flag parser: `--k v`, `--k=v`, and bare `--flag` (=> true). Positionals
// (the subcommand) collect in `_`. No external dependency.
function parseFlags(args) {
  const out = { _: [] };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a.startsWith('--')) {
      const eq = a.indexOf('=');
      if (eq !== -1) {
        out[a.slice(2, eq)] = a.slice(eq + 1);
      } else {
        const key = a.slice(2);
        const next = args[i + 1];
        if (next !== undefined && !next.startsWith('--')) { out[key] = next; i++; }
        else out[key] = true;
      }
    } else {
      out._.push(a);
    }
  }
  return out;
}

function loadBetState() {
  return require(path.join(__dirname, '..', 'lib', 'bet-state'));
}

function findingsCommand(argv) {
  const bs = loadBetState();
  const f = parseFlags(argv);
  const sub = f._[0];
  const p = getPaths();
  const slug = f.bet;
  const asJson = !!f.json;
  const requireBet = () => { if (!slug) { c.err(`findings ${sub}: --bet <slug> is required`); process.exit(1); } };

  switch (sub) {
    case 'add': {
      requireBet();
      try {
        const finding = bs.addFinding(p.targetDir, slug, {
          slice: f.slice, milestone: f.milestone, lens: f.lens,
          bucket: f.bucket, title: f.title, location: f.location,
        });
        if (asJson) process.stdout.write(JSON.stringify(finding, null, 2) + '\n');
        else c.ok(`Recorded finding ${finding.id} (${finding.bucket}, open): ${finding.title}`);
      } catch (err) { c.err(`findings add: ${err.message}`); process.exit(1); }
      break;
    }
    case 'disposition': {
      requireBet();
      try {
        const finding = bs.dispositionFinding(p.targetDir, slug, { id: f.id, as: f.as, note: f.note });
        if (asJson) process.stdout.write(JSON.stringify(finding, null, 2) + '\n');
        else c.ok(`Closed finding ${finding.id} — ${finding.disposition}${finding.note ? `: ${finding.note}` : ''}`);
      } catch (err) { c.err(`findings disposition: ${err.message}`); process.exit(1); }
      break;
    }
    case 'check': {
      requireBet();
      const open = bs.openFindings(p.targetDir, slug, { milestone: f.milestone, slice: f.slice });
      if (asJson) process.stdout.write(JSON.stringify({ open: open.length, findings: open }, null, 2) + '\n');
      if (open.length) {
        if (!asJson) {
          c.err(`${open.length} open finding(s) — cannot close:`);
          for (const it of open) console.error(`    ○ ${it.id} [${it.bucket}] ${it.title}`);
        }
        process.exit(1);
      }
      if (!asJson) c.ok('No open findings — clear to close.');
      break;
    }
    case 'list': {
      requireBet();
      const items = bs.listFindings(p.targetDir, slug, { status: f.status, milestone: f.milestone, slice: f.slice });
      if (asJson) { process.stdout.write(JSON.stringify(items, null, 2) + '\n'); break; }
      if (!items.length) { c.dim('(no findings)'); break; }
      for (const it of items) {
        console.log(`  ${it.status === 'open' ? '○' : '●'} ${it.id} [${it.bucket}] ${it.title}${it.disposition ? ` → ${it.disposition}` : ''}`);
      }
      break;
    }
    default:
      c.err(`findings: unknown subcommand '${sub || ''}' — use add | disposition | check | list`);
      process.exit(1);
  }
}

function decisionsCommand(argv) {
  const bs = loadBetState();
  const f = parseFlags(argv);
  const sub = f._[0];
  const p = getPaths();
  const slug = f.bet;
  const asJson = !!f.json;
  const requireBet = () => { if (!slug) { c.err(`decisions ${sub}: --bet <slug> is required`); process.exit(1); } };

  switch (sub) {
    case 'add': {
      requireBet();
      try {
        const d = bs.addDecision(p.targetDir, slug, {
          milestone: f.milestone, question: f.question, default: f.default, rationale: f.rationale,
        });
        if (asJson) process.stdout.write(JSON.stringify(d, null, 2) + '\n');
        else c.ok(`Recorded decision ${d.id} (pending): ${d.question} → default: ${d.default}`);
      } catch (err) { c.err(`decisions add: ${err.message}`); process.exit(1); }
      break;
    }
    case 'pending': {
      requireBet();
      const items = bs.pendingDecisions(p.targetDir, slug);
      if (asJson) { process.stdout.write(JSON.stringify(items, null, 2) + '\n'); break; }
      if (!items.length) { c.dim('(no pending decisions)'); break; }
      for (const d of items) console.log(`  ▸ ${d.id}: ${d.question}\n      default: ${d.default}\n      why:     ${d.rationale}`);
      break;
    }
    case 'ratify': {
      requireBet();
      try {
        const done = bs.ratifyDecisions(p.targetDir, slug, {
          id: f.id, all: !!f.all, response: f.response, outcome: f.as, at: f.at,
        });
        if (asJson) process.stdout.write(JSON.stringify(done, null, 2) + '\n');
        else c.ok(`${done.length} decision(s) ${done[0].status} — "${done[0].ratification.response}"`);
      } catch (err) { c.err(`decisions ratify: ${err.message}`); process.exit(1); }
      break;
    }
    case 'list': {
      requireBet();
      const items = bs.listDecisions(p.targetDir, slug, { status: f.status });
      if (asJson) { process.stdout.write(JSON.stringify(items, null, 2) + '\n'); break; }
      if (!items.length) { c.dim('(no decisions)'); break; }
      for (const d of items) console.log(`  ${d.status === 'pending' ? '▸' : '✓'} ${d.id} [${d.status}] ${d.question}`);
      break;
    }
    default:
      c.err(`decisions: unknown subcommand '${sub || ''}' — use add | pending | ratify | list`);
      process.exit(1);
  }
}

// ─── Mechanical gates: gate (readiness/decomposition) & seal verify ──────────
// The structural, fail-closed half of the delivery checklists the driver walked
// by hand. Logic in lib/bet-gate. Exit 0 = pass, 1 = a check failed, 2 = the
// gate could not run (seal: no tag / no git repo).

function loadBetGate() {
  return require(path.join(__dirname, '..', 'lib', 'bet-gate'));
}

function gateCommand(argv) {
  const bg = loadBetGate();
  const f = parseFlags(argv);
  const sub = f._[0];
  const p = getPaths();
  const slug = f.bet;
  const asJson = !!f.json;
  if (!slug) { c.err(`gate ${sub || ''}: --bet <slug> is required`); process.exit(1); }

  let checks;
  if (sub === 'readiness') checks = bg.readinessChecks(p.targetDir, slug);
  else if (sub === 'decomposition') checks = bg.decompositionChecks(p.targetDir, slug, { milestone: f.milestone });
  else { c.err(`gate: unknown subcommand '${sub || ''}' — use readiness | decomposition`); process.exit(1); }

  const failed = checks.filter((ch) => !ch.ok);
  if (asJson) {
    process.stdout.write(JSON.stringify({ gate: sub, ok: failed.length === 0, failed: failed.length, checks }, null, 2) + '\n');
  }
  if (failed.length) {
    if (!asJson) {
      c.err(`gate ${sub}: ${failed.length} check(s) failed:`);
      for (const ch of failed) console.error(`    ✖ ${ch.name} — ${ch.detail}`);
    }
    process.exit(1);
  }
  if (!asJson) c.ok(`gate ${sub}: all ${checks.length} mechanical checks pass.`);
}

function sealCommand(argv) {
  const bg = loadBetGate();
  const f = parseFlags(argv);
  const sub = f._[0];
  const p = getPaths();
  const slug = f.bet;
  const asJson = !!f.json;
  if (sub !== 'verify') { c.err(`seal: unknown subcommand '${sub || ''}' — use verify`); process.exit(1); }
  if (!slug) { c.err('seal verify: --bet <slug> is required'); process.exit(1); }

  const res = bg.sealVerify(p.targetDir, slug);
  if (asJson) process.stdout.write(JSON.stringify(res, null, 2) + '\n');
  switch (res.status) {
    case 'no-git':
      if (!asJson) c.warn('seal verify: not a git repo — prose integrity falls back to the bet record.');
      process.exit(2);
      break;
    case 'no-tag':
      if (!asJson) c.err(`seal verify: tag ${res.tag} does not exist — the bet is not sealed.`);
      process.exit(2);
      break;
    case 'drift':
      if (!asJson) {
        c.err(`seal verify: sealed prose drifted from ${res.tag} without a recorded amendment:`);
        for (const file of res.drifted) console.error(`    ✖ ${file}`);
      }
      process.exit(1);
      break;
    default:
      if (!asJson) c.ok(`seal verify: prose matches ${res.tag} — sealed.`);
  }
}

// ─── Honesty scan: the computable half of the milestone honesty audit ───────
// Diffs HEAD against the sealed baseline (`bet/<slug>/approved`) for what git +
// grep can establish without judgment: deleted/thinned guards, hand-edits inside
// generated files, best-effort zero-caller exports. Logic lives in
// lib/bet-honesty; findings are LEADS for the audit agent, never verdicts.
// Exit codes: 0 clean, 1 leads found, 2 cannot run (no tag / not a git repo).

const HONESTY_CHECK_ORDER = ['deleted-guard', 'generated-edit', 'zero-caller'];

function honestyCommand(argv) {
  const f = parseFlags(argv);
  const sub = f._[0];
  if (sub !== 'scan') {
    c.err(`honesty: unknown subcommand '${sub || ''}' — use scan`);
    process.exit(1);
  }
  if (!f.bet) {
    c.err('honesty scan: --bet <slug> is required');
    process.exit(1);
  }
  const bh = require(path.join(__dirname, '..', 'lib', 'bet-honesty'));
  const p = getPaths();
  const asJson = !!f.json;

  let result;
  try {
    result = bh.scan(p.targetDir, f.bet);
  } catch (err) {
    c.err(`honesty scan: ${err.message}`);
    process.exit(2); // cannot-run — distinct from "ran and found leads"
  }

  const tag = bh.approvedTag(f.bet);
  if (asJson) {
    process.stdout.write(JSON.stringify(result, null, 2) + '\n');
    process.exit(result.clean ? 0 : 1);
  }
  if (result.clean) {
    c.ok(`No computable honesty leads since ${tag}. The audit agent still judges what the scan can't.`);
    return;
  }
  c.err(`${result.findings.length} honesty lead(s) since ${tag}:`);
  for (const check of HONESTY_CHECK_ORDER) {
    const group = result.findings.filter((it) => it.check === check);
    if (!group.length) continue;
    console.error(`\n  ${check} (${group.length}):`);
    for (const it of group) {
      console.error(`    ○ ${it.file}${it.symbol ? ` :: ${it.symbol}` : ''} — ${it.detail}`);
    }
  }
  console.error(`\n  These are leads for the honesty audit, not verdicts — the audit agent judges; record real ones via \`groundwork findings add\`.`);
  process.exit(1);
}

// ─── Wiring scan: built-but-never-wired controls (escape class d) ───────────
// Diffs HEAD against the sealed baseline (`bet/<slug>/approved`) for
// interactive elements that exist in code but can't be reached in use:
// empty/TODO-only handler bodies on known framework shapes, and handler-shaped
// functions with no reachable caller (best-effort). Logic lives in
// lib/bet-wiring (sharing lib/bet-honesty's git plumbing); findings are LEADS
// for the review wave, never verdicts.
// Exit codes: 0 clean, 1 leads found, 2 cannot run (no tag / not a git repo).

const WIRING_CHECK_ORDER = ['empty-action', 'unreachable-handler'];

function wiringCommand(argv) {
  const f = parseFlags(argv);
  const sub = f._[0];
  if (sub !== 'scan') {
    c.err(`wiring: unknown subcommand '${sub || ''}' — use scan`);
    process.exit(1);
  }
  if (!f.bet) {
    c.err('wiring scan: --bet <slug> is required');
    process.exit(1);
  }
  const bw = require(path.join(__dirname, '..', 'lib', 'bet-wiring'));
  const p = getPaths();
  const asJson = !!f.json;

  let result;
  try {
    result = bw.scan(p.targetDir, f.bet);
  } catch (err) {
    c.err(`wiring scan: ${err.message}`);
    process.exit(2); // cannot-run — distinct from "ran and found leads"
  }

  const tag = bw.approvedTag(f.bet);
  if (asJson) {
    process.stdout.write(JSON.stringify(result, null, 2) + '\n');
    process.exit(result.clean ? 0 : 1);
  }
  if (result.clean) {
    c.ok(`No wiring leads since ${tag}. The scan only sees shapes it recognizes — the review lenses still judge reachability.`);
    return;
  }
  c.err(`${result.findings.length} wiring lead(s) since ${tag}:`);
  for (const check of WIRING_CHECK_ORDER) {
    const group = result.findings.filter((it) => it.check === check);
    if (!group.length) continue;
    console.error(`\n  ${check} (${group.length}):`);
    for (const it of group) {
      console.error(`    ○ ${it.file}${it.symbol ? ` :: ${it.symbol}` : ''} — ${it.detail}`);
    }
  }
  console.error(`\n  These are leads for review, not verdicts — record real ones via \`groundwork findings add\`.`);
  process.exit(1);
}

// ─── Mutate: the deletion test, mechanized ──────────────────────────────────
// Reverts the slice's SOURCE changes to the sealed baseline (its tests stay at
// HEAD), runs the slice's test command, and demands red — a suite that stays
// green with the implementation deleted does not bite, the exact failure class
// the coverage lens hunts by hand. Logic lives in lib/bet-mutate.
// SAFETY: refuses to run (exit 2) on a working tree with uncommitted tracked
// changes — it never stashes or destroys user work — and restores every
// reverted file to HEAD unconditionally, on crash paths included.
// Exit codes: 0 the tests bite (or nothing to revert), 1 green-after-deletion,
// 2 cannot run (no git repo / no baseline / dirty tree / unspawnable command).

function mutateCommand(argv) {
  // Everything after `--` is the test command, verbatim — split before the
  // flag parser ever sees it.
  const sep = argv.indexOf('--');
  const flagArgs = sep === -1 ? argv : argv.slice(0, sep);
  const testCommand = sep === -1 ? [] : argv.slice(sep + 1);
  const f = parseFlags(flagArgs);
  const p = getPaths();
  const asJson = !!f.json;

  if (!f.bet || f.bet === true) { c.err('mutate: --bet <slug> is required'); process.exit(1); }
  if (!f.slice || f.slice === true) { c.err('mutate: --slice <test-file-path> is required — the slice test file, kept at HEAD'); process.exit(1); }
  if (!testCommand.length) {
    c.err('mutate: no test command — pass it after `--` (e.g. mutate --bet b --slice tests/x.py -- pytest tests/x.py)');
    process.exit(1);
  }
  const timeoutS = f.timeout === undefined ? 120 : Number(f.timeout);
  if (!Number.isFinite(timeoutS) || timeoutS <= 0) { c.err('mutate: --timeout expects a positive number of seconds'); process.exit(1); }

  const bm = require(path.join(__dirname, '..', 'lib', 'bet-mutate'));
  let r;
  try {
    r = bm.run(p.targetDir, {
      slug: f.bet,
      since: typeof f.since === 'string' ? f.since : undefined,
      sliceFile: f.slice,
      command: testCommand,
      timeoutMs: timeoutS * 1000,
    });
  } catch (err) {
    c.err(`mutate: ${err.message}`);
    process.exit(2); // cannot-run — must never masquerade as a verdict
  }

  if (asJson) {
    process.stdout.write(JSON.stringify({
      bite: r.bite,
      reverted_files: r.reverted_files,
      test_exit: r.test_exit,
      no_source_changes: r.no_source_changes,
      baseline: r.baseline,
      timed_out: r.timed_out,
    }, null, 2) + '\n');
  }
  if (r.no_source_changes) {
    if (!asJson) c.ok(`nothing to revert — no source changes between ${r.baseline} and HEAD (tests, docs/, .groundwork/ excluded); the deletion test has nothing to say here.`);
    process.exit(0);
  }
  if (r.bite) {
    if (!asJson) {
      const how = r.timed_out ? `timed out after ${timeoutS}s` : `exit ${r.test_exit}`;
      c.ok(`the tests bite — red (${how}) with ${r.reverted_files.length} source file(s) reverted to ${r.baseline}; everything restored to HEAD.`);
    }
    process.exit(0);
  }
  if (!asJson) {
    c.err('green with the implementation deleted — these tests do not bite.');
    console.error(`    Reverted ${r.reverted_files.length} source file(s) to ${r.baseline}, kept the tests at HEAD, and the test command still passed:`);
    for (const file of r.reverted_files) console.error(`    ○ ${file}`);
    console.error(`    A suite that cannot tell the implementation is gone proves nothing — record it: groundwork findings add --bet ${f.bet} --slice <key> --bucket patch --title "tests do not bite"`);
  }
  process.exit(1);
}

// ─── Engine state verbs: pack ───────────────────────────────────────────────
// The milestone context pack the delivery driver used to distil by hand (W1.3).
// Logic lives in lib/bet-pack — pointers and learnings, never contract text;
// staleness is compiled_from ≠ the approved-tag sha. These handlers parse flags
// and print. CI-safe: `pack check` exits 1 on a stale or missing pack.

function packCommand(argv) {
  const bp = require(path.join(__dirname, '..', 'lib', 'bet-pack'));
  const f = parseFlags(argv);
  const sub = f._[0];
  const p = getPaths();
  const slug = f.bet;
  const milestone = f.milestone;
  const asJson = !!f.json;

  if (!['build', 'refresh', 'check'].includes(sub || '')) {
    c.err(`pack: unknown subcommand '${sub || ''}' — use build | refresh | check`);
    process.exit(1);
  }
  if (!slug) { c.err(`pack ${sub}: --bet <slug> is required`); process.exit(1); }
  if (milestone == null || milestone === true) { c.err(`pack ${sub}: --milestone <N> is required`); process.exit(1); }

  try {
    switch (sub) {
      case 'build': {
        const r = bp.buildPack(p.targetDir, slug, milestone);
        if (asJson) process.stdout.write(JSON.stringify(r, null, 2) + '\n');
        else c.ok(`Wrote ${r.file} (compiled_from ${r.compiled_from.slice(0, 7)}) — fill the driver-notes block.`);
        break;
      }
      case 'refresh': {
        const r = bp.refreshPack(p.targetDir, slug, milestone);
        if (asJson) process.stdout.write(JSON.stringify(r, null, 2) + '\n');
        else if (r.status === 'fresh') c.ok(`fresh — ${r.file} already compiled from ${r.compiled_from.slice(0, 7)}; nothing written.`);
        else c.ok(`Recompiled ${r.file} (was ${r.was}) from ${r.compiled_from.slice(0, 7)} — driver notes preserved.`);
        break;
      }
      case 'check': {
        const r = bp.checkPack(p.targetDir, slug, milestone);
        if (asJson) process.stdout.write(JSON.stringify(r, null, 2) + '\n');
        if (r.status !== 'fresh') {
          if (!asJson) c.err(`pack is ${r.status} — compiled_from ${r.compiled_from || '(none)'} vs tag ${r.tag_sha}; run: groundwork pack refresh --bet ${slug} --milestone ${milestone}`);
          process.exit(1);
        }
        if (!asJson) c.ok(`fresh — compiled_from matches bet/${slug}/approved (${r.tag_sha.slice(0, 7)}).`);
        break;
      }
    }
  } catch (err) {
    c.err(`pack ${sub}: ${err.message}`);
    process.exit(err.exitCode || 1);
  }
}

// ─── The composed bet-state view: state ──────────────────────────────────────
// One document composing every engine fact about a bet (seal, findings,
// decisions, pack freshness, board pointer) — the Wave-2 capstone, v1: read
// view + aggregate gate. Logic in lib/bet-state/compose. `--check` exits 1 on
// seal drift, open findings, or a stale pack; the board and pitch status
// report but never gate (the Wave-1 contract).

function stateCommand(argv) {
  const { composeState } = require(path.join(__dirname, '..', 'lib', 'bet-state', 'compose'));
  const f = parseFlags(argv);
  const p = getPaths();
  const slug = f.bet;
  const asJson = !!f.json;
  if (!slug) { c.err('state: --bet <slug> is required'); process.exit(1); }

  const doc = composeState(p.targetDir, slug);
  if (!doc.approved) {
    c.err(`state: tag bet/${slug}/approved not found — the bet is not sealed (or this is not a git repo).`);
    process.exit(2);
  }
  if (asJson) process.stdout.write(JSON.stringify(doc, null, 2) + '\n');

  if (f.check) {
    if (!doc.clean) {
      if (!asJson) {
        c.err(`state --check: bet '${slug}' is not clean:`);
        if (doc.gates.seal_drift) console.error(`    ✖ seal drift (${doc.seal.drifted.length} file(s)) — run: groundwork seal verify --bet ${slug}`);
        if (doc.gates.open_findings) console.error(`    ✖ ${doc.gates.open_findings} open finding(s) — run: groundwork findings check --bet ${slug}`);
        if (doc.gates.stale_packs) console.error(`    ✖ ${doc.gates.stale_packs} stale pack(s) — run: groundwork pack refresh --bet ${slug} --milestone <N>`);
      }
      process.exit(1);
    }
    if (!asJson) c.ok(`state --check: bet '${slug}' is clean — seal intact, no open findings, packs fresh.`);
    return;
  }

  if (!asJson) {
    c.ok(`bet '${slug}' @ ${doc.approved.sha.slice(0, 7)} (pitch: ${doc.pitch_status || '?'}${doc.board.present ? `, step: ${doc.board.step}` : ''})`);
    console.log(`    seal: ${doc.seal.status} · findings: ${doc.findings.open} open / ${doc.findings.closed} closed · decisions: ${doc.decisions.pending} pending / ${doc.decisions.ratified} ratified · packs: ${doc.packs.map((pk) => `m${pk.milestone}=${pk.status}`).join(' ') || '(none)'}`);
    for (const it of doc.findings.open_items) console.log(`    ○ ${it.id} [${it.bucket}] ${it.title}`);
    for (const it of doc.decisions.pending_items) console.log(`    ▸ ${it.id} pending: ${it.question}`);
  }
}

// ─── The checkpoint snapshot: status ─────────────────────────────────────────
// The ready-to-paste "you are here" markdown Protocol 11 (operating-contract.md,
// "The checkpoint snapshot") specifies: Program -> Bet -> Milestone, rendered
// from committed truth only (suite + git + pitch frontmatter + decomposition
// prose). board.yaml is never read. Logic in lib/bet-status.
//
// `--write [path]` (C2) additionally persists the same full-tier render to disk
// — docs/bets/<slug>/status.md by default when --bet resolves, or an explicit
// path override — regenerated WHOLE on every call (never appended/patched), so
// the docsite always shows a page as fresh as the last checkpoint. `--write`
// with no value and no resolvable bet has no sensible default and errors.

function statusCommand(argv) {
  const bs = require(path.join(__dirname, '..', 'lib', 'bet-status'));
  const { composeStatus, renderMarkdown } = bs;
  const f = parseFlags(argv);
  const p = getPaths();
  const asJson = !!f.json;

  // A slug is a path segment under docs/bets/ — reject anything that could
  // traverse out of it (same guard the ./dev bundle's archive applies).
  if (f.bet && !/^[a-z0-9][a-z0-9-]*$/.test(String(f.bet))) {
    c.err(`status: invalid bet slug "${f.bet}" — lowercase letters, digits, and hyphens only`);
    process.exit(2);
  }

  let doc;
  try {
    doc = composeStatus(p.targetDir, f.bet || null);
  } catch (err) {
    c.err(`status: ${err.message}`);
    process.exit(2);
  }

  if (f.bet && !doc.bet) {
    if (asJson) process.stdout.write(JSON.stringify(doc, null, 2) + '\n');
    else c.err(`status: no pitch found at docs/bets/${f.bet}/pitch.md`);
    process.exit(2);
  }

  if (f.write !== undefined) {
    let writePath;
    if (typeof f.write === 'string') {
      writePath = path.isAbsolute(f.write) ? f.write : path.join(p.targetDir, f.write);
    } else if (doc.resolvedSlug) {
      writePath = bs.defaultWritePath(p.targetDir, doc.resolvedSlug);
    } else {
      c.err('status --write: no path given and no bet resolved to default to — pass --write <path> or --bet <slug>');
      process.exit(1);
    }
    bs.writeStatusPage(writePath, doc);
    if (!asJson) c.ok(`status: wrote ${path.relative(p.targetDir, writePath) || writePath}`);
  }

  if (asJson) {
    process.stdout.write(JSON.stringify(doc, null, 2) + '\n');
    return;
  }
  // The same invocation both refreshes the written page and hands back the
  // paste-ready snapshot — one command serves both the file and the chat.
  process.stdout.write(renderMarkdown(doc));
}

// ─── Token-conformance scan: the mechanical half of the design ratchet ──────
// Flags raw color/font/spacing/motion literals in UI source files changed since
// the sealed baseline (`bet/<slug>/approved`) that bypass the project's
// design-token set. Logic lives in lib/bet-tokens; findings are LEADS for slice
// review, never verdicts. Exit codes: 0 clean, 1 findings, 2 cannot run.

const TOKENS_KIND_ORDER = ['color', 'font', 'spacing', 'motion'];
const TOKENS_PRINT_CAP = 50;

function tokensCommand(argv) {
  const f = parseFlags(argv);
  const sub = f._[0];
  if (sub !== 'scan') {
    c.err(`tokens: unknown subcommand '${sub || ''}' — use scan`);
    process.exit(1);
  }
  if (!f.bet) {
    c.err('tokens scan: --bet <slug> is required');
    process.exit(1);
  }
  const bt = require(path.join(__dirname, '..', 'lib', 'bet-tokens'));
  const p = getPaths();
  const asJson = !!f.json;

  let result;
  try {
    result = bt.scan(p.targetDir, f.bet);
  } catch (err) {
    c.err(`tokens scan: ${err.message}`);
    process.exit(2); // cannot-run — distinct from "ran and found literals"
  }

  const tag = bt.approvedTag(f.bet);
  if (asJson) {
    process.stdout.write(JSON.stringify(result, null, 2) + '\n');
    process.exit(result.clean ? 0 : 1);
  }
  if (result.clean) {
    c.ok(`No raw design literals in UI files changed since ${tag}.${result.token_set ? ` Token set: ${result.token_set}.` : ''}`);
    return;
  }
  c.err(`${result.findings.length} raw design literal(s) in UI files changed since ${tag}:`);
  let printed = 0;
  for (const kind of TOKENS_KIND_ORDER) {
    if (printed >= TOKENS_PRINT_CAP) break;
    const group = result.findings.filter((it) => it.kind === kind);
    if (!group.length) continue;
    console.error(`\n  ${kind} (${group.length}):`);
    for (const it of group) {
      if (printed >= TOKENS_PRINT_CAP) break;
      console.error(`    ○ ${it.file}:${it.line} — ${it.literal} — ${it.detail}`);
      printed++;
    }
  }
  if (result.findings.length > printed) {
    console.error(`\n  … +${result.findings.length - printed} more (use --json for the full list).`);
  }
  if (result.token_set) {
    console.error(`\n  These are leads for slice review, not verdicts — a token set exists (${result.token_set}); record real ones via \`groundwork findings add\` (default bucket: patch).`);
  } else {
    console.error(`\n  No token set detected — treat these as tokenization leads, not conformance failures; record real ones via \`groundwork findings add\`.`);
  }
  process.exit(1);
}

// ─── Dispatch ───────────────────────────────────────────────────────────────

if (!command || command === 'help' || command === '--help' || command === '-h') {
  printHelp();
  process.exit(0);
}

maybeCheckForUpdate(command);

switch (command) {
  case 'init': {
    const flags = parseInitFlags(process.argv.slice(3));
    if (flags.invalid.length) {
      c.warn(`Unknown agent(s) ignored: ${flags.invalid.join(', ')}`);
      console.warn(`         Supported: ${AGENT_KEYS.join(', ')}`);
    }
    if (flags.badSets.length) {
      c.warn(`Malformed --set ignored (expected key=value): ${flags.badSets.join(', ')}`);
    }
    initGroundWork(flags).catch((err) => {
      c.err(`init failed: ${err.message}`);
      process.exit(1);
    });
    break;
  }
  case 'update':
    updateGroundWork({
      dryRun: process.argv.includes('--dry-run'),
      full: process.argv.includes('--full'),
    });
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
  case 'gate':
    if (process.argv.includes('--help') || process.argv.includes('-h')) { printHelp(); process.exit(0); }
    gateCommand(process.argv.slice(3));
    break;
  case 'seal':
    if (process.argv.includes('--help') || process.argv.includes('-h')) { printHelp(); process.exit(0); }
    sealCommand(process.argv.slice(3));
    break;
  case 'findings':
    if (process.argv.includes('--help') || process.argv.includes('-h')) { printHelp(); process.exit(0); }
    findingsCommand(process.argv.slice(3));
    break;
  case 'decisions':
    if (process.argv.includes('--help') || process.argv.includes('-h')) { printHelp(); process.exit(0); }
    decisionsCommand(process.argv.slice(3));
    break;
  case 'honesty':
    if (process.argv.includes('--help') || process.argv.includes('-h')) { printHelp(); process.exit(0); }
    honestyCommand(process.argv.slice(3));
    break;
  case 'wiring':
    if (process.argv.includes('--help') || process.argv.includes('-h')) { printHelp(); process.exit(0); }
    wiringCommand(process.argv.slice(3));
    break;
  case 'tokens':
    if (process.argv.includes('--help') || process.argv.includes('-h')) { printHelp(); process.exit(0); }
    tokensCommand(process.argv.slice(3));
    break;
  case 'mutate': {
    // `--help` counts only before the `--` separator — the test command after
    // it is verbatim and may legitimately contain a --help of its own.
    const argv = process.argv.slice(3);
    const sep = argv.indexOf('--');
    const head = sep === -1 ? argv : argv.slice(0, sep);
    if (head.includes('--help') || head.includes('-h')) { printHelp(); process.exit(0); }
    mutateCommand(argv);
    break;
  }
  case 'pack':
    if (process.argv.includes('--help') || process.argv.includes('-h')) { printHelp(); process.exit(0); }
    packCommand(process.argv.slice(3));
    break;
  case 'state':
    if (process.argv.includes('--help') || process.argv.includes('-h')) { printHelp(); process.exit(0); }
    stateCommand(process.argv.slice(3));
    break;
  case 'status':
    if (process.argv.includes('--help') || process.argv.includes('-h')) { printHelp(); process.exit(0); }
    statusCommand(process.argv.slice(3));
    break;
  case 'policy': {
    // Print the resolved team+user policy merge as JSON.
    const p = getPaths();
    try {
      process.stdout.write(JSON.stringify(resolvePolicy(p.targetConfigDir), null, 2) + '\n');
    } catch (err) {
      c.err(`policy: ${err.message}`);
      process.exitCode = 1;
    }
    break;
  }
  default:
    console.log(`Unknown command: ${command}`);
    printHelp();
    process.exit(1);
}
