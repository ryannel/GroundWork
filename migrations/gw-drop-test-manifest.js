// gw-drop-test-manifest — remove orphaned bet test-manifest.json seal files.
//
// The SHA-256 test-manifest seal was removed: `./dev bet sign` no longer exists, and
// `./dev test bet` no longer verifies a manifest. An approved bet suite is now held to
// its definition of done by the approval commit + the delivery review reconciliation
// (groundwork-bet workflows 03/04). The dev-bundle update removes the `bet sign` command
// itself; this deletes the now-inert .groundwork/bets/<slug>/test-manifest.json files it
// used to write. decomposition.json and everything else under the bet dir are untouched.
//
// Contract (migrations/README.md): forward-only, idempotent, detect-first.
// detect() is read-only (update --dry-run calls it). Node built-ins only.

const fs = require('fs');
const path = require('path');

function manifestPaths(targetDir) {
  const betsDir = path.join(targetDir, '.groundwork', 'bets');
  if (!fs.existsSync(betsDir)) return [];
  return fs
    .readdirSync(betsDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => path.join(betsDir, d.name, 'test-manifest.json'))
    .filter((p) => fs.existsSync(p));
}

module.exports = {
  detect({ targetDir }) {
    if (!fs.existsSync(path.join(targetDir, '.groundwork'))) return 'n/a'; // not a GroundWork install
    return manifestPaths(targetDir).length > 0 ? 'pending' : 'done';
  },

  run({ targetDir }) {
    for (const p of manifestPaths(targetDir)) {
      fs.rmSync(p, { force: true });
    }
  },
};
