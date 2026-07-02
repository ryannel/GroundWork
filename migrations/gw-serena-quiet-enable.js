// gw-serena-quiet-enable — silence Serena's dashboard popup and pre-approve the MCP server.
//
// init now registers Serena with --open-web-dashboard false (the user-level Serena config
// otherwise pops a browser dashboard tab on every MCP launch) and approves the project-scoped
// server in the committed .claude/settings.json (enabledMcpjsonServers). Without that approval
// Claude Code asks on every startup and tries to save the answer to .claude/settings.local.json —
// a write that fails through the .claude → .agents dir symlink, so the prompt returns every
// session. This heals older installs. Additive: the flag is appended only to a shipped-shape
// uvx serena entry (a user-customized command is untouched), and only "serena" is added to
// enabledMcpjsonServers (other entries preserved; unparseable settings left alone).
//
// Contract (migrations/README.md): forward-only, idempotent, detect-first. detect() is read-only.

const fs = require('fs');
const path = require('path');

const FLAG = '--open-web-dashboard';

function readJson(p) {
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8')) || null;
  } catch {
    return null;
  }
}

// The shipped-shape serena entry, or null when absent/user-customized — only ours to edit.
function serenaEntry(targetDir) {
  const config = readJson(path.join(targetDir, '.mcp.json'));
  const entry = config && config.mcpServers && config.mcpServers.serena;
  if (!entry || entry.command !== 'uvx' || !Array.isArray(entry.args) || !entry.args.includes('start-mcp-server')) return null;
  return { config, entry };
}

function argsNeedFlag(targetDir) {
  const found = serenaEntry(targetDir);
  return Boolean(found && !found.entry.args.includes(FLAG));
}

function settingsNeedApproval(targetDir) {
  // Claude Code-specific: no .claude dir means a native-only agent that never sees the prompt.
  if (!fs.existsSync(path.join(targetDir, '.claude'))) return false;
  const settingsPath = path.join(targetDir, '.claude', 'settings.json');
  if (!fs.existsSync(settingsPath)) return true;
  const settings = readJson(settingsPath);
  if (settings === null) return false; // unparseable — touching it risks clobbering the user's config
  return !(Array.isArray(settings.enabledMcpjsonServers) && settings.enabledMcpjsonServers.includes('serena'));
}

module.exports = {
  detect({ targetDir }) {
    if (!fs.existsSync(path.join(targetDir, '.groundwork'))) return 'n/a';
    // Applies to installs with our serena entry or a Claude Code wiring; neither → n/a.
    if (!serenaEntry(targetDir) && !fs.existsSync(path.join(targetDir, '.claude'))) return 'n/a';
    return argsNeedFlag(targetDir) || settingsNeedApproval(targetDir) ? 'pending' : 'done';
  },

  run({ targetDir }) {
    if (argsNeedFlag(targetDir)) {
      const { config, entry } = serenaEntry(targetDir);
      entry.args.push(FLAG, 'false');
      fs.writeFileSync(path.join(targetDir, '.mcp.json'), JSON.stringify(config, null, 2));
    }
    if (settingsNeedApproval(targetDir)) {
      const settingsPath = path.join(targetDir, '.claude', 'settings.json');
      const settings = (fs.existsSync(settingsPath) && readJson(settingsPath)) || {};
      const enabled = Array.isArray(settings.enabledMcpjsonServers) ? settings.enabledMcpjsonServers : [];
      settings.enabledMcpjsonServers = [...enabled, 'serena'];
      fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + '\n');
    }
  },
};
