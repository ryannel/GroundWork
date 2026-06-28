#!/usr/bin/env node
// GroundWork capture reminder — a non-blocking Claude Code PreToolUse hook.
//
// Why this exists: GroundWork routes a build/change/fix request through the
// orchestrator, which sizes it into a patch, quick bet, or bet. But a coding
// request mid-session ("add a delete button" three turns into other work) is
// exactly when a model tends to just edit files directly, bypassing the process.
// Soft instructions in AGENTS.md and the orchestrator description only reliably
// fire on a fresh session; this hook is the deterministic mid-session signal.
//
// It is advisory only: it NEVER blocks the edit (always exits 0). When an edit
// looks like direct implementation outside any active GroundWork lane, it adds a
// one-line reminder to the model's context via `additionalContext`. The model
// reads it and can choose to route the work; a user who genuinely wants the quick
// edit loses nothing.
//
// Suppression — the reminder stays silent when:
//   • GroundWork is not installed here (no .groundwork/ dir);
//   • a lane is actively driving edits (the `.groundwork/cache/active-lane`
//     sentinel exists — delivery and the patch lane write it on entry, clear it
//     on close), so it never nags inside a bet/quick-bet/patch;
//   • the edit is inside a bet worktree (delivery isolates there);
//   • the edit targets a GroundWork process artifact (docs/, .groundwork/,
//     tests/bets/) rather than product code.
//
// Claude Code-specific: AGENTS.md-native agents (Cursor/Codex/Cline) do not run
// Claude Code hooks, so for them capture stays soft. That residual is documented.

const fs = require('fs');
const path = require('path');

function readStdin() {
  try {
    return fs.readFileSync(0, 'utf8');
  } catch {
    return '';
  }
}

function emit(context) {
  // Non-blocking advisory: exit 0, surface `additionalContext` to the model.
  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        additionalContext: context,
      },
    })
  );
  process.exit(0);
}

function silent() {
  process.exit(0);
}

let payload = {};
try {
  payload = JSON.parse(readStdin() || '{}');
} catch {
  silent();
}

const projectDir = process.env.CLAUDE_PROJECT_DIR || payload.cwd || process.cwd();
const filePath = (payload.tool_input && payload.tool_input.file_path) || '';

// Not a GroundWork project — nothing to route.
if (!fs.existsSync(path.join(projectDir, '.groundwork'))) silent();

// A lane is actively driving edits — don't nag inside the process.
if (fs.existsSync(path.join(projectDir, '.groundwork', 'cache', 'active-lane'))) silent();

const norm = String(filePath).replace(/\\/g, '/');

// Edits inside a bet worktree are delivery doing its job.
if (/(^|\/)\.?(claude\/)?worktrees\//.test(norm)) silent();

// Edits to GroundWork's own process artifacts are part of the lifecycle, not
// product code a request would bypass the process to change.
const rel = path.relative(projectDir, norm);
if (
  rel === '' ||
  rel.startsWith('..') ||
  /^(docs|tests\/bets)\//.test(rel) ||
  rel.startsWith('.groundwork/') ||
  rel.startsWith('.agents/') ||
  rel.startsWith('.claude/')
) {
  silent();
}

emit(
  'GroundWork is installed in this project. This edit looks like direct implementation made ' +
    'outside the GroundWork process. If this change came from a "build / add / change / fix" ' +
    'request, run the groundwork-orchestrator skill first so it can size the work — patch, quick ' +
    'bet, or bet — and route it through the right lane (the process is how the change gets ' +
    'designed, proven, and recorded). If you are already working inside a lane, ignore this.'
);
