#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
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
  \x1b[36minit\x1b[0m      Install GroundWork skills, config, and the depwire code map into the current project
  \x1b[36mupdate\x1b[0m    Refresh installed skills to match this package version (preserves .groundwork/config and docs)
  \x1b[36mcheck\x1b[0m     Detect documentation drift: compares last_reviewed against git history of source_of_truth paths
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

function copyDocsIdempotent(srcDir, destDir) {
  for (const entry of fs.readdirSync(srcDir, { withFileTypes: true })) {
    if (entry.name === 'llms.txt') continue; // deployed separately to project root
    const src = path.join(srcDir, entry.name);
    const dest = path.join(destDir, entry.name);
    if (entry.isDirectory()) {
      fs.mkdirSync(dest, { recursive: true });
      copyDocsIdempotent(src, dest);
    } else if (!fs.existsSync(dest)) {
      fs.copyFileSync(src, dest);
    }
  }
}

// Clean-copy the two skill trees. Removing first prevents deprecated skills from lingering.
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
      c.err(`Failed to install ${label.toLowerCase()}: ${err.message}`);
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

// Interactive checkbox picker (arrow keys + space to toggle), built on Node's raw-mode
// keypress events — no dependency. Detected agents start checked. Falls back to the detected
// set (or Claude Code) when there's no TTY (piped npx, CI) so unattended installs still wire.
function promptAgents(detected) {
  return new Promise((resolve) => {
    if (!process.stdin.isTTY || !process.stdout.isTTY) {
      resolve(detected.length ? detected : ['claude-code']);
      return;
    }

    const rows = AGENT_KEYS.length;
    const checked = new Set(detected);
    let cursor = 0;

    const header = `\x1b[1mWhich agent tools do you use here?\x1b[0m  \x1b[2m(AGENTS.md is the canonical source; each is symlinked to it)\x1b[0m`;
    const hint = `  \x1b[2m↑/↓ move · space toggle · a all · enter confirm\x1b[0m`;

    const draw = (first) => {
      // Repaint in place: return to the header line and clear downward (skip on first paint).
      let out = first ? '' : `\r\x1b[${rows + 1}A\x1b[J`;
      out += header + '\n';
      AGENT_KEYS.forEach((key, i) => {
        const a = AGENT_ADAPTERS[key];
        const active = i === cursor;
        const pointer = active ? '\x1b[36m❯\x1b[0m ' : '  ';
        const box = checked.has(key) ? '\x1b[32m●\x1b[0m' : '○';
        const note = a.native ? ' \x1b[2m(reads AGENTS.md natively)\x1b[0m' : '';
        const label = active ? `\x1b[36m${a.label}\x1b[0m` : a.label;
        out += `${pointer}${box} ${label}${note}\n`;
      });
      out += hint;
      process.stdout.write(out);
    };

    const cleanup = () => {
      process.stdin.removeListener('keypress', onKey);
      if (process.stdin.isTTY) process.stdin.setRawMode(false);
      process.stdin.pause();
      process.stdout.write('\x1b[?25h\n'); // restore cursor, drop to a fresh line
    };

    const onKey = (str, key) => {
      if (!key) return;
      if (key.ctrl && key.name === 'c') { cleanup(); process.exit(130); }
      const allChecked = AGENT_KEYS.every((k) => checked.has(k));
      switch (key.name) {
        case 'up':    cursor = (cursor - 1 + rows) % rows; break;
        case 'down':  cursor = (cursor + 1) % rows; break;
        case 'space': {
          const k = AGENT_KEYS[cursor];
          checked.has(k) ? checked.delete(k) : checked.add(k);
          break;
        }
        case 'return':
        case 'enter':
          cleanup();
          resolve(AGENT_KEYS.filter((k) => checked.has(k)));
          return;
        default:
          if (str === 'k') cursor = (cursor - 1 + rows) % rows;
          else if (str === 'j') cursor = (cursor + 1) % rows;
          else if (str === 'a') AGENT_KEYS.forEach((k) => (allChecked ? checked.delete(k) : checked.add(k)));
          else if (str === 'q') { cleanup(); process.exit(130); }
          else return; // unrecognized key — no repaint
      }
      draw(false);
    };

    readline.emitKeypressEvents(process.stdin);
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdout.write('\x1b[?25l\n'); // hide cursor + one blank spacer line above the list
    draw(true);
    process.stdin.on('keypress', onKey);
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
  console.log(`\n\x1b[1mAgent wiring\x1b[0m`);
  console.log(`  \x1b[2mAGENTS.md is your single source of truth.\x1b[0m ${labels || 'No agents wired'}${labels ? ` ${selectedKeys.length === 1 ? 'reads' : 'read'} it.` : '.'}`);
  console.log(`  \x1b[2mAdd one later:\x1b[0m npx groundwork-method init --agent <name>  \x1b[2m(non-destructive)\x1b[0m`);
  console.log(`  \x1b[2mEdit AGENTS.md, never a symlinked copy — switching agents never moves it.\x1b[0m`);
}

// Register depwire as a project-scoped MCP server. depwire is a deterministic, local
// dependency/symbol-graph tool (tree-sitter, 16+ languages) that GroundWork treats as a
// first-class code map: the brownfield scan, the architecture extractor, and groundwork-check
// all reason over it. The registration is idempotent and additive — it never clobbers an
// existing .mcp.json or other servers, and every consumer degrades gracefully when depwire is
// absent (e.g. the eval harness), so this is a force-multiplier, never a hard dependency.
function registerDepwireMcp(targetDir) {
  const mcpPath = path.join(targetDir, '.mcp.json');
  const depwireServer = { command: 'npx', args: ['-y', 'depwire-cli', 'mcp'] };
  try {
    let config = { mcpServers: {} };
    if (fs.existsSync(mcpPath)) {
      config = JSON.parse(fs.readFileSync(mcpPath, 'utf8'));
      if (!config.mcpServers || typeof config.mcpServers !== 'object') {
        config.mcpServers = {};
      }
    }
    if (config.mcpServers.depwire) {
      return; // already registered — preserve the user's configuration
    }
    config.mcpServers.depwire = depwireServer;
    fs.writeFileSync(mcpPath, JSON.stringify(config, null, 2));
    c.ok(`Registered depwire code-map MCP server (.mcp.json)`);
  } catch (err) {
    c.warn(`Could not register depwire MCP server: ${err.message}`);
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

  installSkillTrees(p);
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

  // Deploy documentation foundations (idempotent — never overwrites user edits)
  const targetDocsDir = path.join(p.targetDir, 'docs');
  if (fs.existsSync(p.sourceDocsDir)) {
    try {
      fs.mkdirSync(targetDocsDir, { recursive: true });
      copyDocsIdempotent(p.sourceDocsDir, targetDocsDir);
      c.ok(`Installed documentation foundations`);
    } catch (err) {
      c.err(`Failed to install documentation foundations: ${err.message}`);
    }

    // Deploy llms.txt to project root (idempotent)
    const sourceLlms = path.join(p.sourceDocsDir, 'llms.txt');
    const targetLlms = path.join(p.targetDir, 'llms.txt');
    if (fs.existsSync(sourceLlms) && !fs.existsSync(targetLlms)) {
      try {
        fs.copyFileSync(sourceLlms, targetLlms);
        c.ok(`Installed llms.txt`);
      } catch (err) {
        c.err(`Failed to install llms.txt: ${err.message}`);
      }
    }
  }

  // Deploy the canonical AGENTS.md instruction router — the single source of truth every
  // agent tool is wired to. Must precede wireAgents so the CLAUDE.md → AGENTS.md link resolves.
  if (ensureAgentsMd(p)) c.ok(`Installed canonical AGENTS.md`);

  stampVersion(p);

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

  registerDepwireMcp(p.targetDir);

  printWiringGuidance(selected);

  console.log(`\n\x1b[32m[success]\x1b[0m GroundWork ${PKG.version} initialization complete!`);
  console.log(`          Ask your AI to run the \x1b[36mgroundwork-orchestrator\x1b[0m skill to find out what to do next.\n`);
}

// ─── update ─────────────────────────────────────────────────────────────────

function updateGroundWork() {
  const p = getPaths();

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

  // Diff before touching anything, so the summary reflects what actually changes.
  const skillsDiff = diffDirs(p.sourceSkillsDir, p.targetSkillsDir);
  const hiddenDiff = diffDirs(p.sourceHiddenSkillsDir, p.targetHiddenSkillsDir);

  const generatorsConfig = buildGeneratorsConfig();
  const targetGeneratorsJson = path.join(p.targetConfigDir, 'generators.json');
  const generatorsChanged =
    generatorsConfig !== null &&
    (!fs.existsSync(targetGeneratorsJson) ||
      fs.readFileSync(targetGeneratorsJson, 'utf8') !== generatorsConfig);

  const total =
    skillsDiff.added.length + skillsDiff.changed.length + skillsDiff.removed.length +
    hiddenDiff.added.length + hiddenDiff.changed.length + hiddenDiff.removed.length +
    (generatorsChanged ? 1 : 0);

  if (total === 0) {
    if (stamped !== PKG.version) stampVersion(p); // files identical, stamp drifted — repair silently
    c.ok(`Already up to date — installed skills match groundwork ${PKG.version}.`);
    console.log(`  \x1b[2m.groundwork/config and docs/ were not touched.\x1b[0m\n`);
    return;
  }

  if (stamped && stamped !== PKG.version) {
    c.info(`Updating ${stamped} → ${PKG.version}\n`);
  } else if (!stamped) {
    c.info(`No version stamp found (pre-0.9 install) — updating to ${PKG.version}\n`);
  }

  installSkillTrees(p);
  if (generatorsChanged) {
    fs.mkdirSync(p.targetConfigDir, { recursive: true });
    fs.writeFileSync(targetGeneratorsJson, generatorsConfig);
  }

  c.ok(`Updated GroundWork skills\n`);
  const report = (label, diff) => {
    if (diff.added.length + diff.changed.length + diff.removed.length === 0) return;
    console.log(`\x1b[1m${label}\x1b[0m`);
    for (const f of diff.added) console.log(`  \x1b[32m+ ${f}\x1b[0m`);
    for (const f of diff.changed) console.log(`  \x1b[33m~ ${f}\x1b[0m`);
    for (const f of diff.removed) console.log(`  \x1b[31m- ${f}\x1b[0m`);
  };
  report('.agents/skills/', skillsDiff);
  report('.agents/groundwork/skills/', hiddenDiff);
  if (generatorsChanged) console.log(`\x1b[1m.groundwork/config/\x1b[0m\n  \x1b[33m~ generators.json\x1b[0m`);

  console.log(`\n  \x1b[2mPreserved: .groundwork/config (state, settings), .groundwork/cache, docs/\x1b[0m\n`);

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

  stampVersion(p);
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

function checkGroundWork() {
  const p = getPaths();
  const docsDir = path.join(p.targetDir, 'docs');

  banner();

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

  if (!fs.existsSync(docsDir)) {
    c.err(`No docs/ directory found in ${p.targetDir} — nothing to check.`);
    process.exitCode = 1;
    return;
  }

  const stamped = readStampedVersion(p);
  if (stamped && stamped !== PKG.version) {
    c.warn(`Installed skills were written by groundwork ${stamped}; this CLI is ${PKG.version}.`);
    console.log(`         Run \x1b[36mnpx groundwork-method update\x1b[0m to refresh them.\n`);
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
    updateGroundWork();
    break;
  case 'check':
    // `check --help` documents behavior (incl. exit codes) instead of running.
    if (process.argv.includes('--help') || process.argv.includes('-h')) {
      printHelp();
      process.exit(0);
    }
    checkGroundWork();
    break;
  default:
    console.log(`Unknown command: ${command}`);
    printHelp();
    process.exit(1);
}
