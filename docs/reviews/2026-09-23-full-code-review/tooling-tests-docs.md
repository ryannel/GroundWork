# Test suite quality, scripts, build/tooling configuration, CI, packaging and docs

## Summary
The test suite is better than most. Its 140 tests check behaviour, not implementation details. Most tests have descriptive names and use real temp directories, real git and real HTTP servers. Failure paths (stale revisions, interrupted journals, symlinks, origin/token checks, cursor tampering) are covered. The biggest risks sit around the tests rather than in them:
- No tsconfig type-checks `tests/`. Ten real type errors exist there today, including a fixture written against an obsolete `Feature` shape.
- Every git-backed test reads the developer's global git config. 27 tests fail when `commit.gpgsign` is enabled (26 git-backed tests plus the dist-dependent Hub test).
- `npm test` depends on a prior `npm run build`.
- The agent-facing contract shipped to every consumer project disagrees with the zod schemas. This contract is the catalog skill's `taxonomy.md`, `normalized-output.md` and `validate_output.py`.
- Packaging installs the whole React/ELK/lucide stack as runtime `dependencies`, although the compiled runtime imports only `zod`.
- Fixtures, docs and the skill evals carry what appears to be third-party organisation data (`<org>/*` repos, internal system names, `/Users/...` paths). Someone should confirm this is cleared for the public GitHub remote.

## Findings

### [HIGH] The test suite is never type-checked; 10 real type errors already exist, including a stale model fixture
- **File**: tsconfig.node.json:23, tsconfig.app.json:32, tests/workspace-view.test.ts:11
- **Category**: testing
- **Problem**: `tsconfig.app.json` includes only `src`. `tsconfig.node.json` includes only `vite.config.ts` and `scripts/**/*.ts`. `node --test` only strips types. Nothing checks `tests/*.ts`, in `build`, in `lint` or in CI. I checked the tests with a scratch tsconfig (strict, nodenext) and ignored the resolution noise from bundler-style `src` imports. That left genuine errors:
  - `tests/workspace-view.test.ts:11` uses `const feature: Feature = { … owner: 'Ryan', … }`. This fails with "Property 'ownerId' is missing". The fixture uses the pre-migration shape and passes only because the function under test ignores ownership.
  - `tests/catalog-freshness.test.ts:64,65,72,73`: `result.changes!` does not exist on the `unknown`-status branch of the union returned by `checkCatalogFreshness`. The test relies on non-null assertions over a discriminated union it never narrows.
  - `tests/content.test.ts:99`: `q.viewer().name` is possibly undefined.
  - `tests/system-map-layout.test.ts:13,14,34,36,37`: the ELK default import is not constructable under nodenext, plus implicit `any`.
  - There are also 10 `t: any` helper signatures and about 50 `as any` casts (`scanner.test.ts` has 17 lines with them, `catalog-query.test.ts` 11). Much of the suite is therefore effectively untyped.
- **Impact**: Fixtures drift away from the model silently. A renamed field in `model.ts` or in a server result type does not break any test at compile time. It shows up only as a confusing runtime assertion failure, or never, when the drifted field is unused, as in workspace-view. The `as any` casts hide exactly the result-shape changes that the server slice changes often.
- **Recommendation**: Add `tsconfig.test.json`:
  - Settings: `"include": ["tests/**/*.ts"]`, `strict: true`, `lib: ["ES2023","DOM"]`, `moduleResolution: "bundler"`, `allowImportingTsExtensions`, `noEmit`, `types: ["node"]`. Bundler resolution matches how `src` is written.
  - Reference it from `tsconfig.json` so `tsc -b` covers it.
  - Fix the 10 errors: use `ownerId` in the workspace-view fixture, and narrow on `result.status` or `'changes' in result` instead of using `!`.
  - Type the fixture helpers as `TestContext` from `node:test` instead of `any`.

### [HIGH] Git-backed tests inherit the developer's global git config; 27 of 140 tests fail with `commit.gpgsign=true`
- **File**: tests/runtime.test.ts:19-23, tests/scanner.test.ts:15-32, tests/catalog-freshness.test.ts:17-21, tests/catalog-migration.test.ts:24-25 (and server/git.ts:7, which passes `...process.env` through)
- **Category**: testing
- **Problem**: The fixtures set a local `user.name`/`user.email`. Some use `git config` and others `-c`, so three styles exist. None of them isolate the rest of the ambient configuration. `gitRaw` disables hooks and fsmonitor but forwards `process.env`, so `~/.gitconfig` and the system config apply. I verified this with `GIT_CONFIG_GLOBAL=<file with commit.gpgsign=true, gpg.program=false> node --test tests/*.test.ts`:
  - Result: **27 failed, 113 passed**. The failures are every catalog-freshness, scanner, catalog-migration and worktree/branch test, plus the dist-dependent Hub test.
  - Signing is enabled globally for many developers (1Password/SSH signing, corporate policy). A locked or absent agent produces exactly this failure.
  - For comparison, the brief's claim about `catalog-freshness.test.ts:32` is not accurate: identity is set at lines 18-19. The real exposure is the rest of the global config (signing, `init.templateDir`, `core.autocrlf`, `commit.template`, `safe.directory`, and so on).
- **Impact**: Contributors see a large, confusing wall of failures that has nothing to do with their change. CI passes only because the runner has no global config.
- **Recommendation**: Add one shared test bootstrap loaded with `node --test --import ./tests/setup.ts tests/*.test.ts`. It sets `GIT_CONFIG_GLOBAL=/dev/null`, `GIT_CONFIG_NOSYSTEM=1`, `GIT_AUTHOR_NAME/EMAIL` and `GIT_COMMITTER_NAME/EMAIL`. It also sets `GROUNDWORK_HOME` and `GROUNDWORK_TMPDIR` to a per-process temp dir (see the isolation finding below). Remove the three ad hoc identity styles from the fixtures.

### [HIGH] The catalog skill shipped to every consumer contradicts the schemas: `ownership: external`, an obsolete validator, missing `jobs`/`sourceScans`
- **File**: .agents/skills/groundwork-system-catalog/references/taxonomy.md:31, scripts/validate_output.py:11-13, references/normalized-output.md:139-146
- **Category**: correctness
- **Problem**: `installInstructions` (server/setup.ts:18-22) copies `SKILL.md` and `references/*.md` into each consumer repository. They form the contract agents follow. Three parts of it are wrong:
  1. **Ownership value:** `taxonomy.md` says ``- `external`: operated outside the organization.`` But `content-schema.ts:146` is `ownership: z.enum(['internal', 'third-party'])`. An agent following the taxonomy for LaunchDarkly, which is the doc's own example, writes a component that `apply_repository_scan` rejects.
  2. **Obsolete validator:** `validate_output.py` checks a completely different, older shape: `REQUIRED_TOP_LEVEL = {"repository","revision","component","relations","apis","resources","messages","gaps"}` and `OWNERSHIP = {"internal","external"}`. I fed it the exact shape documented in `normalized-output.md` (id/productId/sourcePath/…/coverage). It exits 1 with "Missing top-level fields: apis, component, messages, …". Nothing references the script, yet it ships in the npm tarball through `files`.
  3. **Stale operation docs:** `normalized-output.md` §"Focused investigation contract" lists `flows`/`findings` only. The schema (server/scanner.ts:522-529) also takes `jobs` and `sourceScans`, and cross-repository citations *require* `sourceScans` (tests/catalog-freshness.test.ts:259). Line 139 says "Source freshness and future incremental reuse need explicit verification support". `check_catalog_freshness` and `prepare_repository_scan.incremental` now exist. `SKILL.md` never names `search_catalog`/`get_discovery_context` ("Reuse catalog context before source work"), `check_catalog_freshness` or `discard_repository_scan`.
- **Impact**: Agents get deterministic validation failures and waste turns. Worse, they may follow the validator and produce output the server will never accept. The docs describe capabilities as missing that exist, so agents skip the freshness and incremental tooling.
- **Recommendation**:
  - Change `taxonomy.md` to `third-party`.
  - Delete `validate_output.py`, or regenerate its checks from `schemas/apply_repository_scan.schema.json` (the JSON schema already exists; an agent can validate against it directly).
  - Document `jobs`/`sourceScans`, name the discovery and freshness operations in SKILL.md, and drop the stale "future" sentence.
  - Add a test that parses the `normalized-output.md` JSON example with `applyRepositoryScanSchema`'s discovery schema and asserts every enum literal in `taxonomy.md` exists in `content-schema.ts`, so the contract cannot drift again.
  - Narrow `package.json` `files` to `SKILL.md` and `references/`.

### [HIGH] Test fixtures, docs and skill evals appear to contain third-party organisation data and local user paths
- **File**: tests/fixtures/catalog/components.json (343 KB), tests/fixtures/catalog/products.json, scripts/catalog-evaluation.ts:12-20, docs/SYSTEM_KNOWLEDGE_PLAN.md:15, docs/CATALOG_DISCOVERY.md:63, .agents/skills/groundwork-system-catalog/evals/evals.json:6, tests/execution-flow.test.ts:20, tests/fixtures/wordloop/provenance/source-manifest.json
- **Category**: security
- **Problem**: The catalog fixture is a full scan of four repositories: `"repo": "<org>/<repo>"`, `<org>/<repo>`, `<org>/<repo>` and `<org>/<repo>`. It has 82 endpoints, controller paths such as `PricesController.cs` and schema names. `products.json` names "Price calculation system (<internal id>) in the <internal platform>" and internal systems "<internal system> and <internal system>". The docs record a "live MSRP example … <internal service> at `5b5b143f…`" and `/Users/<user>/Workspace/price-engine`. The wordloop provenance holds dozens of `/Users/<user>/Workspace/...` paths. `evals.json` ships in the npm tarball and contains a "<internal platform>" scenario. The origin is `github.com/ryannel/GroundWork` with an MIT LICENSE.
- **Impact**: If these repositories are not public, the fixture discloses an employer's internal service architecture, endpoints and source layout in a personal repository. It also ships part of it in the package. It is also brittle: tests and `catalog-evaluation.ts` hard-code these IDs.
- **Recommendation**: Confirm with the data owner whether this may be published. Either way, replace `tests/fixtures/catalog` with a synthetic catalog that keeps the same structural properties: 4 components, several with long endpoint lists, one event dispatcher with no endpoints, and a "MSRP"-style paraphrase target. Scrub the absolute paths. Keep design-history docs that cite real systems out of the shipped repo (see the design-history docs finding below).

### [MEDIUM] `npm test` silently depends on a previous `npm run build` (the Hub test fails on a fresh clone)
- **File**: tests/viewer.test.ts:20-22, server/http.ts:20,106
- **Category**: testing
- **Problem**: The test fetches the Hub root and asserts `/<html/`. `serve()` serves `path.join(packageRoot, 'dist')`, a gitignored build output. In a clean `git archive` checkout with `node_modules` present, `node --test tests/*.test.ts` gives **139 pass, 1 fail** with `expected: 200, actual: 400`. The 400 comes from the ENOENT on `dist/index.html` being mapped to 400 by the catch-all at http.ts:106. CI hides the dependency because it runs `npm run build` before `npm test`. A stale `dist/` also passes silently.
- **Impact**: `npm ci && npm test`, the natural contributor loop that README's "Develop the tooling" block implies, fails. The test also exercises whatever `dist/` happens to exist rather than a controlled fixture.
- **Recommendation**: `serve` already accepts `viewerDirectory` (http.ts:20). Thread it through `startViewer` and point the test at a tiny temp dir that contains an `index.html`. Keep one explicit "built viewer is served" check in the package smoke test instead.

### [MEDIUM] Runtime `dependencies` contain the whole frontend stack; the compiled runtime imports only `zod`
- **File**: package.json:22-35
- **Category**: best-practice
- **Problem**: `grep` of every bare import under the compiled `runtime/` finds only `node:*` modules and `zod`. Yet `dependencies` lists react, react-dom, react-router-dom, @xyflow/react, elkjs, d3-force, **@types/d3-force**, motion, lucide-react, clsx and tailwind-merge. All of them are bundled into `dist/` by Vite. Consumers following README (`npm install --save-dev ./vendor/groundwork-v2-*.tgz`) install about 80 MB they never execute: lucide-react alone is 42 MB, zod 7.9 MB, elkjs 7.8 MB and react-dom 7.2 MB in `node_modules`. `@types/d3-force` is a type package in runtime deps.
- **Impact**: Slow, heavy installs in every consumer repo and on every fresh-clone `npm ci`. Unnecessary React copies land in the app's tree, and supply-chain surface grows.
- **Recommendation**: Move everything except `zod` to `devDependencies`, since the viewer is prebuilt in `dist/`. Then run `scripts/package-smoke.ts` (see the CI finding below) to prove the packed CLI still works with production deps only.

### [MEDIUM] `strict` is off for the app and scripts, although enabling it costs nothing today
- **File**: tsconfig.app.json:30, tsconfig.node.json:21
- **Category**: best-practice
- **Problem**: The app and node configs enable only `strictNullChecks`. The runtime config is `strict: true`. I ran `npx tsc -p tsconfig.app.json --noEmit --strict` and `npx tsc -p tsconfig.node.json --noEmit --strict`: **0 errors** each (86 `src` files, and 15 server + 16 `src` files through `scripts/`). The strict flags are off only because nothing turns them on.
- **Impact**: New code in `src/` and `scripts/` can add implicit `any`, unsafe `this` and bivariant function params with no signal, while the same `src/data` modules compiled via the runtime config are strict. The two profiles can disagree about the same file.
- **Recommendation**: Replace `strictNullChecks` with `"strict": true` in both configs now. Optionally trial `noUncheckedIndexedAccess`: it shows 59 errors in the node profile, so do it as a follow-up.

### [MEDIUM] CI tests only Node 24, never the packaged artifact, and never type-checks tests
- **File**: .github/workflows/ci.yml:18-23, scripts/package-smoke.ts
- **Category**: best-practice
- **Problem**: `node-version: 24` while `engines` is `>=22.18.0`. 22.18 is the first release where type stripping is unflagged, and the suite depends on it (`node --test tests/*.test.ts`, `node scripts/*.ts`, `--input-type=module -e "import './server/cli.ts'"` in adapters.test.ts:15). The distributed product is the tarball, but CI never packs it. `scripts/package-smoke.ts` already does install → init → commit → clone → `npm ci` → compiled HTTP viewer, and it is not referenced from package.json or CI. There is no `tsc` step for tests (see the first finding).
- **Impact**: Regressions at the minimum supported Node version, or in the `files` whitelist, `bin` shim or `packageRoot` resolution (setup.ts:11 relies on `/runtime/` being in the URL), reach users first.
- **Recommendation**: Use a matrix of `node: [22.18.0, 24]`. Add `npm run test:package` (`npm pack && node scripts/package-smoke.ts`) as a separate job. Add the tests tsconfig to `tsc -b`. Consider `concurrency: { group: ci-${{ github.ref }}, cancel-in-progress: true }`.

### [MEDIUM] Test files do not map to modules; mega-tests; setup helpers duplicated across 11 files
- **File**: tests/catalog-freshness.test.ts:90-132, tests/runtime.test.ts:125-144, tests/*.test.ts (fixture helpers)
- **Category**: testing
- **Problem**:
  - **Misnamed files:** 8 of the 12 tests in `catalog-freshness.test.ts` exercise `scanner.ts`, `knowledge.ts` and `scan-manifests.ts`, loaded by `await import(...)` inside test bodies for no reason (line 100 even does `const { readFile } = await import('node:fs/promises')`). `runtime.test.ts` covers setup, repository, format, git, http and export. `delivery.test.ts` also spins up HTTP.
  - **Mega-tests:** the test at lines 90-132 makes about 25 assertions across prepare, apply, manifest paging, immutability, hash mismatch, stale revision and historical refs. The first failure masks everything after it.
  - **Duplication:** 18 `mkdtemp` calls, 7 near-identical `fixture()` functions, about 42 hand-written `{ expectedRevision: p.revision, expectedContext: p.context.token }` guard objects (`runtime.test.ts` has `request()` and `operations.test.ts` has `guard()`, but neither is shared), three git identity styles, and three copies of the `GROUNDWORK_HOME` save/restore dance.
  - **Weak assertions:** `system-map-layout.test.ts:24` asserts `relationships.length === 8` on a module constant. That is nearly vacuous: it catches only push/splice, not element mutation. `runtime.test.ts:153` uses `assert.ok(tasks.length === 28)`, which loses the actual value on failure.
- **Impact**: Failures are slow to localise. Adding a test means copying a fixture, and the copies drift (for example, identity setup). The file names mislead anyone looking for scanner coverage.
- **Recommendation**:
  - Create `tests/helpers.ts` with `tempDir(t)`, `plannedRepo(t, { git?: boolean })`, `gitRepo(t, files)`, `guard(plan)` and `withEnv(t, vars)`.
  - Move the incremental-scan, manifest and knowledge tests into `scanner.test.ts`, `scan-manifests.test.ts` and `knowledge.test.ts`, and split `runtime.test.ts` into `repository.test.ts`, `http.test.ts` and `setup.test.ts`.
  - Break mega-tests into `t.test` subtests that share one fixture.
  - Replace the vacuous assertion with `assert.deepEqual(relationships, snapshotBefore)`.

### [MEDIUM] Coverage headline is misleading; branch coverage has real gaps and the React layer has zero tests
- **File**: tests/ (suite-wide); server/knowledge.ts, src/data/spec-index.ts, server/cli.ts, server/catalog-storage.ts
- **Category**: testing
- **Problem**:
  - `node --test --experimental-test-coverage` reports 98.2% lines. But the code is extremely line-dense (single lines of hundreds of characters with several branches), so line coverage says little.
  - Branch coverage tells the real story: knowledge.ts 59%, spec-index.ts 45%, cli.ts 35% (only `read` and `call` are driven; the `start`/`hub`/`serve` paths, `--port` validation and `export` flags are untested), catalog-storage.ts 67% and catalog-identity.ts 60%.
  - None of the ~80 `.tsx` components, pages or shell modules is loaded by any test, so they are absent from the denominator. There is no component or browser runner. Hooks with known smells (flow.tsx params-identity effect, focus trap in system-overview-map, scroll restoration) have no safety net.
  - `scan-projects.ts` has no direct unit tests but is well covered indirectly by scanner.test.ts (100% lines, 90% branches). That gap is lower priority than the brief suggested.
- **Impact**: Refactors of the dense catalog/knowledge code and all UI work proceed without meaningful regression protection. The headline number invites complacency.
- **Recommendation**:
  - Add `test:coverage` with branch thresholds (`--test-coverage-branches=80`), include `src/**/*.tsx` in coverage, and target knowledge.ts, spec-index.ts and catalog-storage.ts branches first.
  - Add unit tests for the `cli.ts` argv parser: extract it into a pure `parseArgs`.
  - Introduce a light React test layer, for example vitest + @testing-library/react + happy-dom, for the smart hooks and pages. Cover `useWorkspace`/`useProduct` and the flow selection sync first.

### [MEDIUM] CONTENT.md and README give wrong validation and loading guidance
- **File**: docs/CONTENT.md:32,41,78; README.md:9; scripts/content.ts:20
- **Category**: correctness
- **Problem**:
  - `CONTENT.md:78` documents `npm run content:validate  # current repository content`. `scripts/content.ts:20` defaults to `tests/fixtures/wordloop/content`: `process.argv[2] ?? path.join(root, 'tests/fixtures/wordloop/content')`. A user editing their own `content/` who runs the documented command always gets "Valid content: 1 workspaces, 1 products, 9 components, 1 features" for the fixture.
  - `CONTENT.md:32` says "Development updates appear through Vite; a production build contains a snapshot of the validated content". There is no `import.meta.glob`. The viewer now loads only from the Hub API, and README says a missing service shows an error instead of example data.
  - `README.md:9` says fixtures are "never loaded automatically", yet every `npm run build` (and therefore every `npm start`) validates the wordloop fixture.
- **Impact**: False confidence. Users think their legacy content validated when it was never read, and the loading model the doc describes no longer exists.
- **Recommendation**:
  - Make `content:validate` require a path, or default to `./content` and fail when that is missing.
  - Rename the build step to `content:validate-fixture` with an explicit fixture argument.
  - Rewrite CONTENT.md §AI-authored content to describe export-only use, and fix the README sentence.

### [MEDIUM] `npm start`, `dev` and `preview` all run a full 16 s production build; there is no fast dev loop
- **File**: package.json:7,20 (`"dev": "npm start"`, `"start": "npm run build && node bin/groundwork-v2.js hub"`), .claude/launch.json
- **Category**: best-practice
- **Problem**: Every start runs content validation, two schema checks, `tsc -b`, `vite build` and the runtime `tsc`. I timed it at about 16.3 s here. `dev` has no HMR, and README tells users to re-run after every viewer edit. `preview` is also an alias for the same thing, which is not what the name suggests. Server changes additionally require restarting the Hub, and `bin/` always runs the *compiled* runtime, which may be stale relative to `server/*.ts`.
- **Impact**: A slow edit-refresh loop for UI work (the largest code area), plus stale-runtime confusion.
- **Recommendation**:
  - Make `dev` run `vite` with `server.proxy: { '/api': 'http://127.0.0.1:4318' }` alongside `node server/cli.ts hub` (type stripping; no build needed).
  - Keep `start` as build+run for parity, and drop the misleading `preview` alias or point it at `vite preview`.
  - Point `.claude/launch.json` at the fast path.

### [LOW] `operations.test.ts` creates its temp project inside the repository checkout
- **File**: tests/operations.test.ts:11
- **Category**: testing
- **Problem**: `mkdtemp(path.join(process.cwd(), '.operations-test-'))` puts the fixture inside the GroundWork git work tree. `.gitignore` does not cover it. `readPlan` and `activity` then resolve git context from the *host* repository (its branch and HEAD). If the run is interrupted (Ctrl+C, crash), `.operations-test-XXXX/.groundwork/plans/**` is left as untracked files that `git add -A` will pick up. Other suites use `os.tmpdir()`. Similarly, runtime.test.ts:147-148 and adapters.test.ts:15 use `path.resolve('...')`/`cwd: path.resolve('.')` and fail if run from another directory, while other files use `import.meta.url`.
- **Impact**: Non-hermetic tests, and the risk of committing test debris.
- **Recommendation**: Use `os.tmpdir()`, or the shared `tempDir(t)` helper. Resolve fixture and repo paths from `import.meta.url` everywhere.

### [LOW] No global test isolation for `GROUNDWORK_HOME` / `GROUNDWORK_TMPDIR`
- **File**: tests/viewer.test.ts:13-15, tests/adapters.test.ts:44-45,64-66, server/scanner.ts:128
- **Category**: testing
- **Problem**: Each test that touches the registry saves and restores `process.env.GROUNDWORK_HOME` by hand. Tests that do not set it, such as `viewer.test.ts:45` and the spawned CLI/MCP children in adapters test 1, would read or write the developer's real `~/.config/groundwork-v2` if they ever reached `register`/`inventory`. They do not today. All scan tests share the real `os.tmpdir()/groundwork-scans` directory, which `sweepScans` walks and prunes, with any Groundwork Hub the developer has running.
- **Impact**: One future test can mutate a developer's real registry. Scan-dir interactions with a live local Hub are possible.
- **Recommendation**: Set both variables to a per-process temp dir in the `--import` bootstrap from the git-config finding above, and drop the per-test env dance.

### [LOW] `bin/groundwork-v2.js` crashes with a raw ERR_MODULE_NOT_FOUND when `runtime/` is unbuilt
- **File**: bin/groundwork-v2.js:2
- **Category**: best-practice
- **Problem**: `import { main } from '../runtime/server/cli.js'` is a static import. In a fresh clone, `node bin/groundwork-v2.js help` prints a Node internal stack ("Cannot find module …/runtime/server/cli.js"). README's "Migration fixture" section tells users to run `node bin/groundwork-v2.js export …` without mentioning a build first. Separately, `main().catch(e => console.error(e.message))` discards stacks for unexpected errors, and there is no `DEBUG` escape hatch.
- **Impact**: A poor first-run experience, and harder bug reports.
- **Recommendation**: Use `await import()` inside try/catch. On `ERR_MODULE_NOT_FOUND`, print "Groundwork runtime is not built; run `npm run build` (or run `node server/cli.ts` from a source checkout)". Print `error.stack` when `GROUNDWORK_DEBUG` is set.

### [LOW] Schema generator scripts: two near-duplicates, no orphan detection, inconsistent error handling
- **File**: scripts/content.ts:10-18, scripts/runtime-schemas.ts:7-12
- **Category**: architecture
- **Problem**: Both scripts write `schemas/<name>.schema.json` using `z.toJSONSchema` with a byte-compare `check` mode. The code is duplicated with different CLI conventions (`check-schemas` vs `check`). Neither detects stale *extra* files. Today there are 41 files, matching 13 document and 28 runtime schemas with no collisions or orphans, but a removed operation would leave its schema in the repo and the tarball, and consumers would get it in `.groundwork/schemas/`. `runtime-schemas.ts` has no try/catch, so a stale or missing file prints an unhandled-rejection stack. Also, `server/setup.ts` imports `scripts/content-files.ts`, so the shipped runtime depends on the build-scripts folder (`runtime/scripts/content-files.js` is in the tarball).
- **Impact**: Maintenance friction and silent schema cruft. Layering is blurred: runtime code lives in `scripts/`.
- **Recommendation**: Create one `scripts/schemas.ts` that builds a single `{name → schema}` map and asserts that there are no name collisions and that the directory listing equals the expected set. Move `readContentDirectory` into `server/` or `src/data/` and have the scripts import it from there.

### [LOW] Unwired, hard-coded `scripts/catalog-evaluation.ts` duplicates a test
- **File**: scripts/catalog-evaluation.ts:12-44
- **Category**: architecture
- **Problem**: The script is not in package.json or CI. It needs a private "<internal platform> catalog root" and hard-codes scenario IDs (`gpe-price/endpoint/post-api-v5-prices-calculate-msrp`, …). It overlaps the `evaluation:` test in `catalog-query.test.ts:28-52`, and it leaves a `groundwork-planning-evaluation-*` temp dir behind on purpose. It is type-checked but otherwise dead.
- **Impact**: Dead code tied to private data. Its assertions and the test's can diverge.
- **Recommendation**: Delete it, or move it to a private tooling repo. If the latency numbers matter, turn it into a `test:bench` against the synthetic fixture from the third-party data finding.

### [LOW] Design-history docs and live-example narrative live in the product docs
- **File**: docs/SYSTEM_KNOWLEDGE_PLAN.md, docs/SYSTEM_KNOWLEDGE_PLAN_REVIEW.md, docs/SYSTEM_KNOWLEDGE_EVALUATION.md, docs/CATALOG_DISCOVERY.md:63
- **Category**: readability
- **Problem**: Three dated design and review documents (about 4,600 words) sit next to the user guides. They contain absolute local paths and evaluation runs against external systems. CATALOG_DISCOVERY.md, a reference doc, embeds a "live MSRP example … at `5b5b143f…`" narrative. They are not in the npm `files`, but README's layout list does not mention them, and readers cannot tell current contract from history.
- **Impact**: Readers are confused about which document is authoritative, and private context leaks.
- **Recommendation**: Move them to `docs/history/` (or ADRs) with a one-line status header, or out of the repo. Strip the live example from CATALOG_DISCOVERY.md.

### [LOW] Word Loop fixture carries ~1 MB that no code or test reads
- **File**: tests/fixtures/wordloop/provenance/{sources/, api-guides.json, delivery-plan.json, task-breakdown.json, source-manifest.json}, tests/fixtures/wordloop/images/wordloop/entry_point.png
- **Category**: testing
- **Problem**: The fixture is 2.2 MB and 97 files. `exportLegacy` and the tests consume only `content/` (424 KB), `images/` (780 KB) and `provenance/portable/` (308 KB). `provenance/sources/` (464 KB) and the four top-level provenance JSONs (about 165 KB) are referenced only from `REVIEW.md`. `source-manifest.json` contains absolute `/Users/<user>/...` paths. `entry_point.png` alone is 600 KB, and the test only checks that asset files are non-empty (runtime.test.ts:157).
- **Impact**: Repo weight and noise. Private path disclosure.
- **Recommendation**: Move the provenance-only material to an archive branch or release asset, and replace the 600 KB PNG with a tiny valid PNG. The fixture keeps its migration value.

### [LOW] PORTABLE.md recovery and operation wording is incomplete
- **File**: docs/PORTABLE.md:87,115
- **Category**: readability
- **Problem**: Line 115 says a journal "preserves the before and after documents" and to "run `recover`". It does not say that `recover` **rolls back** to the before-images (repository.ts:95-107). The interrupted write is discarded and must be re-applied. Line 87 introduces "The other operations are …" with 10 names, while 22 exist. The rest are documented later in the file, which reads as if the list were complete. PORTABLE.md is copied into every consumer as `.groundwork/GUIDE.md`, so its precision matters to agents. The MCP setup (line 21: `npx --no-install groundwork-v2 mcp /abs/path`, or `--central`) matches `cli.ts:17,40` and `mcp.ts` exactly.
- **Impact**: Agents may assume `recover` completes the write, and may miss the catalog operations when reading the short list.
- **Recommendation**: Add "Recovery restores the pre-write state; re-read and re-apply the change." Make line 87 either complete or phrased as "Core planning operations are …; catalog operations are described in Focused system discovery".

### [LOW] Lint and bundle configuration are minimal; the version literal is duplicated
- **File**: .oxlintrc.json, vite.config.ts, server/mcp.ts:14, README.md:36,39
- **Category**: best-practice
- **Problem**:
  - **Lint:** oxlint runs only the default correctness set plus two React rules. Probing shows `react/exhaustive-deps` and `import/no-cycle` are clean today. `eslint/preserve-caught-error` flags 8 re-throws that lose `cause` (scanner.ts:173-178, format.ts:81, viewer.ts:20, content-files.ts:13), and `react/exhaustive-effect-dependencies` flags 2 extra effect deps (feature.tsx:51, flow-inspector.tsx:60). None of these are enforced, so regressions go unnoticed.
  - **Bundle:** the Vite config has no chunking config. Every build prints the ">500 kB" warning for the lazily loaded 1.4 MB `elk.bundled` chunk, next to a 488 KB entry chunk and 268 KB of CSS. Because the warning always appears, nobody notices a real regression.
  - **Version:** `0.4.12` is hard-coded in `mcp.ts` `serverInfo` and in README tarball names, so it drifts on every version bump.
- **Impact**: Minor, but cheap to fix.
- **Recommendation**:
  - Enable `react/exhaustive-deps`, `import/no-cycle` (with `--import-plugin`) and `eslint/preserve-caught-error` explicitly.
  - Set `build.chunkSizeWarningLimit` so it tolerates only the known ELK chunk (or run ELK in a worker via `elk-api` + `elk-worker`), and add a size budget for the entry chunk.
  - Read the version from package.json via `createRequire` or an import attribute in mcp.ts, and use `groundwork-v2-<version>.tgz` in the docs.

## Positive notes
- The tests assert observable behaviour through public operations, not internals:
  - `operate()` output equals `queryCatalog()` output.
  - The CLI and MCP adapters return identical revisions.
  - Tampered cursors, stale revisions, symlinks, traversal and foreign `Origin`/`Host` headers are all rejected.
  - Journal recovery pauses on external edits.

  Test names read as specifications ("unmapped source changes never produce verified-current; lockfiles require wider review").
- Real-world integration is exercised with real git repositories, worktrees, `serve({port: 0})` and SSE streams, and resources are cleaned up consistently via `t.after`. The browser-runtime race tests (stale startup and poll generations, fake `EventSource`) are well built.
- Generated JSON schemas are verified byte-for-byte in `build`, so the checked-in schemas cannot drift from zod. The lockfile is clean: version 3, registry-only, no audit findings in prod deps.
- `scripts/package-smoke.ts` is a thoughtful end-to-end packaging test (install → init → commit → clone → `npm ci` → identical plans, distinct checkout, compiled viewer). It just needs wiring into CI.
- CLI names, ports, MCP invocation and the documented catalog limits (limit 10/50, maxBytes 4–64 KiB, ids ≤ 10, 10,000 fingerprints) in PORTABLE.md and CATALOG_DISCOVERY.md match the code.

## Suggested refactor plan for this slice
1. **Make the suite hermetic and typed.** Add `tests/setup.ts` via `--import` (git config isolation, `GROUNDWORK_HOME`/`GROUNDWORK_TMPDIR`) and `tsconfig.test.json` referenced from `tsconfig.json`. Fix the 10 type errors, and switch app/node configs to `strict: true` (0 errors today).
2. **Fix the agent contract shipped to consumers.** Use `third-party` in taxonomy.md, delete or regenerate `validate_output.py`, and document `jobs`/`sourceScans` plus the freshness and discovery ops. Add a test that validates the doc examples against the zod schemas. Narrow `files`.
3. **Resolve the data-provenance question.** Replace the `<org>` catalog fixture with a synthetic one, scrub `/Users/...` paths, and move the SYSTEM_KNOWLEDGE_* docs out of `docs/`. Delete or privatise `catalog-evaluation.ts`.
4. **Decouple tests from build output.** Inject `viewerDirectory` into `startViewer`, so `npm ci && npm test` passes on a fresh clone.
5. **CI hardening.** Add a Node 22.18/24 matrix, a `test:package` job running `npm pack` + `package-smoke.ts`, and a coverage job with branch thresholds.
6. **Packaging.** Move everything but `zod` to devDependencies, and give the bin shim a friendly "not built" message.
7. **Test structure.** Add a shared `tests/helpers.ts`, split files by module (scanner, knowledge, manifests, repository, http, setup), and break mega-tests into subtests. Add CLI argv unit tests and a first React component/hook test layer.
8. **Docs and DX.** Fix the CONTENT.md validate/Vite claims and the README fixture sentence, clarify rollback semantics in PORTABLE.md, and add a real `dev` script (Vite + API proxy + source-mode Hub).
