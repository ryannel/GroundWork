# Server persistence, repository model and CLI core

## Summary
The persistence layer is careful in intent. It uses revision and context tokens that are checked again under the lock, tmp+fsync+rename writes, a before/after journal with a check for external edits, per-component symlink rejection, and git calls built from argv with `--end-of-options` and `--`. I found no path-traversal hole and no way for a write with a stale `expectedRevision` to get through. The main risks are in the failure paths, which are mostly untested. I confirmed each of the following with a small experiment. The lock protocol fails about 0.8% of contended acquisitions with a spurious "Invalid lock file" error. A benign external edit during a write leaves a journal behind that blocks the repository. A leftover `*.tmp` from an interrupted `atomicFile` makes the repository unreadable. One deleted registered project stops every checkout from being selected once the cache is cold. On the design side, `repository.ts` mixes filesystem safety, locking, journaling and domain invariants in very dense code, and paths like `.groundwork/...` are hard-coded strings repeated across modules.

## Findings

### [HIGH] Lock file is created before its PID is written, so contenders see an empty lock and fail hard
- **File**: server/repository.ts:72-84
- **Category**: correctness
- **Problem**: `open(lock, 'wx')` creates an empty file, and the PID is written in a separate step. A second writer that reads the lock in that gap gets `JSON.parse('')`, which throws a `SyntaxError`, and that is turned into a fatal Conflict:
  ```ts
  const handle = await open(lock, 'wx', 0o600)
  await handle.writeFile(JSON.stringify({ pid: process.pid })); await handle.close(); break
  ...
  if (error instanceof SyntaxError) throw new Conflict('Invalid lock file; inspect it before recovery')
  ```
  Measured: 300 rounds of 4 concurrent `withLock` calls in one process produced 10 "Invalid lock file" failures out of 1200 acquisitions (about 0.8%). The lock is free and working, but those writers are rejected instead of waiting.
- **Impact**: Concurrent writers (Hub HTTP, CLI and MCP) sometimes get a scary "inspect it before recovery" error instead of a retry. If the process dies between `open` and `writeFile`, for example on Ctrl+C, the empty lock is permanent. `groundwork-v2 recover` cannot clear it because `recover` itself goes through `withLock`, and `readPlan` refuses to read while the lock exists. The user has to delete the file by hand.
- **Recommendation**: Publish the lock atomically. Write `{pid, host, startedAt, nonce}` to a unique temp file and `link()` it to `write.lock`, which fails with EEXIST. Alternatively, treat an empty or unparsable lock that is younger than a few seconds (by `mtime`) as held and retry, and treat an older one as stale.

### [HIGH] External edit found during `transactStorage` leaves a blocking journal although nothing was written
- **File**: server/repository.ts:181-191
- **Category**: correctness / data-integrity
- **Problem**: The journal is written first. Each path is then compared with `before` one at a time, and any failure triggers a full rollback:
  ```ts
  await atomicFile(root, '.groundwork/transaction.json', JSON.stringify({ version: 2, before, after, paths }))
  ...  if (current !== before[name]) throw new Conflict(`External edit detected: ${name}`)
  } catch (error) { await recoverUnlocked(root); throw error }
  ```
  `recoverUnlocked` requires every journal path to equal either `before` or `after`. The externally edited path equals neither, so recovery throws "Recovery paused". That error replaces the original one, and `transaction.json` stays on disk. Verified: edit `members/owner.json` on disk, then call `transactStorage(root, before, after)` under the lock. The call throws "Recovery paused…", the journal is left behind, and every later `readPlan` fails with "A plan write or recovery is pending". `recover` also fails for the same reason.
- **Impact**: An ordinary race with an editor or `git checkout` during a write turns into a repository that is blocked until someone deletes the journal by hand, even though Groundwork wrote nothing. The same window exists in `migrateCatalog`, which reads `before` outside the lock (catalog-migration.ts:12).
- **Recommendation**: Check that every path equals `before` before writing the journal, and raise a plain Conflict if any does not. During the apply loop, record which paths were actually written and roll back only those, restoring an unwritten path only if it still equals `after`. Keep the original error as `cause`.

### [HIGH] An orphaned `atomicFile` temp file makes the repository unreadable, and `recover` cannot fix it
- **File**: server/repository.ts:63-65 and 23-26
- **Category**: correctness / data-integrity
- **Problem**: Temp files are created next to the target (`${file}.${randomUUID()}.tmp`) and are removed only in a `finally` block. That block does not run on SIGKILL, on power loss, or on Node's default SIGINT exit, so a CLI or MCP process stopped with Ctrl+C mid-write leaves the file behind. `readStorageFiles` rejects every file it does not recognise:
  ```ts
  if (!physicalDocumentPattern.test(name)) throw new Error(`Unsupported catalog/planning file: ${name}`)
  ```
  Verified: after `initialise`, adding `.groundwork/plans/members/owner.json.1234.tmp` makes `readPlan` throw `Unsupported catalog/planning file: …owner.json.1234.tmp`. `writePlan` fails the same way because it calls `readFiles`, and `recoverUnlocked` does not clean up temp files. `setup.ts:42` already adds `.groundwork/**/*.tmp` to `.gitignore`, which shows these leftovers are expected, but the reader does not tolerate them.
- **Impact**: An interrupted write can make the catalog unreadable until the user finds and deletes the file. The durability goal also has a gap: there is no `fsync` of the parent directory after `rename`, so a rename can be lost after a crash.
- **Recommendation**: Have `readStorageFiles` skip names that match `/\.[0-9a-f-]{36}\.tmp$/`. Have `recoverUnlocked` (under the lock) delete them. Alternatively, stage temp files in a dedicated `.groundwork/.tmp/` directory that `readStorageFiles` never visits. Add a directory `fsync` after `rename`.

### [HIGH] One missing registered root or pruned worktree stops checkout selection for all projects
- **File**: server/registry.ts:111-116; server/git.ts:24-26
- **Category**: correctness
- **Problem**: `discover` runs `realpath` on every worktree with `Promise.all(paths.map(path => context(path)))`, so a single worktree whose directory was deleted (git lists it as prunable) rejects the whole call. `selectRoot` then loops over the registered roots without a try/catch:
  ```ts
  for (const record of roots) { for (const ctx of await discover(record.root)) { ...
  ```
  Verified: I registered A and B, deleted A, and started with a cold cache. `selectRoot(<B's id>)` threw `ENOENT … realpath '/tmp/gwa-…'`, and `discover` threw for a repository with one deleted worktree. `inventory` catches the error, so the project list still loads. Selecting B, which is listed after A, fails.
- **Impact**: After a Hub restart, one moved or deleted project (or a stray `git worktree` directory) stops `/api/snapshot` and operations from reaching unrelated projects. The cache has the opposite problem: when a worktree is removed, its cached root is still returned (registry.ts:109-110), so operations fail with ENOENT instead of "Unknown checkout".
- **Recommendation**: In `discover`, use `Promise.allSettled` and skip worktrees that no longer exist, or read the `prunable` line of the porcelain output. In `selectRoot`, catch errors for each record and continue. Before returning a cached root, check that it still exists, and drop the entry if it does not.

### [MEDIUM] Breaking a stale lock is racy and releasing a lock does not check ownership
- **File**: server/repository.ts:80-92
- **Category**: correctness / security
- **Problem**: Two waiters that both see a dead PID each run `rm(lock)`. The second `rm` can delete the fresh lock the first waiter just acquired, and then both run `fn`. `finally { await rm(lock, { force: true }) }` also deletes whatever lock is present, possibly one another process holds. `process.kill(pid, 0)` returning `EPERM` (the process is alive but owned by another user) is re-thrown as a raw error instead of being treated as alive. PIDs are not unique across PID namespaces, for example a container and its host sharing a bind mount, and they can be reused after a crash.
- **Impact**: This happens rarely, only after a crashed writer, but when it does two writers can both write inside the critical section. The journal of the one that finishes second overwrites the first one's journal.
- **Recommendation**: Store a nonce in the lock. Break a stale lock by `rename`-ing it to a unique name, then check that the renamed file still holds the dead PID and nonce before deleting it. On release, delete only if the nonce matches. Treat `EPERM` as alive. Record the hostname and process start time, and refuse to break locks written by another host.

### [MEDIUM] `readPlan` can return a torn snapshot and fails immediately during any write
- **File**: server/repository.ts:128-136
- **Category**: correctness
- **Problem**: `readPlan` checks for `write.lock` and `transaction.json` only before reading. After reading it checks only the context token (root, branch, head):
  ```ts
  for (const name of ['write.lock', 'transaction.json']) if (await lstat(...)) throw new Conflict('A plan write or recovery is pending; ...')
  ...
  if (!ref && (await context(root)).token !== ctx.token) throw new Conflict('The checkout changed while reading; retry')
  ```
  A writer that takes the lock after the first check and replaces files one at a time during `readStorageFiles` produces a mixed old/new file set with a revision that matches neither state.
- **Impact**: Writes stay safe, because the torn revision fails the stale check. Readers (viewer SSE, MCP `read_plan`, catalog queries) can still show inconsistent data or report spurious validation errors. Separately, every read issued during a normal short write fails at once with a Conflict instead of briefly waiting.
- **Recommendation**: After reading, check again that the lock and journal are still absent, for example by comparing their `lstat` results before and after, and retry a few times with a short backoff before raising a Conflict. Alternatively, take the lock briefly while snapshotting.

### [MEDIUM] `atomicFile` forces mode 0600 on user files it rewrites
- **File**: server/repository.ts:56; callers server/setup.ts:32,38,43
- **Category**: best-practice / data-integrity
- **Problem**: `open(file, 'w', 0o600)` creates the temp file, which then replaces the target. As a result, `groundwork-v2 init` and `instructions` change the modes of the user's own `package.json`, `.gitignore`, `AGENTS.md` and `CLAUDE.md`, and of every catalog document, to 0600. Verified: 0644 inputs became `600 600 600` after `installInstructions`. `.gitignore` is rewritten on every run even when nothing changed (setup.ts:43).
- **Impact**: Git does not track this change, so it goes unnoticed. Other users and service accounts can no longer read the files: shared checkouts, Docker builds that run as another UID, and web servers serving the docs. A file tracked as 100755 also loses its execute bit.
- **Recommendation**: Keep the existing file's mode (`stat` it, then `chmod` the temp file), and default to `0o644` with the umask applied for new files. Skip the `.gitignore` write when nothing changed.

### [MEDIUM] `initialise` copies asset files without validating them and can produce an unreadable repository
- **File**: server/setup.ts:61
- **Category**: correctness
- **Problem**: `cp(options.assets, …/assets, { recursive: true, filter })` copies everything except symlinks. `readStorageFiles` accepts only files under `plans/assets/` that match `assetPattern` (png/jpg/webp/gif/avif) and throws on anything else. `initialise` validates only the in-memory `files` and never reads back what it wrote. Verified: an assets directory containing `shot.png` and `.DS_Store` initialises successfully, and then `readPlan` throws `Unsupported catalog/planning file: .groundwork/plans/assets/.DS_Store`.
- **Impact**: `groundwork-v2 export --assets` from a normal macOS folder, or one containing an SVG or a README, reports success but leaves a catalog that cannot be read.
- **Recommendation**: In the `cp` filter, skip or reject any file whose relative path does not match `assetPattern`. After the rename, call `readPlan(root)` inside the lock and roll back if it fails.

### [MEDIUM] Domain invariants and repeated reads are packed into `writePlan` in the persistence layer
- **File**: server/repository.ts:139-175
- **Category**: architecture / readability
- **Problem**: `writePlan` holds several product rules: baselines and scan manifests are immutable (l.152), `retiredObservations` and `catalogChanges` are append-only (l.156-162), the project ID is immutable (l.164), and assets must exist (l.163). The same function also does locking, a double check of context and revision, three full reads of storage (`readFiles` at l.144 and l.165, `readStorageFiles` at l.166), two `parsePlan(before)` calls (l.156, l.164) and encoding. Its return value `context: ctx` has a different shape from `readPlan`'s `context`, which has `ref`, `editable` and `head`.
- **Impact**: The rules can only be tested by going through a real filesystem and git. Anyone adding a new invariant has to edit this long function inside the lock. The repeated reads and parses add latency while the 2.5 s lock is held.
- **Recommendation**: Extract a pure `validateTransition(before: Plan, after: Plan, changes)` into a domain module next to `format.ts`, and unit-test it directly. Keep `writePlan` as: lock → recover → read once → check tokens → validate → encode → transact. Replace the three consistency re-reads with the single check `transactStorage` already makes. Return the same `context` shape as `readPlan`.

### [MEDIUM] Each write journals the whole catalog twice, and each read spawns 6 or more git processes
- **File**: server/repository.ts:181; server/git.ts:11-20
- **Category**: performance
- **Problem**: `transactStorage` stores the complete `before` and `after` storage maps, meaning every physical catalog file twice, even when only one path changed: `JSON.stringify({ version: 2, before, after, paths })`. Recovery only needs `before[p]` and `after[p]` for `p` in `paths`. Separately, `context()` runs 3 git processes (`rev-parse --show-toplevel`, `symbolic-ref`, `rev-parse HEAD`). `readPlan` calls it twice and `writePlan` three or four times. `safePath` also calls `realpath(root)` and one `lstat` per path component for every file it visits.
- **Impact**: On larger catalogs such as the Word Loop corpus, every small edit rewrites and fsyncs a journal of several MB while holding the lock. Together with the retry limit of 50×50 ms, this makes spurious "Another Groundwork process is writing" Conflicts more likely.
- **Recommendation**: Journal only the changed paths: `{ version: 3, paths, before: pick(before, paths), after: pick(after, paths) }`. Read versions 2 and 3 in `recoverUnlocked`. Compute the context with one `git rev-parse --show-toplevel --symbolic-full-name HEAD HEAD` call. Resolve `root` once in `readStorageFiles`.

### [MEDIUM] Failure paths and cross-process behaviour are mostly untested
- **File**: tests/repository-lock.test.ts:8-17; tests/runtime.test.ts:62-68
- **Category**: testing
- **Problem**: `repository-lock.test.ts` has a single test, for a malformed lock. The "concurrent writers" test runs in one process and only counts rejections (`results.filter(r => r.status === 'rejected').length`), so it would pass even when the rejection is the spurious "Invalid lock file" from the first finding. There are no tests for:
  - breaking a dead-PID lock, or two waiters doing it at once
  - an empty lock
  - the `transactStorage` external-edit path
  - leftover temp files
  - symlinks and file modes in `readStorageFiles(root, ref)`
  - `discover` with a pruned worktree
  - `selectRoot` with a deleted registration
  - CLI argument parsing
- **Impact**: All four HIGH findings above exist in paths the suite never exercises.
- **Recommendation**: Add cases that assert the error type or message (`Stale edit` rather than any rejection). Add a cross-process lock test that spawns `node -e` workers. Add direct unit tests for the transition validator from the domain-invariants finding and for `main(argv)` with injected output.

### [LOW] Registry error handling depends on message text and hides the real error
- **File**: server/registry.ts:51-53, 41-43
- **Category**: best-practice
- **Problem**: `register` decides whether a repository has a plan by string matching: `if ((error as Error).message.includes('project.json')) return null`. That also swallows a *malformed* `project.json` (the error is prefixed `project.json: …`), and the repository is registered with `projectId: null`. `registry()` falls back to the legacy schema whenever v2 validation fails, so a slightly broken v2 file reports `"expected 1"` for `version` instead of the real v2 error. Verified.
- **Impact**: Registry and plan problems are hard to diagnose.
- **Recommendation**: Throw a typed `NotInitialised` error from `parsePlan` and check for it with `instanceof`. Choose the schema by `data.version`, and put the registry file path in parse errors.

### [LOW] CLI argument parsing is permissive and its error output is noisy
- **File**: server/cli.ts:14-24, 55; bin/groundwork-v2.js:2-3; server/git.ts:7
- **Category**: best-practice / readability
- **Problem**: Verified behaviour:
  - Unknown flags are silently accepted: `read . --reff main` ignores the typo and reads the working tree.
  - `--port=4000` fails with `Missing value for --port=4000`.
  - `init --help` fails with `Missing value for --help`.
  - Extra positional arguments are ignored.

  `bin` prints only `error.message`. For a Zod error that is a JSON blob, and for git it is the full `Command failed: git -c core.fsmonitor=false -c core.hooksPath=/dev/null -C /abs/path rev-parse …` line. All failures exit with code 1, so a Conflict (retryable) looks the same as a validation error. If `runtime/` has not been built, the user sees a bare module-not-found error.
- **Impact**: Typos go unnoticed, and neither humans nor agents get a clear, actionable error.
- **Recommendation**: Use `node:util` `parseArgs` with a per-command options table (`strict: true`, `allowPositionals`). Format Zod errors with `z.prettifyError`. Wrap git failures as `GitError(args, stderr)` with a short message. Exit with a distinct code for `Conflict`. Show a "run npm run build" hint when the import fails.

### [LOW] `renderBrief` is not the inverse of `parseBrief`
- **File**: server/format.ts:45-46 (used by server/operations.ts:126, server/setup.ts:89)
- **Category**: correctness
- **Problem**: `renderBrief` puts text in unescaped. A non-goal containing a newline, or a problem containing a line that starts with `## `, renders to Markdown that `parseBrief` rejects. Verified: `nonGoals: ['line one\nline two']` gives "Non-goals: use one bullet per item", and `problem: 'P\n## Outcome'` gives "Unknown or duplicate brief heading: Outcome". A success text ending in ` {tests: y}` changes meaning on the round trip.
- **Impact**: `create_feature` with multi-paragraph input fails with a confusing message about Markdown the caller never wrote. The failure happens at validation, so nothing is corrupted.
- **Recommendation**: Validate in `purposeSchema`, or at the `create_feature` input, with a clear message (no newlines in list items, no heading lines in prose). Alternatively, make `renderBrief` normalise such text. Add a property-style round-trip test.

### [LOW] `exportLegacy` rewrites strings blindly and hard-codes fixture data
- **File**: server/setup.ts:90, 71
- **Category**: correctness / readability
- **Problem**: `JSON.stringify(value, null, 2).replaceAll('/images/', 'assets/')` rewrites every occurrence in every document, including prose and external URLs (`https://cdn.example.com/images/x.png` → `https://cdn.example.comassets/x.png`). `loadContent(docs, ['tax-cart-totals'])` duplicates `livePrototypeIds` from src/data/live-prototypes.ts.
- **Impact**: Export silently corrupts text that is not an asset reference.
- **Recommendation**: Rewrite only `mockups[].ref` values that start with `/images/`, and import `livePrototypeIds`.

### [LOW] `.groundwork` paths are repeated as string literals, and one regex is built by slicing another regex's source
- **File**: server/catalog-storage.ts:7,10,26,34-47; server/repository.ts:22,24,67,96,129,181,190; server/setup.ts:42
- **Category**: readability / architecture
- **Problem**: `'.groundwork/plans/'` appears about 8 times in catalog-storage.ts even though `PLAN_DIRECTORY` exists. The lock and journal names are repeated in repository.ts and in setup.ts's `.gitignore` list. The 2 MB limit is duplicated (repository.ts:43 and 151). `physicalDocumentPattern` is built with `documentPattern.source.slice(1, -1)`, which silently breaks if `documentPattern` ever gets flags or loses its `^…$` anchors. Several lines pack 3-5 operations into 200-300 characters (repository.ts:102, 129, 136).
- **Impact**: Changing the layout or the lock and journal locations means hunting through several modules, and one missed spot causes subtle bugs.
- **Recommendation**: Add a small `server/paths.ts` exporting `GROUNDWORK_DIR`, `PLANS_DIR`, `CATALOG_DIR`, `LOCK_FILE`, `JOURNAL_FILE`, `MAX_DOCUMENT_BYTES` and `LOGICAL_DOCUMENT_SOURCE`, the latter as a string without anchors that both regexes compose from. Split the dense lines into named steps.

### [LOW] Migration signals stale state with plain Error, and `transactStorage` preconditions are only a comment
- **File**: server/catalog-migration.ts:13,23,25; server/repository.ts:177
- **Category**: best-practice
- **Problem**: "Catalog changed …" and "Apply migration with the current dry-run revision" are thrown as `Error`, while `writePlan` uses `Conflict`, so HTTP returns 400 instead of 409. `transactStorage` is exported with only `/** Caller holds the workspace lock… */`. It checks neither the lock nor a pending journal, and `migrateCatalog` does not run `recoverUnlocked` inside its lock, unlike `writePlan`.
- **Impact**: Clients cannot tell a retryable stale conflict from a validation error. A future caller could overwrite a pending recovery journal.
- **Recommendation**: Throw `Conflict` for stale-state errors. Make `transactStorage` module-private behind a `withTransaction(root, fn)` helper that takes the lock, runs recovery and refuses to start when a journal exists.

## Positive notes
- Revision and context design: `writePlan` checks `expectedRevision` and `expectedContext` again under the lock after running recovery, and they are checked once more before the storage write. I found no way for a stale write to get through.
- Path hardening: `safePath` rejects `..`, `.`, empty and absolute segments, and runs `lstat` on every component to reject symlinks. Git-backed reads reject non-regular file modes. `documentPattern` and `physicalDocumentPattern` act as a strict allowlist, and `id` blocks `__proto__`, `constructor` and `prototype`.
- git invocation is built from argv with no shell, `--end-of-options` on user refs, `--` before paths, `core.hooksPath=/dev/null`, `core.fsmonitor=false`, `GIT_OPTIONAL_LOCKS=0` and `GIT_TERMINAL_PROMPT=0`.
- Recovery refuses to overwrite files that were edited externally (`current !== before && current !== after`) and keeps the journal for inspection. It is idempotent if a crash interrupts it.
- Migration first round-trips through `encodeStorage` and `decodeStorage` and compares canonical `parsePlan` projections. The split format keeps explicit empty arrays separate from omitted fields.

## Suggested refactor plan for this slice
1. Fix the lock protocol: publish it atomically with a nonce via link or rename, treat EPERM as alive, check ownership on release, and break stale locks by rename-then-verify. Add cross-process lock tests.
2. Restructure `transactStorage`: check all paths before writing the journal, roll back only the paths that were written, journal only changed paths, keep the original error as `cause`, and put it behind a `withTransaction` helper that runs recovery and checks for an existing journal.
3. Make the reader tolerate its own artefacts: skip and clean up `*.tmp`, or stage temp files outside the scanned tree. Validate assets in `initialise`, and read back after init and export.
4. Make `discover` and `selectRoot` tolerant of missing roots and worktrees for each record, and check cached roots still exist.
5. Extract `validateTransition` (the domain invariants) out of `writePlan` into a pure, unit-tested module. Reduce `writePlan` to a single read with one consistency check.
6. Add `server/paths.ts` constants and compose the document regexes from a shared unanchored source.
7. Replace the hand-rolled CLI parser with `util.parseArgs` in strict mode, format errors cleanly, and exit with a distinct code for Conflict.
8. In `readPlan`, check the lock and journal again after reading and retry briefly instead of failing at once.
