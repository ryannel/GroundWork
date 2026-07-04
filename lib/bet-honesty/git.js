'use strict';

// Shared plumbing for the sealed-baseline scans (`honesty scan`, `wiring
// scan`): the git helpers, the approved-tag contract, and the test-file
// classifier both engines diff against. Everything here is judgment-free —
// the scans that require this module own their own heuristics and labels.
// Dependency-free: Node built-ins + git.

const path = require('path');
const { execFileSync } = require('child_process');

// Thrown when a scan cannot run at all (no git repo, no approved tag) — the
// CLI maps this to exit 2, distinct from exit 1 (findings).
class ScanUnavailableError extends Error {}

function approvedTag(slug) {
  return `bet/${slug}/approved`;
}

function git(cwd, args) {
  // stderr piped (not inherited): probe failures — a missing tag, a file absent
  // at a ref — are expected control flow here, never user-facing noise.
  return execFileSync('git', args, {
    cwd, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'],
  });
}

function gitLines(cwd, args) {
  return git(cwd, args).split('\n').filter(Boolean);
}

function showAt(cwd, ref, file) {
  // Content of a file at a ref; null when it doesn't exist there.
  try {
    return git(cwd, ['show', `${ref}:${file}`]);
  } catch {
    return null;
  }
}

// Verify the scan CAN run (git repo + sealed baseline); returns the approved
// tag to diff against, or throws ScanUnavailableError. Cannot-run must never
// masquerade as clean.
function ensureScannable(cwd, slug) {
  try {
    git(cwd, ['rev-parse', '--git-dir']);
  } catch {
    throw new ScanUnavailableError('not a git repository — the scan diffs HEAD against the sealed baseline');
  }
  const tag = approvedTag(slug);
  try {
    git(cwd, ['rev-parse', '--verify', '--quiet', `refs/tags/${tag}^{commit}`]);
  } catch {
    throw new ScanUnavailableError(`no approved tag '${tag}' — the scan needs the sealed baseline to diff against`);
  }
  return tag;
}

function isTestFile(file) {
  const base = path.basename(file);
  return (
    /(^|\/)(tests?|__tests__|spec)\//.test(file) ||
    /^test_/.test(base) ||
    /_test\.[^.]+$/.test(base) ||
    /\.(test|spec)\.[^.]+$/.test(base) ||
    base === 'conftest.py'
  );
}

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

module.exports = {
  ScanUnavailableError,
  approvedTag,
  git,
  gitLines,
  showAt,
  ensureScannable,
  isTestFile,
  escapeRegExp,
};
