'use strict';

// The composed bet-state view — Wave 2's capstone verb (v1).
//
// "One state, generated views" (plan §0 principle 2) lands incrementally: this
// module composes every engine fact about a bet — the sealed baseline, seal
// integrity, the findings ledger, the decisions queue, per-milestone pack
// freshness, and the cache-tier board pointer — into ONE document, so a fresh
// context (a resuming driver, a validator, a checkpoint walkthrough) reads a
// single view instead of five files. The durable inputs (findings.json,
// decisions.json) are already the engine's source of truth; this view never
// duplicates them into a second store — it is computed on demand.
//
// v1 scope, stated honestly: the composed READ view + the aggregate `--check`
// gate. The full projection flip — board.yaml, status frontmatter, and ledger
// cells becoming generated views of this document — is the recorded follow-on
// (plan §4); the board keeps its Wave-1 contract (cache-tier, never gates).
//
// Dependency-free: Node built-ins + git. Requires only sibling lib modules.

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const betState = require('./index');
const betGate = require('../bet-gate');
const betPack = require('../bet-pack');

function git(cwd, args) {
  try {
    return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  } catch {
    return null;
  }
}

function readPitchStatus(targetDir, slug) {
  const pitch = path.join(targetDir, 'docs', 'bets', slug, 'pitch.md');
  try {
    const text = fs.readFileSync(pitch, 'utf8');
    const front = text.startsWith('---') ? text.split('---')[1] : '';
    const m = /(^|\n)status:\s*(\S+)/.exec(front);
    return m ? m[2] : null;
  } catch {
    return null;
  }
}

// The board is cache-tier and never gates — read the three scalar pointers
// without taking a YAML dependency into this module.
function readBoard(targetDir, slug) {
  const file = path.join(targetDir, '.groundwork', 'cache', 'bets', slug, 'board.yaml');
  if (!fs.existsSync(file)) return { present: false };
  const text = fs.readFileSync(file, 'utf8');
  const scalar = (key) => {
    const m = new RegExp(`(^|\\n)${key}:\\s*(.+)`).exec(text);
    return m ? m[2].trim() : null;
  };
  return { present: true, step: scalar('step'), mode: scalar('mode'), updated: scalar('updated') };
}

function listMilestones(targetDir, slug) {
  const dec = path.join(targetDir, 'docs', 'bets', slug, 'decomposition');
  try {
    return fs.readdirSync(dec, { withFileTypes: true })
      .filter((e) => e.isDirectory() && /^\d\d-/.test(e.name))
      .map((e) => Number(e.name.slice(0, 2)))
      .sort((a, b) => a - b);
  } catch {
    return [];
  }
}

function composeState(targetDir, slug) {
  const tag = `bet/${slug}/approved`;
  const sha = git(targetDir, ['rev-list', '-n', '1', tag]);

  const seal = betGate.sealVerify(targetDir, slug);

  const openFindings = betState.listFindings(targetDir, slug, { status: 'open' });
  const closedFindings = betState.listFindings(targetDir, slug, { status: 'closed' });

  const decisions = betState.listDecisions(targetDir, slug, {});
  const pending = decisions.filter((d) => d.status === 'pending');

  const packs = listMilestones(targetDir, slug).map((n) => {
    try {
      const r = betPack.checkPack(targetDir, slug, n);
      return { milestone: n, status: r.status, compiled_from: r.compiled_from || null };
    } catch (err) {
      return { milestone: n, status: 'unavailable', detail: err.message };
    }
  });

  const staleness = {
    seal_drift: seal.status === 'drift',
    open_findings: openFindings.length,
    pending_decisions: pending.length,
    stale_packs: packs.filter((pk) => pk.status === 'stale').length,
  };

  return {
    bet: slug,
    approved: sha ? { tag, sha } : null,
    pitch_status: readPitchStatus(targetDir, slug),
    seal: { status: seal.status, drifted: seal.drifted || [] },
    findings: {
      open: openFindings.length,
      closed: closedFindings.length,
      open_items: openFindings.map((f) => ({ id: f.id, bucket: f.bucket, title: f.title, slice: f.slice, milestone: f.milestone })),
    },
    decisions: {
      pending: pending.length,
      ratified: decisions.filter((d) => d.status === 'ratified').length,
      vetoed: decisions.filter((d) => d.status === 'vetoed').length,
      pending_items: pending.map((d) => ({ id: d.id, question: d.question, default: d.default })),
    },
    packs,
    board: readBoard(targetDir, slug),
    // The aggregate gate `state --check` evaluates. The board and pitch status
    // never appear here — they report, they do not gate (Wave-1 contract).
    gates: staleness,
    clean: seal.status !== 'drift' && openFindings.length === 0 && staleness.stale_packs === 0,
  };
}

module.exports = { composeState };
