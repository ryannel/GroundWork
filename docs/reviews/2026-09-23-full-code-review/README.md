# Groundwork full code review — 23 September 2026

Reviewed at commit `a6735fd` on the whole repository: the Node runtime in `server/`, the React viewer in `src/`, the shared domain code in `src/data/`, and the tests, scripts, schemas, packaging, CI and docs around them. The review covers readability, accuracy, modularity, best practice, clean code and clean architecture.

The seven detailed reports in this folder hold every finding with file and line references, evidence and a concrete recommendation. This document is the consolidated view: the overall verdict, the findings that need fixing first, the cross-cutting themes, and a suggested order of work.

| Report | Scope |
| --- | --- |
| [server-persistence.md](server-persistence.md) | `repository.ts`, `format.ts`, `catalog-storage.ts`, `catalog-migration.ts`, `registry.ts`, `git.ts`, `setup.ts`, `cli.ts`, `bin/` |
| [server-scanner.md](server-scanner.md) | `scanner.ts`, `scan-inventory.ts`, `scan-projects.ts`, `scan-manifests.ts` |
| [server-api.md](server-api.md) | `operations.ts`, `http.ts`, `mcp.ts`, `viewer.ts`, `catalog.ts`, `catalog-freshness.ts`, `knowledge.ts` |
| [src-data.md](src-data.md) | `src/data/*`, `src/lib/theme*`, `runtime.ts`, `store.ts` |
| [src-heavy-components.md](src-heavy-components.md) | `component-inspector.tsx`, `system-overview-map.tsx`, `execution-flow.tsx`, map layout and physics |
| [src-pages-shell.md](src-pages-shell.md) | `app.tsx`, shell, pages, `components/spec/*`, `ui/*`, `mocks/`, `styles/*.css` |
| [tooling-tests-docs.md](tooling-tests-docs.md) | test suite, scripts, tsconfig, oxlint, Vite, CI, packaging, docs, shipped skill |

## Method

Baseline on a clean checkout: `npm ci`, `npm run lint`, `npm run build` and `npm test` all pass (140 of 140 tests). Three discovery passes mapped the architecture, then seven independent reviewers each took one slice, read the code in full, and reproduced every CRITICAL and HIGH finding with a throwaway experiment before reporting it. The orchestrator re-verified the top findings against the source. No repository files were changed by the review.

## Verdict

This is a carefully built codebase with an unusually strong security and data-integrity posture for a local tool. Path handling, git invocation, the HTTP hardening, revision and context checks, atomic writes with journals, evidence-gated catalog writes and the byte-budgeted catalog query are all thought through, and the tests assert behaviour through public operations rather than internals.

The problems fall into three groups. First, a small number of real defects that contradict the care shown elsewhere: one option-injection hole in the scanner, a lock-file race, a journal that can wedge a repository, and a handful of viewer bugs that blank the page or throw away user state. Second, a set of structural debts that will slow every future change: the same concept implemented in several places (repository identity three times, URL parameter names in five files, zod primitives per module), a few god modules, a hidden global in the viewer, and an app that remounts on every save. Third, the test suite and shipped agent docs have drifted from the code in ways that CI does not catch.

None of the structural debt is urgent on its own. The defects are, and most of them are small to fix.

## Findings at a glance

| Slice | Critical | High | Medium | Low | Total |
| --- | ---: | ---: | ---: | ---: | ---: |
| Server persistence and CLI | 0 | 4 | 7 | 6 | 17 |
| Scanner | 1 | 4 | 7 | 6 | 18 |
| Server API, HTTP, MCP, catalog | 0 | 3 | 7 | 6 | 16 |
| Shared data layer and runtime | 0 | 2 | 9 | 4 | 15 |
| Heavy viewer components | 0 | 2 | 8 | 6 | 16 |
| Pages, shell, UI, styles | 0 | 2 | 9 | 7 | 18 |
| Tests, tooling, packaging, docs | 0 | 4 | 8 | 8 | 20 |
| **Total** | **1** | **21** | **55** | **43** | **120** |

Some findings appear in more than one slice because the same root cause surfaces in several files. Those are consolidated under "Cross-cutting themes" below.

## Fix now

These are the CRITICAL and HIGH findings, grouped by the risk they carry. Each has a full write-up with reproduction and recommendation in the slice report.

### Security

1. **Option injection through `sourceRef` runs arbitrary commands.** `server/scanner.ts:202` passes the caller's `sourceRef` to `git fetch --depth=1 origin <ref>` with no `--end-of-options`, and the schema only requires a non-empty string. A ref such as `--upload-pack=<cmd>` executes `<cmd>`. The operation is reachable over MCP and `POST /api/operations/prepare_repository_scan`. Validate refs, add `--end-of-options`, and tighten the `owner/name` shorthand so it cannot start with `-`. *(scanner, CRITICAL)*
2. **Scan cleanup follows symlinks.** `makeWritable` in `scanner.ts:136-163` calls `chmod` on symlinks in the worker-writable `output/` folder, so a link can change permissions on files outside the scan, and one dangling link makes every later `prepareRepositoryScan` fail. Skip symlinks and make the sweep tolerate per-entry errors. *(scanner, HIGH)*
3. **Credentials in `origin` URLs are written into the catalog and into immutable scan manifests.** `scanner.ts:187-190, 205-209`. Strip and reject userinfo in one shared identity helper and redact URLs in rethrown errors. *(scanner, HIGH)*
4. **Fixtures and docs appear to contain another organisation's internal data.** `tests/fixtures/catalog/*.json` is a 343 KB scan of four `<org>/*` repositories with endpoint and controller names; docs and evals reference internal system names and `/Users/...` paths. Confirm with the data owner, then replace with a synthetic fixture of the same shape. *(tooling, HIGH)*

### Data integrity

5. **Lock file is created empty and the PID written afterwards.** `server/repository.ts:72-84`. A contender reading in the gap gets `JSON.parse('')` and a fatal "Invalid lock file" error (about 0.8 % of contended acquisitions in a stress test). A crash in the gap leaves a lock that `recover` cannot clear because `recover` itself takes the lock. Publish the lock atomically. *(persistence, HIGH)*
6. **An external edit during `transactStorage` leaves a blocking journal although nothing was written.** `repository.ts:181-191`. The journal is written before the "unchanged since read" check, and the rollback then refuses to run because the edited file matches neither `before` nor `after`. Every later read fails until the journal is deleted by hand. Check all paths before journaling and roll back only what was written. *(persistence, HIGH)*
7. **An orphaned `*.tmp` from an interrupted write makes the repository unreadable.** `repository.ts:63-65, 23-26`. The reader rejects any unrecognised file name and `recover` does not clean temp files. Skip and remove them, and add a directory `fsync` after `rename`. *(persistence, HIGH)*
8. **A partial-area rescan erases evidence and gaps and reports stale coverage as complete at the new revision.** `scanner.ts:453-478`. Coverage is merged from the previous scan while evidence and gaps are replaced wholesale. Keep evidence and coverage per area with per-area revisions. *(scanner, HIGH)*
9. **Evidence hashing reads working-tree bytes.** `scanner.ts:366`. Repositories with `eol=crlf`, `autocrlf` or filters fail every citation with a message that blames tampering. Build the snapshot from git objects instead of a checkout. *(scanner, HIGH)*
10. **POST bodies are decoded chunk by chunk.** `server/http.ts:77-78`. A multi-byte character split across TCP reads becomes U+FFFD and is persisted; reproduced with a `write_plan` body. Collect buffers and decode once with a fatal decoder. *(api, HIGH)*
11. **`catalogIndex` re-reverses its own reverse links.** `src/data/catalog-index.ts:44-47`. The reverse pass pushes relations whose reason text matches its own filter, so later entries gain relations that do not exist. These are frozen into knowledge baselines, so plan a migration note. Type relations instead of matching on prose. *(api, HIGH)*

### Availability and resource leaks

12. **SSE cleanup is registered after an `await`.** `http.ts:65-71`. A client that disconnects before `selectRoot` resolves leaks two intervals and a recursive watcher for the life of the process. Register the close handler first and re-check `closed` after each await. *(api, HIGH)*
13. **One deleted project or pruned worktree breaks checkout selection for all projects.** `server/registry.ts:111-116`, `git.ts:24-26`. `discover` uses `Promise.all` over `realpath`, and `selectRoot` does not catch per-record failures. *(persistence, HIGH)*
14. **The central project poll starves under load.** `src/data/runtime.ts:64-76, 99-101`. A new request every 3 s regardless of in-flight state, and only the newest may publish, so any inventory slower than 3 s is always discarded while the server runs unbounded concurrent inventories. *(data, HIGH)*

### Viewer correctness

15. **The whole app remounts on every plan save.** `src/app.tsx:22` keys `<Routes>` on the plan revision hash. Every save scrolls to top, moves focus, clears the search box and collapses panels while an agent is editing. Key on the checkout token only. *(pages, HIGH)*
16. **No error boundary anywhere.** A failed lazy chunk after a Hub upgrade, or any render exception, unmounts the root to a blank page. *(pages, HIGH)*
17. **Plain-object indexes crash on IDs such as `hasOwnProperty`.** `src/data/spec-index.ts:43`. The ID rule allows most `Object.prototype` member names; a valid plan white-screens every feature page. Use `Map`. *(data, HIGH)*
18. **Map re-layout depends on prop identity, with a `new Map()` default.** `src/components/system-overview-map.tsx:92, 198-228`. A caller that omits `observedStatus` loops ELK forever; an un-memoised caller loses pins on every click. *(heavy components, HIGH)*
19. **URL parameter names are duplicated in five files and have drifted.** `src/pages/product.tsx:50` clears component-scoped params with a regex that misses `finding`, `flow` and `jobs*`, so switching components shows the next component's findings panel open and empty. Share one `catalog-url.ts` between server and viewer. *(heavy components, HIGH)*

### Tests and shipped contract

20. **Tests are never type-checked.** No tsconfig includes `tests/`; a strict check finds 10 real errors, including `tests/workspace-view.test.ts:11` using `owner` where the model now requires `ownerId`. Add `tsconfig.test.json` to the build. *(tooling, HIGH)*
21. **Git-backed tests inherit the developer's global git config.** With `commit.gpgsign=true`, 27 of 140 tests fail. Add a shared test bootstrap that isolates git config and the Groundwork home and temp directories. *(tooling, HIGH)*
22. **The catalog skill copied into consumer repositories contradicts the schemas.** `taxonomy.md` documents `ownership: external` where the schema accepts only `third-party`; `validate_output.py` checks an obsolete shape and rejects the documented output; `jobs` and `sourceScans` are undocumented. *(tooling, HIGH)*

## Cross-cutting themes

These are the structural issues that recur across slices. Fixing each one removes several MEDIUM findings at once.

**Repository identity is normalised three different ways.** `server/catalog-freshness.ts:14-17`, `server/scanner.ts:183-190` and `src/data/execution-flow.ts:54` each canonicalise a GitHub URL or `owner/name` with different rules, and none strips credentials. One `repository-identity.ts` module, used by all three and by `detectProjects`, fixes the credential leak and the inconsistent matching together.

**Zod primitives are copied per module.** ID, text, SHA, HTTP method, timestamp and relative-path validators appear in `content-schema.ts`, `delivery.ts`, `delivery-legacy.ts`, `knowledge.ts`, `scan-manifest.ts` and `scanner.ts` with drifting behaviour (delivery trims strings, content does not). Extract `schema-primitives.ts` and move the scan operation schemas out of `scanner.ts` into `src/data`.

**Errors are mapped to status codes by class name, and stale edits are inconsistent.** `http.ts:106` maps only `Conflict` to 409; everything else, including server faults, is 400. Some stale-revision paths throw plain `Error` (`operations.ts:114`, `knowledge.ts:19, 56`, `catalog-migration.ts`). Introduce `Conflict`, `NotFound` and `InvalidInput` with one `statusFor()` and return 500 for the unexpected.

**Operation metadata lives in four places.** `operationSchemas`, `descriptions`, the MCP read-only and destructive hint lists, and the `operate()` if-chain must be kept in step by hand, and some MCP annotations are already wrong. A single typed operation registry replaces all four. The mutation logic for `create_feature`, `plan_delivery`, `record_progress` and `link_branch` should move out of `operate()` into pure domain functions.

**Five god modules.** `server/scanner.ts` (631 lines, schemas plus acquisition plus sandboxing plus three mutation operations), `src/components/component-inspector.tsx` (342 lines, lines of 1,100 to 1,500 characters, seven concerns, ten helper components), `src/data/content.ts` `loadContent` (165 lines), `server/operations.ts` `operate()`, and the `createServer` closure in `http.ts`. The scanner and inspector reports each propose a concrete file split.

**The viewer relies on a hidden global and a remount.** `src/data/store.ts:9-11` holds a module-level `q` reassigned via `attachSnapshot` and imported directly by 15 component files. It stays correct only because `app.tsx` remounts the whole tree on every revision, which is finding 15 above. Replace it with a snapshot-derived repository exposed through context or `useSyncExternalStore`, then drop the remount key.

**Strict TypeScript is off where it costs nothing.** `tsconfig.app.json` and `tsconfig.node.json` set only `strictNullChecks`; `tsconfig.runtime.json` is fully strict. Both looser configs pass `--strict` today with zero errors. Turn it on, then consider `noUncheckedIndexedAccess` for the domain code.

**The shared domain boundary is implicit.** `server/` imports eleven modules from `src/data/` with `.ts` extensions. They are DOM-free today but nothing enforces it, and zod ships to the browser as a consequence. A `shared/` or `src/domain/` directory with its own strict, no-DOM tsconfig and an import-restriction lint rule makes the boundary real.

**Magic strings and dense lines.** `.groundwork/write.lock`, `transaction.json` and the plan directory are repeated as literals across `repository.ts`, `catalog-storage.ts` and `setup.ts`. 449 lines exceed 200 characters and several exceed 1,000; `knowledge.ts:47` is a single 700-character return statement. Dense code is the main reason review effort here is much higher than the 12,500-line count suggests. A formatter with a line limit, plus named constants, would pay for itself quickly.

**Two design systems in the viewer.** `src/ui/*` primitives are used almost only by the `/design` showcase, while the pages use hand-written BEM-style CSS. About 423 of 2,139 CSS rules are dead, `workbench.css` defines a second palette, the "grain" skin cannot be reached from the UI, light-theme secondary text fails WCAG AA contrast, and some live text is set at 8 to 9 px. Decide what `src/ui` is for and clean up the CSS accordingly.

**Test structure.** Setup helpers (mkdtemp, init, git commit) are duplicated across 11 files in three styles; several tests are mega-tests that exercise many behaviours in one body; test files do not map to modules; `scan-projects.ts` has no tests at all, `cli.ts` and `mcp.ts` are only exercised via spawn, and the React layer has none. `operations.test.ts` creates its temp directory inside the checkout. `npm test` fails on a fresh clone until `npm run build` has produced `dist/`.

**Packaging and CI.** `dependencies` list the whole frontend stack (about 80 MB) although the compiled runtime imports only `zod`. CI tests Node 24 only while `engines` promises 22.18, never runs the packaging smoke test, and never type-checks tests. `bin/groundwork-v2.js` fails with a raw `ERR_MODULE_NOT_FOUND` when `runtime/` is unbuilt. `npm start`, `dev` and `preview` all run a 16 s production build; there is no fast dev loop.

**Docs.** CLI names, ports and documented catalog limits match the code. `CONTENT.md` gives wrong validation and loading guidance, `PORTABLE.md` understates rollback semantics, and the `SYSTEM_KNOWLEDGE_*` design-history documents sit beside user-facing reference docs.

## What is done well

- **Local HTTP hardening**: Host allow-list against DNS rebinding, Origin check, JSON content type to force preflight, strict CSP, `nosniff`, `no-store`, `no-referrer`, bound to 127.0.0.1, bearer token on mutations.
- **Path and git safety**: `safePath` rejects `..`, `.`, empty and absolute segments and `lstat`s every component for symlinks; git is invoked via argv with no shell, `--end-of-options` on user refs in `git.ts`, `--` before paths, hooks and fsmonitor disabled, terminal prompts off; git-backed reads check blob modes.
- **Revision and context checks** are re-validated under the lock after recovery and again before the storage write. The persistence reviewer found no way for a stale write to get through.
- **Scanner write path**: every apply builds a complete change set with a content-addressed manifest and commits it in one `writePlan`; evidence paths must belong to the project inventory; `requireRetainedInventory` forces explicit, evidenced retirement; temp scans are built in a `pending-` directory and renamed into place only when complete.
- **One zod source of truth** with JSON schemas regenerated and byte-checked in the build; `strictObject` operation schemas double as the published MCP contract.
- **Honest, bounded catalog query**: byte-budgeted pages, cursors bound to snapshot and query, explicit `sourceTrust` and `uncertainty`, and a freshness check that fails closed to `unknown`.
- **Careful React patterns** where they exist: adjust-state-during-render instead of effects, complete effect cleanup, a correct stale-layout guard on the ELK map, thorough tablist ARIA wiring, skip link and focusable `<main>`.
- **Tests assert behaviour**: operations are compared with the query API, CLI and MCP adapters must agree, tampered cursors and stale revisions and foreign origins are rejected, and the browser-runtime race tests are precise.

## Suggested order of work

1. **Security and integrity patch (days).** Findings 1, 2, 3, 5, 6, 7, 10, 12 and 13. Each is a small, local change with a regression test. Ship this before anything else.
2. **Viewer stability (days).** Findings 15, 16, 17, 18 and 19: drop the revision from the routes key, add two error boundaries, switch `spec-index.ts` to `Map`, fix the map layout key, and introduce the shared `catalog-url.ts`.
3. **Make the suite honest (days).** Findings 20 and 21 plus `strict` everywhere: `tsconfig.test.json`, `tests/setup.ts` with git and environment isolation, a shared `tests/helpers.ts`, inject the viewer directory so `npm ci && npm test` passes on a fresh clone, and a Node 22/24 matrix with the packaging smoke test in CI.
4. **Fix the shipped contract and data provenance (days).** Finding 22 and 4: correct the skill docs, delete or regenerate `validate_output.py`, add a test that validates the doc examples against the zod schemas, and replace the catalog fixture with a synthetic one.
5. **Scanner correctness (a week).** Findings 8, 9 and 11: per-area evidence and coverage, snapshots from git objects, typed catalog relations with a baseline migration note. Then the `repository-identity.ts` and `schema-primitives.ts` consolidations, and the `scanner.ts` split.
6. **Server architecture (a week).** The typed operation registry, the error taxonomy, domain mutations out of `operate()`, `validateTransition` out of `writePlan`, and a shared SSE poller.
7. **Viewer architecture (one to two weeks).** Repository context instead of the global `q`, the `component-inspector.tsx` split, URL-only catalog state, lazy-loaded map stack, the CSS clean-up, and a first React test layer.
8. **Ongoing hygiene.** A formatter with a line limit, named constants for paths and physics numbers, `dependencies` trimmed to `zod`, a real `dev` script, and the design-history docs moved out of `docs/`.
