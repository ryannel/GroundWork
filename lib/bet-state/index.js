'use strict';

// Durable per-bet engine state: the findings ledger and the default+veto
// decisions queue. These record owner judgment that is NOT re-derivable from
// git or the suite — a finding's disposition, a decision's ratification and the
// owner's verbatim response — so unlike the cache-tier board/memlog they live in
// a COMMITTED location and never self-heal from reconstruction. This module is
// the deterministic producer the delivery workflow's prose used to ask the driver
// to maintain by hand (W1.4 findings ledger, W1.6 decisions queue); the Wave-2
// `groundwork state` verb will later fold both files into one bet-state document.
//
// Dependency-free: Node built-ins only.

const fs = require('fs');
const path = require('path');

const SCHEMA = 1;

const FINDING_BUCKETS = ['decision-needed', 'patch', 'defer', 'dismiss'];
const FINDING_DISPOSITIONS = ['fixed', 'deferred-with-owner', 'dismissed-with-reason'];
// deferred/dismissed dispositions carry an owner or a reason — a bare status
// would drop exactly the accountability the ledger exists to keep.
const DISPOSITION_REQUIRES_NOTE = ['deferred-with-owner', 'dismissed-with-reason'];
const DECISION_OUTCOMES = ['ratified', 'vetoed'];

// ─── Paths & IO ─────────────────────────────────────────────────────────────

// Durable, committed home — a sibling of the gitignored `.groundwork/cache/`,
// never inside it. `groundwork state` (Wave 2) absorbs this directory.
function betDir(targetDir, slug) {
  return path.join(targetDir, '.groundwork', 'bets', slug);
}

function findingsPath(targetDir, slug) {
  return path.join(betDir(targetDir, slug), 'findings.json');
}

function decisionsPath(targetDir, slug) {
  return path.join(betDir(targetDir, slug), 'decisions.json');
}

function readDoc(file, slug, key) {
  if (!fs.existsSync(file)) {
    return { schema: SCHEMA, bet: slug, [key]: [] };
  }
  let doc;
  try {
    doc = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (err) {
    throw new Error(`${path.basename(file)} is not valid JSON (${err.message}) — refusing to overwrite it`);
  }
  if (!Array.isArray(doc[key])) doc[key] = [];
  if (!doc.bet) doc.bet = slug;
  doc.schema = doc.schema || SCHEMA;
  return doc;
}

function writeDoc(file, doc) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(doc, null, 2) + '\n');
}

function nowIso(clock) {
  // `clock` is injectable so tests are deterministic; defaults to real time.
  return (clock ? clock() : new Date()).toISOString();
}

function nextId(items, prefix) {
  let max = 0;
  for (const it of items) {
    const m = /^([A-Z])(\d+)$/.exec(it.id || '');
    if (m && m[1] === prefix) max = Math.max(max, Number(m[2]));
  }
  return `${prefix}${max + 1}`;
}

// ─── --since (E3): a shared ISO 8601 filter ────────────────────────────────
// `findings list` / `decisions list --since <iso>` scope the ledger to items
// created OR closed/ratified at-or-after the stamp. Additive: `since` omitted
// (undefined/null) is a no-op, so every existing caller is unaffected. Invalid
// input throws — callers (bin/groundwork.js) turn that into a clear exit 2.
function parseSince(since) {
  if (since == null) return null;
  if (typeof since !== 'string' || !since.trim()) {
    throw new Error('--since requires an ISO 8601 date/time value');
  }
  const ms = Date.parse(since);
  if (Number.isNaN(ms)) {
    throw new Error(`--since '${since}' is not a valid ISO 8601 date/time`);
  }
  return ms;
}

// ─── Findings ───────────────────────────────────────────────────────────────

function addFinding(targetDir, slug, { slice, milestone, lens, bucket, title, location }, clock) {
  if (!title) throw new Error('a finding needs a --title');
  if (!bucket || !FINDING_BUCKETS.includes(bucket)) {
    throw new Error(`--bucket must be one of: ${FINDING_BUCKETS.join(', ')}`);
  }
  const file = findingsPath(targetDir, slug);
  const doc = readDoc(file, slug, 'findings');
  const finding = {
    id: nextId(doc.findings, 'F'),
    title,
    bucket,
    status: 'open',
    slice: slice || null,
    milestone: milestone != null ? Number(milestone) : null,
    lens: lens || null,
    location: location || null,
    disposition: null,
    note: null,
    created: nowIso(clock),
    closed: null,
  };
  doc.findings.push(finding);
  writeDoc(file, doc);
  return finding;
}

function dispositionFinding(targetDir, slug, { id, as, note }, clock) {
  if (!id) throw new Error('disposition needs a --id');
  if (!as || !FINDING_DISPOSITIONS.includes(as)) {
    throw new Error(`--as must be one of: ${FINDING_DISPOSITIONS.join(', ')}`);
  }
  if (DISPOSITION_REQUIRES_NOTE.includes(as) && !note) {
    throw new Error(`--note is required for '${as}' (the owner or the reason must be recorded, never dropped)`);
  }
  const file = findingsPath(targetDir, slug);
  const doc = readDoc(file, slug, 'findings');
  const finding = doc.findings.find((f) => f.id === id);
  if (!finding) throw new Error(`no finding '${id}' in ${slug}`);
  finding.status = 'closed';
  finding.disposition = as;
  finding.note = note || null;
  finding.closed = nowIso(clock);
  writeDoc(file, doc);
  return finding;
}

function listFindings(targetDir, slug, { status, milestone, slice, since } = {}) {
  const doc = readDoc(findingsPath(targetDir, slug), slug, 'findings');
  const sinceMs = parseSince(since);
  return doc.findings.filter((f) => {
    if (status && f.status !== status) return false;
    if (milestone != null && f.milestone !== Number(milestone)) return false;
    if (slice && f.slice !== slice) return false;
    if (sinceMs != null) {
      // created OR closed at-or-after the stamp — a finding raised earlier but
      // only just dispositioned still counts as recent activity.
      const createdMs = f.created ? Date.parse(f.created) : NaN;
      const closedMs = f.closed ? Date.parse(f.closed) : NaN;
      const createdMatches = !Number.isNaN(createdMs) && createdMs >= sinceMs;
      const closedMatches = !Number.isNaN(closedMs) && closedMs >= sinceMs;
      if (!createdMatches && !closedMatches) return false;
    }
    return true;
  });
}

// The gate: open findings in scope. Empty array === clear to close.
function openFindings(targetDir, slug, scope = {}) {
  return listFindings(targetDir, slug, { ...scope, status: 'open' });
}

// ─── Decisions ──────────────────────────────────────────────────────────────

function addDecision(targetDir, slug, { milestone, question, default: dflt, rationale }, clock) {
  if (!question) throw new Error('a decision needs a --question');
  if (!dflt) throw new Error('a decision needs a --default (the recommended action)');
  if (!rationale) throw new Error('a decision needs a --rationale (one line on why the default is right)');
  const file = decisionsPath(targetDir, slug);
  const doc = readDoc(file, slug, 'decisions');
  const decision = {
    id: nextId(doc.decisions, 'D'),
    question,
    default: dflt,
    rationale,
    milestone: milestone != null ? Number(milestone) : null,
    status: 'pending',
    created: nowIso(clock),
    // The durable human-in-the-loop record — populated only on ratify/veto.
    ratification: null,
  };
  doc.decisions.push(decision);
  writeDoc(file, doc);
  return decision;
}

function listDecisions(targetDir, slug, { status, since } = {}) {
  const doc = readDoc(decisionsPath(targetDir, slug), slug, 'decisions');
  const sinceMs = parseSince(since);
  return doc.decisions.filter((d) => {
    if (status && d.status !== status) return false;
    if (sinceMs != null) {
      // created OR ratified (ratification.ts) at-or-after the stamp.
      const createdMs = d.created ? Date.parse(d.created) : NaN;
      const ratifiedMs = d.ratification && d.ratification.ts ? Date.parse(d.ratification.ts) : NaN;
      const createdMatches = !Number.isNaN(createdMs) && createdMs >= sinceMs;
      const ratifiedMatches = !Number.isNaN(ratifiedMs) && ratifiedMs >= sinceMs;
      if (!createdMatches && !ratifiedMatches) return false;
    }
    return true;
  });
}

function pendingDecisions(targetDir, slug) {
  return listDecisions(targetDir, slug, { status: 'pending' });
}

// Ratify (or veto) — records the owner's VERBATIM response so the exchange is
// auditable durable state, not a memlog line. `--response` is mandatory: the one
// place the human-in-the-loop mechanic used to lean on narration.
function ratifyDecisions(targetDir, slug, { id, all, response, outcome, at }, clock) {
  if (!response) throw new Error("ratify needs the owner's verbatim --response");
  const decidedOutcome = outcome || 'ratified';
  if (!DECISION_OUTCOMES.includes(decidedOutcome)) {
    throw new Error(`--as must be one of: ${DECISION_OUTCOMES.join(', ')}`);
  }
  const file = decisionsPath(targetDir, slug);
  const doc = readDoc(file, slug, 'decisions');

  let targets;
  if (all) {
    targets = doc.decisions.filter((d) => d.status === 'pending');
    if (!targets.length) throw new Error(`no pending decisions in ${slug} to ratify`);
  } else {
    if (!id) throw new Error('ratify needs a --id (or --all)');
    const one = doc.decisions.find((d) => d.id === id);
    if (!one) throw new Error(`no decision '${id}' in ${slug}`);
    if (one.status !== 'pending') throw new Error(`decision '${id}' is already ${one.status}`);
    targets = [one];
  }

  const stamp = {
    outcome: decidedOutcome,
    response,
    at: at || null,
    ts: nowIso(clock),
  };
  for (const d of targets) {
    d.status = decidedOutcome; // 'ratified' | 'vetoed'
    d.ratification = { ...stamp };
  }
  writeDoc(file, doc);
  return targets;
}

module.exports = {
  SCHEMA,
  FINDING_BUCKETS,
  FINDING_DISPOSITIONS,
  DECISION_OUTCOMES,
  betDir,
  findingsPath,
  decisionsPath,
  parseSince,
  addFinding,
  dispositionFinding,
  listFindings,
  openFindings,
  addDecision,
  listDecisions,
  pendingDecisions,
  ratifyDecisions,
};
