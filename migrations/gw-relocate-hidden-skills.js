// gw-relocate-hidden-skills — remove the orphaned .agents/groundwork/skills/ tree.
//
// Hidden methodology skills moved from .agents/groundwork/skills/ to .groundwork/skills/
// so no agent's skill scanner can pick them up. update installs the new tree at
// .groundwork/skills/ (clean-copy), but the old location is outside that copy and would
// linger as dead files. This deletes it. The promoted engineer skills under
// .agents/skills/groundwork-*-engineer/ are a different tree and are left untouched.
//
// Contract (migrations/README.md): forward-only, idempotent, detect-first.
// detect() is read-only (update --dry-run calls it). Node built-ins only.

const fs = require('fs');
const path = require('path');

function oldHiddenDir(targetDir) {
  return path.join(targetDir, '.agents', 'groundwork', 'skills');
}

module.exports = {
  detect({ targetDir }) {
    if (!fs.existsSync(path.join(targetDir, '.groundwork'))) return 'n/a'; // not a GroundWork install
    return fs.existsSync(oldHiddenDir(targetDir)) ? 'pending' : 'done';
  },

  run({ targetDir }) {
    const dir = oldHiddenDir(targetDir);
    if (fs.existsSync(dir)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
    // Drop the now-empty .agents/groundwork/ wrapper so nothing dangling remains.
    const wrapper = path.join(targetDir, '.agents', 'groundwork');
    try {
      if (fs.existsSync(wrapper) && fs.readdirSync(wrapper).length === 0) {
        fs.rmdirSync(wrapper);
      }
    } catch {
      /* a non-empty or racing wrapper is fine — leave it */
    }
  },
};
