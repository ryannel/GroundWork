// gw-bet-prose-redesign — retire the machine-readable bet artifacts for the prose model.
//
// The bet became pure prose: every machine-readable artifact is now built in code at
// Delivery. Three shapes are gone — `docs/bets/<slug>/decomposition.json` (the suite and
// git are the record), `docs/bets/<slug>/contracts/` (the prose API/data design carries the
// shapes; the canonical contract is captured from the running service into `docs/architecture/api/<service>/`),
// and the monolithic `decomposition.md` (now a browsable `decomposition/` prose tree). The
// approval baseline moved from `approval_commit` in `decomposition.json` to the git tag
// `bet/<slug>/approved` on the approved-prose commit.
//
// Restructuring a *live* bet's docs is risky, so this migration is largely ADVISORY: it
// prints the model change and names any active bet a contributor must restructure by hand.
// Where cleanup is SAFE and mechanical it acts — already-DELIVERED bets under
// `docs/bets/_archive/` (whose contracts were already captured to `docs/architecture/api/` at Validation)
// and stray `.groundwork/bets/<slug>/decomposition.json` files have their obsolete
// `decomposition.json` / `contracts/` artifacts removed. Active bets are advised, never mutated;
// their prose record (including any archived `decomposition.md`) is left untouched.
//
// Contract (migrations/README.md): forward-only, idempotent, detect-first.
// detect() is read-only (update --dry-run calls it). Node built-ins only.

const fs = require('fs');
const path = require('path');

function listDirs(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);
}

// Obsolete artifacts that are SAFE to delete: stray .groundwork/bets/<slug>/decomposition.json
// and, under archived (delivered) bets, decomposition.json files + contracts/ directories.
function obsoleteArtifacts(targetDir) {
  const out = { files: [], dirs: [] };

  const groundworkBets = path.join(targetDir, '.groundwork', 'bets');
  for (const slug of listDirs(groundworkBets)) {
    const p = path.join(groundworkBets, slug, 'decomposition.json');
    if (fs.existsSync(p)) out.files.push(p);
  }

  const archive = path.join(targetDir, 'docs', 'bets', '_archive');
  for (const slug of listDirs(archive)) {
    const j = path.join(archive, slug, 'decomposition.json');
    if (fs.existsSync(j)) out.files.push(j);
    const c = path.join(archive, slug, 'contracts');
    if (fs.existsSync(c)) out.dirs.push(c);
  }

  return out;
}

// Active (non-archived) bets still carrying an old-shape artifact — advise, never mutate.
function activeBetsNeedingAttention(targetDir) {
  const betsDir = path.join(targetDir, 'docs', 'bets');
  const flagged = [];
  for (const slug of listDirs(betsDir)) {
    if (slug === '_archive') continue;
    const betDir = path.join(betsDir, slug);
    const stale = [];
    if (fs.existsSync(path.join(betDir, 'decomposition.md'))) stale.push('decomposition.md');
    if (fs.existsSync(path.join(betDir, 'decomposition.json'))) stale.push('decomposition.json');
    if (fs.existsSync(path.join(betDir, 'contracts'))) stale.push('contracts/');
    if (stale.length > 0) flagged.push({ slug, stale });
  }
  return flagged;
}

module.exports = {
  detect({ targetDir }) {
    if (!fs.existsSync(path.join(targetDir, '.groundwork'))) return 'n/a'; // not a GroundWork install
    const obsolete = obsoleteArtifacts(targetDir);
    const active = activeBetsNeedingAttention(targetDir);
    if (obsolete.files.length || obsolete.dirs.length || active.length) return 'pending';
    return 'done';
  },

  run({ targetDir }) {
    const obsolete = obsoleteArtifacts(targetDir);
    for (const f of obsolete.files) fs.rmSync(f, { force: true });
    for (const d of obsolete.dirs) fs.rmSync(d, { recursive: true, force: true });

    const removed = obsolete.files.length + obsolete.dirs.length;
    if (removed > 0) {
      console.log(`  Removed ${removed} obsolete bet artifact(s) (decomposition.json / contracts/) from delivered or stray bets.`);
    }

    console.log('  The bet is now pure prose; its machine-readable artifacts are built in code at Delivery:');
    console.log('    • docs/bets/<slug>/decomposition.md  →  a browsable docs/bets/<slug>/decomposition/ prose tree');
    console.log('    • decomposition.json is dropped — the bet-progress suite plus git history are the record');
    console.log('    • docs/bets/<slug>/contracts/ is removed — the prose API/data design carries the shapes,');
    console.log('      and the canonical contract is captured into docs/architecture/api/<service>/ from the running service');
    console.log('    • the approval baseline is the git tag bet/<slug>/approved on the approved-prose commit');

    const active = activeBetsNeedingAttention(targetDir);
    if (active.length > 0) {
      console.log('  Active bets still carry old-shape artifacts — restructure these by hand (left untouched here):');
      for (const { slug, stale } of active) {
        console.log(`    • ${slug}: ${stale.join(', ')}`);
      }
    }
  },
};
