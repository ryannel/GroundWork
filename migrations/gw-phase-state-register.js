// gw-phase-state-register — Add the phase_states register to state.json
//
// init now seeds state.json with a `phase_states` object (schema version 3):
// the register that lets a setup phase be `deferred`, `collapsed`, or `na`
// instead of only present-in-`completed` or missing. The orchestrator's
// routing and Setup Graduation predicate read it (doc-canon-and-onboarding-diet
// plan, slice B1). Installs seeded before 0.17.0 lack the key.
//
// Contract (migrations/README.md): forward-only, idempotent, detect-first.
// detect() MUST be read-only — `update --dry-run` calls it. Use only Node built-ins;
// never import from bin/. ctx = { targetDir, packageRoot }.

const fs = require('fs');
const path = require('path');

function statePath(targetDir) {
  return path.join(targetDir, '.groundwork', 'config', 'state.json');
}

module.exports = {
  detect({ targetDir }) {
    const p = statePath(targetDir);
    if (!fs.existsSync(p)) return 'n/a';
    try {
      const state = JSON.parse(fs.readFileSync(p, 'utf8'));
      return state.phase_states !== undefined ? 'done' : 'pending';
    } catch {
      // Unreadable state is not this migration's to repair.
      return 'n/a';
    }
  },

  run({ targetDir }) {
    const p = statePath(targetDir);
    const state = JSON.parse(fs.readFileSync(p, 'utf8'));
    if (state.phase_states === undefined) state.phase_states = {};
    if (typeof state.version === 'number' && state.version < 3) state.version = 3;
    fs.writeFileSync(p, JSON.stringify(state, null, 2) + '\n');
  },
};
