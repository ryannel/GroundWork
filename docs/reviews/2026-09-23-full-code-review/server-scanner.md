# Repository scanner subsystem

## Summary
The scanner is carefully designed. Scans are pinned to a commit, snapshots contain no Git data, evidence is checked against blob hashes and must fall inside the snapshot, every apply is a single `writePlan` transaction that carries a content-addressed manifest, and the "retain or explicitly retire" rule guards against silent inventory loss. Its main weakness is at the edges: process invocation, the filesystem and cross-area merging. Several of the resulting problems were confirmed with runnable proofs of concept (PoCs):
- A user-supplied `sourceRef` reaches `git fetch` without an end-of-options separator, which lets a caller run arbitrary local commands.
- Scan cleanup `chmod`s through symlinks, so one dangling link blocks every future `prepare`.
- Hashes are computed on the checked-out working tree, so evidence validation fails for any repository whose files Git rewrites on checkout (CRLF and similar attributes).
- A scan that covers only some areas erases the component's top-level evidence and gaps. It also marks coverage recorded at older revisions as `complete` at the new one.
- Credentials embedded in an `origin` URL are copied into the catalog, including into scan manifests, which cannot be deleted.

Structurally, `server/scanner.ts` mixes six responsibilities. It duplicates repository identity and evidence rules that live elsewhere, and its densest lines are hard to review.

## Findings

### [CRITICAL] `sourceRef` option injection into `git fetch` allows arbitrary command execution
- **File**: server/scanner.ts:202 (schema at server/scanner.ts:46)
- **Category**: security
- **Problem**: `sourceRef` is validated only as `z.string().trim().min(1)`. It is then passed to git as a positional argument with no `--end-of-options`:
  `await command('git', ['fetch', '--depth=1', 'origin', ref], target)`
  git parses options that come after positional arguments, so `sourceRef: "--upload-pack=<cmd>"` is treated as an option. For a local-path acquisition, where `origin` is a filesystem path, git runs `<cmd>` through the shell.
  - **Verified end to end**: `prepareRepositoryScan(root, { repository: <local repo>, sourceRef: '--upload-pack=touch /…/PWNED; git-upload-pack' })` created the marker file, and the prepare call itself succeeded silently.
  - **Exposure**: the operation is exposed as the MCP tool `prepare_repository_scan` and as `POST /api/operations/prepare_repository_scan`. An agent that has been prompt-injected by repository content can supply this argument.
- **Impact**: arbitrary code execution with the user's privileges through a tool argument.
- **Recommendation**:
  1. Validate refs: `z.string().regex(/^(?!-)[^\s\0~^:?*[\\]+$/).max(255)`, or run `git check-ref-format --allow-onelevel` and also accept 40- or 64-character hex SHAs.
  2. Pass `--end-of-options` before `origin`, as `server/git.ts:37` already does for `rev-parse`.
  3. Harden every git call with `-c protocol.allow=never -c protocol.file.allow=always …` or reuse `gitRaw`, which disables fsmonitor and hooks.
  4. Separately, the `gh` shorthand regex `^[\w.-]+\/[\w.-]+$` (line 196) allows a leading `-`, which `gh`'s flag parser then reads as flags. Require `^[A-Za-z0-9][\w.-]*\/[\w.-]+$`.

### [HIGH] Scan cleanup follows symlinks: it chmods files outside the scan, and one dangling link blocks all future preparations
- **File**: server/scanner.ts:136-143, 150-163
- **Category**: security
- **Problem**: `makeWritable` uses `lstat` but then calls `chmod(target, 0o600)` on anything that is not a directory, including symlinks. `chmod` follows the link. The `output/` directory is deliberately writable by the worker.
  - **Verified**:
    - A symlink `output/evil -> <some dir>` caused `discardRepositoryScan` to set that external directory to mode `600`.
    - A dangling symlink inside an expired scan made `sweepScans` throw `ENOENT: chmod …/output/dangling`. `sweepScans` has no per-entry error handling and runs at the start of every `prepareRepositoryScan`, so every later preparation failed until someone cleaned up by hand.
- **Impact**: an untrusted worker, which reads attacker-controlled repository text, can change permissions on arbitrary user files (for example `~/.ssh`, or scripts that lose their executable bit). It can also permanently deny service to the scanner.
- **Recommendation**:
  - In `makeWritable`, return early when `info.isSymbolicLink()` is true. `rm` removes the link itself.
  - Wrap each sweep entry in `try/catch` so that one broken scan cannot block the others, and log the failure.
  - Consider validating `output/` contents at apply time: regular files only, with a size cap.

### [HIGH] Evidence hashing reads working-tree bytes, so validation fails for repositories with eol, filter or autocrlf rules
- **File**: server/scanner.ts:366 (inventory digests from server/scan-inventory.ts:35-37; copying at server/scanner.ts:257-261)
- **Category**: correctness
- **Problem**: File digests come from `git ls-files --stage`, which reports index blob hashes. The snapshot, however, is copied from the checked-out working tree. `validateEvidence` then recomputes `sha1("blob <len>\0" + workingTreeBytes)`. Any checkout-time conversion makes the working-tree bytes differ from the blob: `.gitattributes` `eol=crlf`, `core.autocrlf=true` (the Git for Windows default), `ident`, or LFS smudge.
  - **Verified**: a repository with `*.ts text eol=crlf` fails every citation with `src/routes.ts: prepared source was modified`.
- **Impact**: the scanner cannot be used on many real repositories, particularly the .NET and Windows repositories that the project-detection code explicitly supports (`.csproj`/`.sln`). The error message also wrongly blames tampering.
- **Recommendation**: build the snapshot from the committed objects instead of a checkout. Either stream `git cat-file --batch` for the selected blobs, or run `git archive <rev> | tar -x` with `-c core.autocrlf=false` and attributes ignored. This removes the checkout step completely and makes the snapshot byte-identical to `revision`. If a checkout is kept, record a second `snapshotDigest` computed over the copied bytes and compare against that.

### [HIGH] A partial-area rescan erases evidence and gaps, and reports stale coverage as `complete` at the new revision
- **File**: server/scanner.ts:453, 461, 477-478
- **Category**: correctness
- **Problem**: coverage is merged across scans:
  `const coverage = { ...(previous.scan?.coverage ?? {}), ...discovery.coverage }`
  At the same time, `evidence: discovery.evidence ?? []` and `gaps: discovery.gaps ?? []` are replaced wholesale, while `dependsOn` is kept whenever dependencies were not in scope.
  - **Verified**: first apply a full scan with `dependsOn: ['other']` plus evidence. Then commit, and apply an `areas: ['api']` scan. The result is `dependsOn: ['other']` with `evidence: []`, and `scan: { status: 'complete', revision: <new rev>, coverage: all complete }`.
- **Impact**:
  - This breaks the invariant that `requireClaimEvidence` enforces on write ("resolved dependencies require evidence").
  - It silently drops gaps recorded for other areas.
  - It tells freshness and viewer consumers that all four areas were verified at a revision where only the API was examined.
- **Recommendation**:
  - Keep evidence and gaps per area, or keep the previous top-level `evidence` and `gaps` unless `coverage.dependencies` is present in this discovery. Filter gaps by `area` prefix.
  - Record per-area revisions (`coverage: { api: { state, revision } }`), or compute `status: 'complete'` only when every area was scanned at `metadata.revision`.
  - Add a regression test.

### [HIGH] Credentials in an `origin` URL or repository argument are persisted into the catalog and into immutable scan manifests
- **File**: server/scanner.ts:187-190, 205-209 (persisted at 474 as `repo`, and via `retainedManifest` at 401-409)
- **Category**: security
- **Problem**:
  - For local paths, the identity is taken from `git remote get-url origin`.
  - `normalizeRepository` only strips `.git` from anything that does not match the GitHub regex.
  - The regex does not allow a userinfo section.
  - **Verified**: `https://x-access-token:ghs_SECRET@github.com/acme/api.git` and `https://oauth2:glpat-SECRET@gitlab.com/g/p.git` both pass through unchanged.
  - That string is written to `components/<id>.json` as `repo`, returned by the API, and embedded in `scan-manifests/<sha>.json`. `writePlan` rejects deleting or editing those manifests ("immutable").
  - The same URL also appears in `execFile` error messages (`Command failed: git clone … <url>`) that are sent back to the caller.
- **Impact**: tokens leak into committed, hash-locked catalog history and into the viewer.
- **Recommendation**:
  - Parse candidate URLs with `new URL()` (or treat scp-style `git@host:path` specially), strip `username` and `password`, and reject inputs that carry credentials.
  - Canonicalise inside one shared helper (see the identity finding below).
  - Redact URLs in rethrown errors.

### [MEDIUM] Repository identity normalisation is duplicated and inconsistent across scanner and freshness
- **File**: server/scanner.ts:183-190, 545; server/catalog-freshness.ts:14-17, 44, 47
- **Category**: architecture
- **Problem**: the same concept has three implementations:
  - `normalizeRepository` (scanner) accepts a bare `github.com/` prefix and preserves case.
  - `sourceIdentity` (freshness) lower-cases but does not accept `github.com/`.
  - `canonicalRepository` combines them with `realpath`, and freshness re-inlines the same combination twice.
  - **Verified**: `sourceIdentity('github.com/Acme/Api')` returns `github.com/Acme/Api`, while `sourceIdentity(normalizeRepository(…))` returns `acme/api`. Neither handles `https://GitHub.com/...`.
  - `applyCatalogInvestigation` compares `finding.repository !== metadata.repository` as raw strings (line 545), while the evidence check a few lines later uses canonical comparison.
- **Impact**: a component authored with `repo: "github.com/Acme/Api"` is not recognised as the scanned `Acme/Api`. `detectProjects` then suggests a duplicate, and `applyRepositoryScan` rejects it with "component ID belongs to another repository". Findings that differ only in case are also rejected.
- **Recommendation**: create a leaf module, `server/repository-identity.ts`, exporting:
  - `displayRepository(raw)`: credential-stripped, case-preserving, for storage.
  - `repositoryKey(raw)`: async, including `realpath`, case-folded host and owner/name, for comparison.

  Use it everywhere: in scanner, freshness and knowledge, and in `detectProjects`, which currently compares `component.repo === repository`.

### [MEDIUM] Citation fields other than `evidence[]` bypass evidence validation
- **File**: server/scanner.ts:345-374 (walker), src/data/content-schema.ts:63, 71, 75, 143; consumer at server/catalog-freshness.ts:25
- **Category**: correctness
- **Problem**: `evidenceArrays` only visits keys named `evidence`. Discoveries can also carry `source` fields (endpoints, schemas, jobs) and `sourceRevision` fields (`api.sourceRevision`, `schemas[].sourceRevision`). Nothing checks these against the snapshot or the pinned revision. `catalog-freshness.citations()` then treats `record.source` together with `sourceRevision` as a real citation (`if (typeof record.source === 'string' && revision) result.push(...)`).
- **Impact**: a worker can record unverified, or wrong-revision, source pointers that freshness later reports as observed citations. This weakens the "every claim is evidenced" guarantee.
- **Recommendation**:
  - Either validate `source` fields with the same path, snapshot and revision checks, or force `sourceRevision` to `metadata.revision` and require `source` to be in `known`.
  - Alternatively, remove `source` and `sourceRevision` from scanner input by making the discovery schema `.omit()` them.

### [MEDIUM] External command runner has no timeout or non-interactive SSH, and bypasses the hardening in `git.ts`
- **File**: server/scanner.ts:165-181
- **Category**: best-practice
- **Problem**:
  - `command()` calls `execFile` with no `timeout` and without `GIT_SSH_COMMAND='ssh -o BatchMode=yes'`. `GIT_TERMINAL_PROMPT=0` does not stop ssh from prompting for host keys or passphrases on the TTY, so an ssh URL for an unknown host can hang the MCP call indefinitely.
  - It also skips the `-c core.fsmonitor=false -c core.hooksPath=/dev/null` hardening that `server/git.ts:7` applies. `git remote get-url origin` runs inside an arbitrary, user-named local repository.
  - Error classification is regex-on-stderr and too broad. For example, `/permission denied/` also matches filesystem `EACCES` and is reported as a GitHub auth failure.
  - The original error is discarded, with no `cause`.
- **Impact**: hung operations, misleading diagnostics, and weaker isolation than the rest of the codebase.
- **Recommendation**:
  - Route git calls through a hardened `gitRaw`-style helper that has `timeout: 120_000`, `killSignal: 'SIGKILL'` and `GIT_SSH_COMMAND` set.
  - Keep `gh` separate, with its own timeout.
  - Throw `new Error(msg, { cause: error })`, with redacted arguments.

### [MEDIUM] `inventory` reads every tracked file before applying the budget
- **File**: server/scan-inventory.ts:41-54, 64-67
- **Category**: performance
- **Problem**: the budget loop runs only after every candidate has been `stat`ed and fully read. Each file of up to 1 MiB is loaded into memory just to inspect its first 4 KiB: `const head = await readFile(file).then(value => value.subarray(0, 4096))`. This happens sequentially, for every tracked file.
- **Impact**: on large monorepos (100k+ files) preparation does gigabytes of I/O, even though `maxFiles` defaults to 1200.
- **Recommendation**:
  - Read only the head, with `open` + `read(buf, 0, 4096)`.
  - Get sizes from `git ls-files -s` plus `git cat-file --batch-check='%(objectsize)'`, or from `ls-tree -l`, so that path- and size-based exclusions and the priority sort happen before any content I/O.
  - Content-sniff only the files that fit within the budget. Bounded concurrency (for example 16 at a time) would also help.

### [MEDIUM] `applyCatalogInvestigation` consumes supporting scans and writes mislabelled supporting manifests
- **File**: server/scanner.ts:567-573
- **Category**: correctness
- **Problem**:
  1. Cleanup deletes every scan in `sources`, including the `sourceScans` that were borrowed as supporting evidence. A baseline scan of repository B that is used as supporting context for repository A's investigation is destroyed. A later `applyRepositoryScan(B)` then fails with ENOENT.
  2. The supporting manifest has:
     - `componentId` set to the primary component for every project of the other repository;
     - `observationIds` holding raw IDs, `[...args.flows, ...args.findings].map(item => item.id)`, where the primary manifest uses `catalogId(...)`;
     - job observations missing entirely.
- **Impact**: a surprising loss of prepared work, and permanently immutable provenance records with inconsistent identifiers.
- **Recommendation**:
  - Remove only the primary scan, or only scans whose `mode` was consumed, and leave supporting scans until they expire or are discarded.
  - Build `observationIds` with the same `catalogId` helper, include jobs, and scope the manifest to the projects that were actually cited.

### [MEDIUM] Schemas live in `scanner.ts` and duplicate or loosen the content-schema rules
- **File**: server/scanner.ts:31-86, 52-54, 577-582; src/data/content-schema.ts:5, 109-112, 142, 149
- **Category**: architecture
- **Problem**:
  - The ID regex is duplicated (`/^[a-zA-Z0-9][a-zA-Z0-9_-]*$/` three times) and omits the `constructor|prototype` ban from content-schema's `id`.
  - `scanEvidenceSchema` (`lines: /^\d+(?:-\d+)?$/`, any revision) duplicates `executionEvidenceSchema` (`/^[1-9]\d*…/`, 40-hex) with different rules.
  - `lifecycleKind` repeats the enum inlined twice in content-schema.
  - `relativePathSchema` is a third copy of the path rule, alongside `scan-manifest.ts:3` and `catalog-freshness.ts:33`, and each copy allows different things (`.`, backslashes).
  - The operation schemas are exported from a server module, so they cannot be shared with the JSON-schema generator or the viewer.
  - Content-schema uses 40-hex for flow, finding and retirement revisions, while the scanner accepts SHA-256 (64-hex) repositories. SHA-256 repositories can be scanned but cannot record flows or findings.
- **Impact**: validation drift, and IDs such as `constructor` get past scanner parsing and fail later deep in `parsePlan` with a less helpful error.
- **Recommendation**:
  - Export `idSchema`, `relativePathSchema`, `commitShaSchema` (40|64), `lifecycleKindSchema` and a single `evidenceSchema` from content-schema.
  - Move the discovery, investigation and reconcile schemas into `src/data/scan-schema.ts`, next to `scan-manifest.ts`.
  - Have the scanner import them.

### [MEDIUM] `scanner.ts` is a 631-line God module; `validateEvidence` is reused through an unsafe cast
- **File**: server/scanner.ts (whole file); casts at 560 and 593
- **Category**: architecture
- **Problem**: one file mixes six concerns: temp-workspace lifecycle, process execution and acquisition, packet planning, evidence validation, baseline apply, and investigation/lifecycle apply. `validateEvidence(dir, metadata, discovery)` is reused by passing `{ sourcePath, evidence: [...] } as Discovery`, which lies to the type checker. Packet planning and the incremental-mode decision (lines 229-236, 262-287) are pure logic trapped inside an I/O function, which is why the budget math is untested.
- **Impact**: every change touches the same file, and the pure rules cannot be unit-tested.
- **Recommendation**: split the file:
  - `server/scan/workspace.ts`: `scanBase`, `scanDirectory`, `sweepScans`, `removeScan`, `readonlyTree`, `loadScan` (with a zod `scanMetadataSchema`).
  - `server/scan/acquire.ts`: the hardened `command`, `acquire`, ref validation.
  - `server/repository-identity.ts`: shared with freshness.
  - `server/scan/packets.ts`: pure `incrementalMode(freshness)` and `planPackets(projects, files, areas, budgets, changed)`.
  - `server/scan/evidence.ts`: `validateCitations(snapshot, boundary, citations[])`, `requireClaimEvidence`, `requireRetainedInventory`.
  - `server/scan/apply-baseline.ts`: `applyRepositoryScan`, plus a pure `mergeComponent(previous, discovery, metadata)`.
  - `server/scan/lifecycle.ts`: `applyCatalogInvestigation`, `reconcileCatalog`, plus a pure `retirementCascade(component, retire)`.
  - `server/scanner.ts`: a thin re-export barrel.

### [MEDIUM] Test gaps: `scan-projects.ts` has no direct tests, and the failure paths are untested
- **File**: tests/scanner.test.ts, tests/scan-inventory.test.ts
- **Category**: testing
- **Problem**:
  - `detectProjects`, `filesForProject` and `packetFiles` are only exercised indirectly. Untested behaviour includes the hand-rolled `catalog-info.yaml` metadata parser (quoted values, `title` versus `name`, indentation), duplicate `suggestedId` disambiguation, test-directory exclusion, the `.sln` fallback, and the `laneTerms` and test-segment regexes. For example, `(?:^|\/)(?:[^/]*tests?)` also excludes directories such as `latest/`.
  - None of the following has a test:
    - ref validation and option injection;
    - symlink or submodule exclusion;
    - sweep expiry and cleanup after a failed prepare;
    - `maxPackets` exhaustion causing `limitsReached` and rejecting `complete`;
    - expired, foreign-project or foreign-checkout scans;
    - partial-area rescans;
    - CRLF repositories;
    - `reconcileCatalog` rename-path validation and cascades for message, data and job.
- **Impact**: the bugs above went unnoticed, and the planned decomposition has no safety net.
- **Recommendation**:
  - Add `tests/scan-projects.test.ts` with in-memory `InventoryFile[]` fixtures. `filesForProject` and `packetFiles` are pure; `detectProjects` needs a temporary directory.
  - After extracting `planPackets`, table-test the budget math.
  - Add regression tests for each finding in this report.

### [LOW] The `truncated` packet flag and `truncatedAreas` check are dead code
- **File**: server/scanner.ts:282, 456-458
- **Category**: readability
- **Problem**: every packet is created with `truncated: false`, so `truncatedAreas` is always empty. The budget-limited coverage check really rests only on `globallyLimited`.
- **Impact**: readers assume there is a per-project truncation safeguard that does not exist.
- **Recommendation**: remove the field and the check, or set it when `packets.length >= maxPackets` cuts a project's parts short, which would make the rejection per project instead of global.

### [LOW] Evidence line-range check accepts one line past the end of the file
- **File**: server/scanner.ts:368, 372
- **Category**: correctness
- **Problem**: `raw.toString('utf8').split(/\r?\n/).length` counts the empty string after a trailing newline. A one-line file (`"a\n"`) therefore reports 2 lines, and `lines: '2'` is accepted.
- **Impact**: citations can point just past the end of the file, including onto files with no content lines.
- **Recommendation**: `const count = text.length === 0 ? 0 : text.split(/\r?\n/).length - (/\r?\n$/.test(text) ? 1 : 0)`.

### [LOW] Scan workspace trust boundary is weaker than it appears
- **File**: server/scanner.ts:127-129, 308, 339
- **Category**: security
- **Problem**:
  - The digests that the "prepared source was modified" check relies on come from `scan.json`. That file is writable by the same UID as the worker, and `loadScan` reads it with an unchecked cast (`as ScanMetadata`), with no schema validation. The `chmod 0o400` on the source files is advisory, because the worker can simply `chmod` them back.
  - The base directory is a predictable shared path, `/tmp/groundwork-scans`. If another user creates it first, the `chmod(base, 0o700)` call fails, and every scan fails with it.
  - The compatibility fields (`budgets?`, `dependencyFingerprints?`, "predates durable manifests") are dead code, because scans expire after 24 hours.
- **Impact**: tamper detection only catches accidents, and on shared hosts a denial of service is possible.
- **Recommendation**:
  - Validate `scan.json` with zod.
  - Keep an HMAC over the metadata (key in `~/.config/groundwork-v2`), or store metadata outside the worker-visible directory.
  - Use a per-user base (`groundwork-scans-${os.userInfo().uid}`) and check its ownership with `lstat`.
  - Remove the compatibility fields.

### [LOW] Agent-instruction exclusion only covers the repository root
- **File**: server/scan-inventory.ts:25
- **Category**: security
- **Problem**: `lower === 'agents.md' || lower === 'claude.md'` matches only files at the root. Nested `packages/x/AGENTS.md` or `CLAUDE.md` files, and root `.cursorrules` or `.windsurfrules`, are copied into the worker's snapshot.
- **Impact**: the prompt-injection defence in depth has gaps. The worker contract still says to ignore instructions, but the exclusion's stated intent is not met.
- **Recommendation**: match on the basename (`agents.md`, `claude.md`, `.cursorrules`, `copilot-instructions.md`) at any depth, and document the list.

### [LOW] Readability: dense lines, magic numbers and long prose strings inside logic
- **File**: server/scanner.ts:230-236, 314, 558, 565, 569, 574, 620
- **Category**: readability
- **Problem**:
  - Several lines run to 300-400 characters. Examples: the nested ternary that picks the incremental mode; `boundary` resolution at 558; the `retainedManifest` calls at 565 and 569; the return statement at 574.
  - Numeric constants are repeated or unnamed: the 24-hour TTL (lines 161 and 296), the freshness limits `200` and `65536`, `32 * 1024 * 1024`, and 1 MiB and 4096 in the inventory.
  - Long policy strings (`reviewNote`, `applyPolicy`, `workerContract`) are inlined in return statements.
- **Impact**: hard to review and diff, and easy to change inconsistently.
- **Recommendation**:
  - Name the constants: `SCAN_TTL_MS`, `MAX_EXEC_BUFFER`, `FILE_SIZE_LIMIT`, `SNIFF_BYTES`.
  - Move the policy text to a `scan-policy.ts`.
  - Replace the ternary chain with an `incrementalMode()` function that uses early returns.

## Positive notes
- **Atomic, self-consistent writes**: every apply path builds the complete change set (component documents plus a content-addressed manifest, derived by re-parsing the candidate plan in `manifestChange`) and commits it through a single `writePlan`. The write checks `expectedRevision` and `expectedContext`, and a cleanup failure after commit is reported as `deferred` rather than rolled back.
- **Sound snapshot boundaries**: submodules and symlinks are excluded using Git file modes, evidence paths must be members of the inventory for that project (so traversal is impossible), blob hashes are checked for both SHA-1 and SHA-256, and `.git` never reaches the worker.
- **Guarded against silent inventory loss**: `requireRetainedInventory` forces explicit, evidenced retirement, and `reconcileCatalog` cascades retirement to dependent flows while keeping the retired observation for audit.
- **Safe temp-directory lifecycle**: preparation works in a `mkdtemp` `pending-` directory, renames it into place only when complete, and removes it on any error. Scan IDs are UUIDs validated before any path is built from them.
- **Separator hygiene**: `--` is already used for the `git clone` and `gh` paths, and URL schemes are allow-listed (which blocks `ext::`).

## Suggested refactor plan for this slice
1. **Security fixes, now**: validate `sourceRef` and add `--end-of-options`. Tighten the `gh` shorthand regex. Stop following symlinks in `makeWritable` and make sweeping tolerate per-entry errors. Strip and reject credentials in repository identities. Add regression tests for all of these.
2. **Build snapshots from Git objects** (`cat-file --batch` or `git archive`) instead of a working-tree checkout. This fixes the CRLF and filter digest failures and removes the need for a checkout.
3. **Fix the partial-area merge** in `applyRepositoryScan`: per-area evidence and gaps, and per-area coverage revisions. Stop consuming supporting scans, and normalise the `observationIds` in supporting manifests.
4. **Create `server/repository-identity.ts`** and replace the three identity normalisers (scanner, freshness, and the raw comparisons in `detectProjects` and findings).
5. **Consolidate schemas**: export `idSchema`, `commitShaSchema`, `relativePathSchema` and `evidenceSchema` from content-schema. Move the scan operation schemas to `src/data/scan-schema.ts`, and validate `scan.json` with zod.
6. **Split `scanner.ts`** along the proposed seams (workspace, acquire, packets, evidence, apply-baseline, lifecycle), extracting pure `planPackets`, `incrementalMode`, `mergeComponent` and `retirementCascade` functions.
7. **Add unit tests** for `scan-projects.ts` and for the extracted pure functions (budget math, cascades), plus integration tests for sweeping, expiry and foreign-checkout rejection.
8. **Make `inventory` lazy**: size and path filters first, head-only reads within the budget, and bounded concurrency. Add timeouts and `BatchMode` to every external command.
