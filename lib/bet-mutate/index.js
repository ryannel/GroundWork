'use strict';

// The deletion test, mechanized. The coverage lens's sharpest question — "would
// this suite even notice if the implementation vanished?" — made runnable:
// revert the slice's SOURCE changes to the sealed baseline while KEEPING its
// tests at HEAD, run the slice's test command, and demand red. A suite that
// stays green with the implementation deleted proves nothing; that is the
// exact failure class this verb exists to catch mechanically. v1 is
// deliberately NOT statement-level mutation testing — one mutant (the
// deletion), one run, one verdict.
//
// SAFETY FIRST: this module refuses to run (MutateUnavailableError → exit 2 at
// the CLI) when the working tree carries uncommitted tracked changes. It
// reverts and restores files via git and must NEVER stash or destroy user
// work. Because it only ever runs against a clean tree, every byte it touches
// is committed at HEAD — restoration is unconditional (try/finally), and even
// a hard kill mid-run loses nothing (`git checkout HEAD -- .` recovers).
// Untracked files never block: the revert/restore path cannot reach them.
//
// Dependency-free: Node built-ins + git (uses `git restore`, git ≥ 2.23).

const { execFileSync, spawnSync } = require('child_process');

// Thrown when the deletion test cannot run at all (no git repo, no baseline,
// dirty tree, unspawnable test command) — the CLI maps this to exit 2,
// distinct from exit 1 (ran, and the tests do not bite).
class MutateUnavailableError extends Error {}

const DEFAULT_TIMEOUT_MS = 120 * 1000;

function approvedTag(slug) {
  return `bet/${slug}/approved`;
}

function git(cwd, args) {
  // stderr piped (not inherited): probe failures — a missing tag, a missing
  // ref — are expected control flow here, never user-facing noise.
  return execFileSync('git', args, {
    cwd, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'],
  });
}

function gitLines(cwd, args) {
  return git(cwd, args).split('\n').filter(Boolean);
}

// Same test-file shape the honesty scan uses — paths under tests/ and the
// common per-language test-name patterns.
function isTestFile(file) {
  const base = file.split('/').pop();
  return (
    /(^|\/)(tests?|__tests__|spec)\//.test(file) ||
    /^test_/.test(base) ||
    /_test\.[^.]+$/.test(base) ||
    /\.(test|spec)\.[^.]+$/.test(base) ||
    base === 'conftest.py'
  );
}

// The slice's SOURCE surface: everything changed since the baseline minus its
// tests (they must stay at HEAD — they are what we are interrogating), minus
// prose and engine state (docs/, .groundwork/) that no test command exercises.
function isSourcePath(file) {
  return !isTestFile(file) && !file.startsWith('docs/') && !file.startsWith('.groundwork/');
}

// `git restore --source=<ref> --staged --worktree -- <file>` makes the path
// match <ref> exactly IN BOTH DIRECTIONS: baseline content when the file
// existed there, deletion when it did not (a file born in the slice IS its
// implementation — the deletion test deletes it). The same call with
// --source=HEAD is the unconditional restoration.
function matchRef(cwd, ref, file) {
  git(cwd, ['restore', '--source', ref, '--staged', '--worktree', '--', file]);
}

/**
 * Run the deletion test.
 *
 * @param targetDir  repo root (cwd of the CLI)
 * @param opts.slug      bet slug — baseline defaults to bet/<slug>/approved
 * @param opts.since     optional sha scoping the diff to one slice's range
 *                       (the driver passes the prior slice's commit)
 * @param opts.sliceFile the slice's test file — always kept at HEAD, even if
 *                       oddly named enough to miss the test-file patterns
 * @param opts.command   argv of the test command (everything after `--`)
 * @param opts.timeoutMs test-command timeout (default 120s)
 * @returns {bite, reverted_files, test_exit, no_source_changes, baseline, timed_out}
 */
function run(targetDir, { slug, since, sliceFile, command, timeoutMs = DEFAULT_TIMEOUT_MS }) {
  try {
    git(targetDir, ['rev-parse', '--git-dir']);
  } catch {
    throw new MutateUnavailableError('not a git repository — the deletion test reverts files against a git baseline');
  }
  const baseline = since || approvedTag(slug);
  try {
    git(targetDir, ['rev-parse', '--verify', '--quiet', `${baseline}^{commit}`]);
  } catch {
    throw new MutateUnavailableError(
      since
        ? `--since '${since}' does not resolve to a commit`
        : `no approved tag '${baseline}' — the deletion test needs the sealed baseline to revert against (or pass --since <sha>)`
    );
  }

  // SAFETY: a dirty working tree is a hard refusal, checked before anything is
  // touched. This verb never stashes — reverting over uncommitted edits would
  // destroy them. (`-uno`: untracked files are unreachable by the revert and
  // do not block.)
  const dirty = gitLines(targetDir, ['status', '--porcelain', '-uno']);
  if (dirty.length) {
    throw new MutateUnavailableError(
      `working tree has ${dirty.length} uncommitted change(s) — commit them first; ` +
      'mutate reverts files via git and will never stash or overwrite uncommitted work'
    );
  }

  const reverted = gitLines(targetDir, ['diff', '--name-only', `${baseline}..HEAD`])
    .filter(isSourcePath)
    .filter((f) => f !== sliceFile);

  if (!reverted.length) {
    return { bite: null, reverted_files: [], test_exit: null, no_source_changes: true, baseline, timed_out: false };
  }

  // Revert the implementation, run the tests against its absence, and restore
  // UNCONDITIONALLY — the finally block runs on every path out of the try,
  // including a revert that fails halfway and a test command that crashes or
  // times out. Restoration is idempotent (match HEAD), so restoring a file the
  // revert never reached is a no-op.
  let result;
  try {
    for (const file of reverted) matchRef(targetDir, baseline, file);
    result = spawnSync(command[0], command.slice(1), {
      cwd: targetDir, encoding: 'utf8', timeout: timeoutMs,
      stdio: ['ignore', 'pipe', 'pipe'], killSignal: 'SIGKILL',
    });
  } finally {
    // Never let one failed restore abandon the rest — restore every file,
    // then report. (Everything here is committed at HEAD, so even this worst
    // case is recoverable with `git checkout HEAD -- .`.)
    const unrestored = [];
    for (const file of reverted) {
      try { matchRef(targetDir, 'HEAD', file); } catch { unrestored.push(file); }
    }
    if (unrestored.length) {
      throw new MutateUnavailableError(
        `restoration failed for ${unrestored.length} file(s) (${unrestored.join(', ')}) — ` +
        'recover with: git checkout HEAD -- .'
      );
    }
  }

  const timedOut = !!(result.error && result.error.code === 'ETIMEDOUT');
  if (result.error && !timedOut) {
    // The command never ran (ENOENT and friends) — that is cannot-run, and it
    // must never masquerade as "the tests bite".
    throw new MutateUnavailableError(`test command could not run: ${result.error.message}`);
  }
  const testExit = typeof result.status === 'number' ? result.status : null;
  // The verdict: red with the implementation gone = the tests bite. A timeout
  // or crash is not a pass — only a clean exit 0 convicts the suite.
  const bite = testExit !== 0;
  return { bite, reverted_files: reverted, test_exit: testExit, no_source_changes: false, baseline, timed_out: timedOut };
}

module.exports = {
  MutateUnavailableError,
  approvedTag,
  run,
};
