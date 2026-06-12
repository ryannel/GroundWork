// gw-<id> — <one-line imperative title>
//
// <Why this migration exists: what init does now that update never did, or what
// shape moved. cli migrations are mechanical — if the change needs judgment about
// the user's content, write an agent brief instead (see _template/brief.md).>
//
// Contract (migrations/README.md): forward-only, idempotent, detect-first.
// detect() MUST be read-only — `update --dry-run` calls it. Use only Node built-ins;
// never import from bin/. ctx = { targetDir, packageRoot }.

const fs = require('fs');
const path = require('path');

module.exports = {
  detect({ targetDir, packageRoot }) {
    // Return 'pending' when the migration is owed, 'done' when the project already
    // has the end state (however it got there), 'n/a' when it does not apply —
    // e.g. the feature was never installed, or acting would risk user content.
    return 'n/a';
  },

  run({ targetDir, packageRoot }) {
    // Reach the end state. Running twice must be a no-op. Throwing stops the
    // update with this migration named and the version stamp not advanced.
  },
};
