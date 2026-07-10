// gw-live-first-bets-meta — insert `_live` first into docs/bets/meta.json.
//
// review-throughput plan, Wave 3a, slice C3b. The docsite's own
// scripts/sync-live-bets.js (C3) creates docs/bets/meta.json itself, with
// `_live` sorted first, whenever docs/bets/ exists and meta.json is absent — it
// runs at every docsite boot and is that file's natural owner. This migration is
// NOT a general seeder: it only heals an install whose docs/bets/meta.json
// already exists (authored before `_live` existed, or hand-tuned since) without
// `_live` in `pages`, so the in-flight mirror sorts first in the Bets rail
// instead of wherever the `...` expansion would place it. An absent meta.json is
// left alone — the sync creates it correctly on its very next run, so touching
// it here would just race the sync for no benefit.
//
// Contract (migrations/README.md): forward-only, idempotent, detect-first.
// detect() MUST be read-only — `update --dry-run` calls it. Use only Node
// built-ins; never import from bin/. ctx = { targetDir, packageRoot }.

const fs = require('fs');
const path = require('path');

// A docs-site service is registered when some `.dev/dev.config.json` runner's
// cwd contains scripts/sync-live-bets.js — name-independent (a project can name
// the service anything), and self-contained (reads the runner registry rather
// than scanning the whole tree, and never imports bin/'s generator helpers).
function hasDocsSiteService(targetDir) {
  let config;
  try {
    config = JSON.parse(fs.readFileSync(path.join(targetDir, '.dev', 'dev.config.json'), 'utf8'));
  } catch {
    return false;
  }
  const runners = Array.isArray(config.runners) ? config.runners : [];
  return runners.some(
    (runner) =>
      runner &&
      typeof runner.cwd === 'string' &&
      // resolve, not join: registerRunner writes project-relative cwds, but a
      // hand-tuned absolute cwd must not silently probe the wrong path.
      fs.existsSync(path.resolve(targetDir, runner.cwd, 'scripts', 'sync-live-bets.js')),
  );
}

function betsMetaPath(targetDir) {
  return path.join(targetDir, 'docs', 'bets', 'meta.json');
}

function readBetsMeta(targetDir) {
  try {
    return JSON.parse(fs.readFileSync(betsMetaPath(targetDir), 'utf8'));
  } catch {
    return null; // absent or unparseable — never ours to create or fix
  }
}

module.exports = {
  detect({ targetDir }) {
    if (!hasDocsSiteService(targetDir)) return 'n/a';
    const meta = readBetsMeta(targetDir);
    if (meta == null || !Array.isArray(meta.pages)) return 'n/a'; // absent, or not the expected shape — never guess
    return meta.pages.includes('_live') ? 'done' : 'pending';
  },

  run({ targetDir }) {
    const meta = readBetsMeta(targetDir);
    if (meta == null || !Array.isArray(meta.pages) || meta.pages.includes('_live')) return; // idempotent guard
    meta.pages = ['_live', ...meta.pages];
    fs.writeFileSync(betsMetaPath(targetDir), JSON.stringify(meta, null, 2) + '\n');
  },
};
