// gw-seed-capture-hook — seeds the non-blocking capture reminder hook into a Claude Code install.
//
// init now seeds a PreToolUse hook (.groundwork/hooks/capture-reminder.js wired through
// .claude/settings.json) so a build/change/fix request edited directly, outside any GroundWork
// lane, prompts the agent to route through the orchestrator. This heals older installs that
// predate the hook. Claude Code-specific: an install with no .claude dir (native-only agents)
// is n/a — they cannot run Claude Code hooks. Additive toward other hooks: only our PreToolUse
// entry is added, and never duplicated.
//
// Contract (migrations/README.md): forward-only, idempotent, detect-first. detect() is read-only.

const fs = require('fs');
const path = require('path');

const HOOK_COMMAND = 'node "$CLAUDE_PROJECT_DIR/.groundwork/hooks/capture-reminder.js"';

function settingsHasHook(settingsPath) {
  if (!fs.existsSync(settingsPath)) return false;
  try {
    const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8')) || {};
    const pre = settings.hooks && Array.isArray(settings.hooks.PreToolUse) ? settings.hooks.PreToolUse : [];
    return pre.some(
      (g) => Array.isArray(g && g.hooks) && g.hooks.some((h) => h && typeof h.command === 'string' && h.command.includes('capture-reminder'))
    );
  } catch {
    return false;
  }
}

module.exports = {
  detect({ targetDir }) {
    if (!fs.existsSync(path.join(targetDir, '.groundwork'))) return 'n/a';
    // Claude Code-specific: no .claude dir means a native-only agent that cannot run the hook.
    if (!fs.existsSync(path.join(targetDir, '.claude'))) return 'n/a';
    const scriptThere = fs.existsSync(path.join(targetDir, '.groundwork', 'hooks', 'capture-reminder.js'));
    const wired = settingsHasHook(path.join(targetDir, '.claude', 'settings.json'));
    return scriptThere && wired ? 'done' : 'pending';
  },

  run({ targetDir, packageRoot }) {
    const src = path.join(packageRoot, 'src', 'hooks', 'capture-reminder.js');
    if (!fs.existsSync(src)) return; // nothing to seed from — leave the install as-is
    const hookDir = path.join(targetDir, '.groundwork', 'hooks');
    fs.mkdirSync(hookDir, { recursive: true });
    const dest = path.join(hookDir, 'capture-reminder.js');
    fs.copyFileSync(src, dest);
    fs.chmodSync(dest, 0o755);

    const settingsPath = path.join(targetDir, '.claude', 'settings.json');
    let settings = {};
    if (fs.existsSync(settingsPath)) {
      try {
        settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8')) || {};
      } catch {
        return; // unparseable settings — touching it risks clobbering the user's config
      }
    }
    if (!settings.hooks || typeof settings.hooks !== 'object') settings.hooks = {};
    const pre = Array.isArray(settings.hooks.PreToolUse) ? settings.hooks.PreToolUse : [];
    const already = pre.some(
      (g) => Array.isArray(g && g.hooks) && g.hooks.some((h) => h && typeof h.command === 'string' && h.command.includes('capture-reminder'))
    );
    if (already) return; // idempotent
    pre.push({ matcher: 'Edit|Write', hooks: [{ type: 'command', command: HOOK_COMMAND }] });
    settings.hooks.PreToolUse = pre;
    fs.mkdirSync(path.dirname(settingsPath), { recursive: true });
    fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + '\n');
  },
};
