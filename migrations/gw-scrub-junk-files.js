// gw-scrub-junk-files — remove OS junk files an older deploy path copied in.
//
// Before 0.17.0 the init/update deploy path copied source trees verbatim, so a
// framework installed from an npm-linked dev checkout could deploy macOS/Windows
// junk (.DS_Store, Thumbs.db, desktop.ini) into docs/ and both skill trees — and
// record it in the manifest as framework-owned. The deploy path now filters junk
// at every walk and copy; this migration cleans what older versions already left
// behind. Scope deliberately includes the skill trees: an equal-version update
// takes a no-op early exit that skips the reinstall sweep, so a pending detect
// here is what forces the full deploy path (and manifest rebuild) to run.
//
// Only the unambiguous junk names are deleted. Editor backups (`*~`) are junk in
// the package source but can be a user's own file in docs/ or an authored skill,
// so they are filtered on deploy, never deleted here.
//
// Contract (migrations/README.md): forward-only, idempotent, detect-first.
// detect() is read-only (update --dry-run calls it). Node built-ins only.

const fs = require('fs');
const path = require('path');

const JUNK_FILE_NAMES = new Set(['.DS_Store', 'Thumbs.db', 'desktop.ini']);

const SCRUB_ROOTS = ['docs', path.join('.agents', 'skills'), path.join('.groundwork', 'skills')];

function junkFilesUnder(dir, out = []) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return out; // absent or unreadable — nothing to scrub here
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) junkFilesUnder(full, out);
    else if (JUNK_FILE_NAMES.has(entry.name)) out.push(full);
  }
  return out;
}

function allJunkFiles(targetDir) {
  return SCRUB_ROOTS.flatMap((root) => junkFilesUnder(path.join(targetDir, root)));
}

module.exports = {
  detect({ targetDir }) {
    if (!fs.existsSync(path.join(targetDir, '.groundwork'))) return 'n/a'; // not a GroundWork install
    return allJunkFiles(targetDir).length > 0 ? 'pending' : 'done';
  },

  run({ targetDir }) {
    for (const file of allJunkFiles(targetDir)) {
      fs.rmSync(file, { force: true });
    }
  },
};
