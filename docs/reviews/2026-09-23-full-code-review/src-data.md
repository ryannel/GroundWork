# Shared domain/data layer (src/data) and viewer runtime state

## Summary
The shared domain code is mostly pure, well-intentioned and carefully validated. zod is the single source of truth, types are inferred once (`spec.ts`/`model.ts` are type-only), `loadContent` validates the whole revision before exposing any of it, and cross-reference rules are thorough. The shared modules are DOM-free and React-free today: `tsc -p tsconfig.runtime.json --lib ES2023` shows no errors in `src/data`. `tsc -p tsconfig.app.json --strict` reports 0 errors, so the missing `strict` flag costs nothing to turn on. The biggest risks are:
- plain-object maps keyed by user IDs in `spec-index.ts`, which crash the feature page on valid content (verified);
- a project-list poll that is starved and piles up requests when `/api/projects` takes more than 3 s;
- a module-level mutable `q` that only stays correct because `app.tsx` remounts the whole route tree on every revision.

Other structural debt: validators are duplicated with different meanings across `content-schema`, `delivery` and `delivery-legacy`; `catalog-index` links entries by matching the text of relation labels, and knowledge baselines depend on that text; `loadContent` is a 165-line god function; there is no enforced boundary between shared-with-server code and browser-only code in the same directory.

## Findings

### [HIGH] Plain-object indexes crash the feature page for IDs such as `toString`, `valueOf` or `hasOwnProperty`
- **File**: src/data/spec-index.ts:43 (also :42, :91; ID rule in src/data/content-schema.ts:5)
- **Category**: correctness
- **Problem**: `buildIndex` stores every derived index in `{}`-backed `Record<string, …>` objects and uses `??=` / truthiness on lookups:
  `const push = (m: Record<string, string[]>, k: string, v: string) => { (m[k] ??= []); if (!m[k].includes(v)) m[k].push(v) }`
  `const eid = ix.contractEdge[cid]; if (eid) { te.add(eid); tn.add(ix.edge[eid].from) …`
  The ID regex only blocks `constructor|prototype|__proto__`, so `toString`, `valueOf`, `hasOwnProperty`, `isPrototypeOf`, `toLocaleString` and similar are valid IDs. For such a key, `m[k]` is the inherited `Object.prototype` function, so `??=` does not replace it and `.includes` throws. Verified end to end: in the f-2 fixture, renaming a contract ID to `hasOwnProperty` still passes `loadContent`, but `buildIndex` then throws `m[k].includes is not a function`. The index is built in the render of `pages/feature.tsx:44`, and the app has no error boundary, so the whole viewer unmounts.
- **Impact**: A valid plan white-screens every feature page. The same pattern also makes `ix.contractEdge['toString']` truthy, which leads to `ix.edge[fn].from` being read on undefined.
- **Recommendation**: Use `Map<string, …>` for `SpecIndex` (or `Object.create(null)` together with `Object.hasOwn` checks). Alternatively, tighten the ID rule to reject every `Object.prototype` member, but the Map is the real fix. Add a regression test that uses a reserved-looking ID. `noUncheckedIndexedAccess` flags line 91.

### [HIGH] The central project poll starves when a request takes over 3 s, and requests pile up on the server
- **File**: src/data/runtime.ts:64-76, :99-101
- **Category**: correctness / performance
- **Problem**: `refreshProjects` publishes only if it is still the latest request (`request === projectRequest`), and `setInterval(…, 3000)` starts a new request every 3 s whether or not the previous one has finished. On the server, `/api/projects` → `registry.inventory()` runs `discover` plus a full `readPlan` (git calls plus `loadContent`) for every registered project, one after another.
- **Impact**: Once one inventory takes longer than 3 s (many projects or worktrees, a cold disk), every response is superseded before it arrives. The project list freezes and errors never appear. Meanwhile the server runs an unbounded number of concurrent inventories, and each one slows the others, which feeds the problem. The existing test (`browser-runtime.test.ts:165-172`) asserts that the older poll is dropped, so it locks in this behaviour.
- **Recommendation**: Replace `setInterval` with a self-scheduling loop: `await refreshProjects(); setTimeout(next, 3000)` guarded by `generation`. Or skip a tick while a request is in flight. Add an `AbortController` so a superseded request is cancelled instead of ignored. Better still, push project changes over SSE, as is already done for plans.

### [MEDIUM] The CSP blocks the inline theme bootstrap that `theme.tsx` depends on
- **File**: index.html:11-18 with server/http.ts:41; src/lib/theme.tsx:54-73
- **Category**: correctness
- **Problem**: `ThemeProvider` applies `data-theme`/`data-skin` in `useEffect`, after the first paint. It relies on the inline `<script>` in `index.html` to set them before paint. The server sends `script-src 'self'` with no nonce or hash on every response, including `index.html`, so the built inline script (`dist/index.html`, one `<script>` block) is blocked. The same header (`style-src 'self'`, `font-src 'self'`) also blocks the Google Fonts `<link>`. The server/tooling reviewers should confirm that part.
- **Impact**: Users with an explicit light/dark or grain preference see a flash of the default theme on every load, and the console shows CSP violations. The inline script also sets `data-skin` without validating the value, unlike `theme.tsx`.
- **Recommendation**: Move the bootstrap into a same-origin file (`/theme-init.js`, loaded before the module script), or add its sha256 hash to `script-src`. Validate the skin value there the same way `theme.tsx` does. Optionally listen for `storage` events so the theme stays in sync across tabs.

### [MEDIUM] The module-level mutable `q`/`repository` bypasses `useSyncExternalStore` and forces the whole app to remount on every revision
- **File**: src/data/store.ts:9-11 (used directly in 15 component files, e.g. spec/flow.tsx:7, shell/top-bar.tsx:5)
- **Category**: architecture
- **Problem**: `export let q = repository.q` is reassigned by `attachSnapshot` from inside the SSE handler, before `publish`. Components read `q` during render without subscribing to it. This is safe only because `app.tsx` gives `<Routes key={token:revision}>` a new key on every revision, which remounts everything. Meanwhile `useHome`/`useWorkspace`/`useProduct` each build a second repository per snapshot, so there are two repositories with different lifetimes.
- **Impact**: Every save throws away all route-level UI state: tabs, disclosures, selections, scroll. Any future memoised use of `q` (a `useMemo` or `useEffect` without the snapshot in its deps), or a concurrent-rendering transition, will read a snapshot that does not match the render (tearing). The store is also hard to test, because the singleton is created at import time.
- **Recommendation**: Derive the repository once per snapshot inside the store: `const repo = useSyncExternalStore(subscribe, () => state.repository)`, built in `publish` when the plan changes. Expose it through a `useRepository()` hook or context, and remove the exported `let q` and `attachSnapshot`. Then drop the `Routes` key, or key it only on the checkout token.

### [MEDIUM] Page hooks do O(components × features × components) scope work on every snapshot
- **File**: src/data/store.ts:96-99 (useWorkspace), :121 (useProduct); src/data/component-structure.ts:15-23, :145-148
- **Category**: performance
- **Problem**: `load` calls `featureTouchesComponent(f, component.id, db.components)` for every top-level component × active feature. Each call recomputes `componentScopeIds`, which repeatedly scans all components until nothing changes. `useProduct` does the same for every product component × all features. `componentAncestors` (behind `q.componentLabel`, `systemGraph`, `componentTree`) also uses `components.find` at each level.
- **Impact**: Work is quadratic or worse in catalog size and reruns on every SSE revision. Scanned catalogs with hundreds of components are the realistic case.
- **Recommendation**: Build a `childrenByParent`/`byId` index once in `createRepository` and expose `q.scope(id)` and `q.ancestors(id)`, memoised per snapshot. Compute `scope` once per component, outside the feature loop, then use `features.filter(f => f.touches.some(id => scope.has(id)))`.

### [MEDIUM] zod validators are duplicated and drifting (ID, text, SHA, HTTP methods, kinds, timestamps)
- **File**: src/data/content-schema.ts:4-5, :37/:62, :111/:115/:139/:142/:149, :142 vs :149; src/data/delivery.ts:4-5; src/data/delivery-legacy.ts:3-16; src/data/knowledge.ts:53; src/data/scan-manifest.ts:2-3; src/data/execution-flow.ts:34
- **Category**: architecture / correctness
- **Problem**:
  - `id` is copied into `delivery.ts` and `delivery-legacy.ts`.
  - `text` means two different things. Content uses `z.string().min(1).regex(/\S/)`, which keeps whitespace. Delivery uses `z.string().trim().min(1)`, which rewrites the value. Verified: `'  padded  '` is stored as `'padded'` in delivery but kept as-is in content.
  - The 40-hex SHA regex appears 5 times.
  - The HTTP method enum appears twice, plus `methodOrder` and the list in `contractKind` in api-reference.ts.
  - The observation-kind enum `['endpoint','schema','data','message','job','flow']` appears twice, and it overlaps `catalogKinds`.
  - Timestamps are inconsistent. Most accept offsets (`{ offset: true }`), but `retiredAt`, knowledge `capturedAt`/`checkedAt` and scan-manifest times reject them. Verified: `retiredAt: '…+02:00'` fails.
  - The repository-relative path rule exists twice (scan-manifest `relative` and `executionFlowIssues`).
  - `delivery-legacy.ts` repeats the whole delivery schema with renamed keys.
- **Impact**: Rules drift silently, and hand-edited files behave differently depending on the document type.
- **Recommendation**: Create a `schema-primitives.ts` with `id`, `text`, `sha1`, `isoTimestamp`, `repoRelativePath`, `httpMethodSchema` and `observationKindSchema`, and import it everywhere. Derive the legacy schema from `unit`/`validation` builders that take key names, or run it as a key-rename pre-pass before `deliverySchema`. Decide once whether strings are trimmed.

### [MEDIUM] `catalog-index` links entries by matching relation text, creates duplicate links, and knowledge baselines depend on that text
- **File**: src/data/catalog-index.ts:46; src/data/knowledge.ts:68-69; server/knowledge.ts:27
- **Category**: architecture / correctness
- **Problem**: Reverse links are chosen by testing the human-readable label: `relation.reason.startsWith('Investigated subject') || … || relation.reason.endsWith('contract')`. Relations are never deduplicated. Verified: a flow whose two steps reference the same record gives that record `["Owned by component","Referenced by flow: F","Referenced by flow: F"]`. `baselineAssessments` then compares `JSON.stringify(current.related)` and `JSON.stringify(raw)` against stored baselines. The component projection it uses (`const { api, data, messaging, executionFlows, findings, ...rest }`) is copied by hand in `server/knowledge.ts:27`.
- **Impact**: Rewording a label, reordering relation collection or fixing the duplicates marks every stored knowledge baseline as "changed". If the two projection copies diverge, every baseline reports false changes. JSON comparison also depends on key order.
- **Recommendation**: Give each relation a typed `kind` and a `reverse: boolean` (or an explicit `reverseReason`), and deduplicate by `id+kind`. Move the component projection into one exported function (`componentObservation(component)`) that both sides use. Compare with a canonical, order-independent serialisation, or with a stored digest.

### [MEDIUM] `loadContent` is a 165-line god function that throws away its inferred types
- **File**: src/data/content.ts:18-183
- **Category**: readability / architecture
- **Problem**: A single function does all of the following:
  - maps filenames to kinds;
  - dispatches schemas (`documentSchemas[kind] as z.ZodType`, `result.data as { id: string }`, `parsed: Record<string, unknown[]>`, `parsed.member as Member[]`);
  - checks duplicates and IDs;
  - checks workspace, product and component integrity, including cycles;
  - checks all feature-spec cross-references through nested closures (`has`, `unique`, `componentRef`, `refs`, `fields`).
  
  Lookups inside it are linear (`records.some`, `sections[kind].some`, `sections.edges.find`, `sections.api.find`). Many lines exceed 200 characters.
- **Impact**: The file is hard to review and extend. Casts hide type errors (a new document kind would need four coordinated edits), and there is no seam for unit-testing individual rules.
- **Recommendation**: Split it into `parseDocuments(documents) → typed buckets` (a typed dispatch table rather than casts), `validateStructure(snapshot)`, `validateFeatureSpec(feature, ctx)` and `validateComponent(component, ctx)`. Each returns `issues[]`, and each gets `Map`s built once. `validateDelivery` could then follow the same pattern: it currently throws on the first error, while `loadContent` collects all of them.

### [MEDIUM] The boundary between server-shared and browser-only code is implicit, and zod ships to the browser
- **File**: src/data/* (server imports listed in the brief); src/data/runtime.ts:40; src/data/content.ts:1-2; src/data/delivery.ts:1
- **Category**: architecture
- **Problem**: `src/data` mixes three layers:
  - pure domain code imported by `server/` (content-schema, content, delivery, knowledge, catalog-*, scan-manifest);
  - view-model helpers (spec-index, api-reference, schema-diff, workspace-view, catalog-navigation);
  - browser state (`runtime.ts` reads `window.location` at import; `store.ts` uses React).
  
  Nothing enforces the split. `tsconfig.runtime.json` has no `lib`, so DOM types are in scope, and there is no lint import rule. Imports are also inconsistent: `.ts` in shared modules, extensionless in `spec-index.ts`, `schema-diff.ts`, `workspace-view.ts`, `runtime.ts` and `store.ts`. Because `createRepository` lives in the same file as `loadContent` (which imports `documentSchemas`), and `delivery.ts` combines schemas with pure `deliveryGaps`, zod and all content schemas end up in the browser bundle. `dist/assets/badge-*.js` contains `Use a URL-safe stable ID`. The browser never runs them: it trusts the server.
- **Impact**: One wrong import (for example, a shared module importing `runtime.ts`) crashes the Node CLI at import time, and there is no bundle-size discipline.
- **Recommendation**: Move the shared code to `shared/domain/` (or `src/domain/`) with its own tsconfig (`lib: ["ES2023"]`, `strict`, no DOM, no `@/` alias) that `tsconfig.runtime.json` and `tsconfig.app.json` reference. Add an oxlint `no-restricted-imports` rule that stops domain code importing react, `@/` or `src/data/runtime`. Split `repository.ts` (createRepository) from `content-load.ts` (loadContent), and `delivery-rules.ts` from `delivery-schema.ts`, so the browser does not pull in zod. Always use `.ts` extensions.

### [MEDIUM] The app tsconfig is not `strict`, even though enabling it costs nothing
- **File**: tsconfig.app.json (also tsconfig.node.json)
- **Category**: best-practice
- **Problem**: Only `strictNullChecks` is on. `npx tsc -p tsconfig.app.json --noEmit --strict` gives 0 errors today, so the gap is purely preventive. Adding `--noUncheckedIndexedAccess` gives 98 errors, 20 of them in `src/data`. Among them is the crash site at spec-index.ts:91 (`ix.edge[eid].from`), along with api-reference.ts:13/22/57, content.ts:36-44 and execution-flow.ts:36. Remaining `any` leaks include `session` in runtime.ts:88 (`response.json()`) and `projects` in runtime.ts:72 (an `any[]` from `Array.isArray`, assigned unchecked to `Checkout[]`).
- **Impact**: Future implicit `any`, unsafe `this` or bivariant callbacks will compile silently in the viewer while the server config (strict) would reject them. Shared files are type-checked under two different rule sets.
- **Recommendation**: Set `"strict": true` in tsconfig.app.json and tsconfig.node.json now. Adopt `noUncheckedIndexedAccess` for the domain package first (20 sites), then the rest of the app.

### [MEDIUM] Tests miss the riskiest pure logic, and the runtime singleton blocks test isolation
- **File**: tests/browser-runtime.test.ts:64-66, :121-126; tests/navigation.test.ts; (no tests for) src/data/spec-index.ts, catalog-index.ts, knowledge.ts, scan-manifest.ts, store.ts
- **Category**: testing
- **Problem**:
  - `buildIndex` (backlinks, `untested*`, `testNodes`/`testEdges`) and `refLabel` are only used as a pass-through to `lensFor`. The two spec-index bugs in this report would have been caught by basic tests.
  - `catalogIndex` relations and dedupe, and `baselineAssessments` (unchanged, changed, removed), are covered at most indirectly.
  - The store hooks (`load`, `reaching`, `incoming`, `isCold`) have no tests.
  - In `browser-runtime.test.ts`, re-importing `runtime.ts` returns the cached module, so redefining `window` before the second and third imports does nothing. The `/p/:id/ref/:ref` route parsing cannot be tested, and subtests share mutable singleton state, so they depend on execution order.
  - `navigation.test.ts` repeats reference checks that `loadContent` already performs on the same fixture.
- **Impact**: The derivation logic the UI depends on has little protection against regressions.
- **Recommendation**: Add table-driven tests for `buildIndex`/`refLabel` (including IDs that are numeric or look like prototype members), for `catalogIndex` (reverse links, no duplicates) and for `baselineAssessments`. Turn the runtime into `createRuntime({ location, fetch, EventSource })` with a default instance, so each test builds a fresh one. Extract the hooks' `useMemo` bodies into pure `workspaceView(repo, slug)` functions and test those.

### [LOW] `refLabel` step numbering is wrong for numeric step IDs
- **File**: src/data/spec-index.ts:115
- **Category**: correctness
- **Problem**: `Object.keys(ix.step).indexOf(r.id) + 1` depends on object key order, and JS lists integer-like keys first. Verified: steps `['s-a','2','10']` are labelled `Step 3, Step 1, Step 2`. The lookup is also O(n) per chip.
- **Impact**: Chips and tooltips show the wrong step number when IDs are numeric. The ID regex allows this.
- **Recommendation**: Store `stepOrder: Map<string, number>` in the index, built from the `steps` array.

### [LOW] Rough edges in the runtime store (URI decode at import, re-subscribing, closed-stream message, hand-written guard)
- **File**: src/data/runtime.ts:43, :47-60, :61, :117-119
- **Category**: best-practice / correctness
- **Problem**:
  - (1) `decodeURIComponent(route[2])` runs at import time, so a malformed URL like `/p/x/ref/%E0` throws `URIError` before React mounts and leaves a blank page (verified: decoding `%E0` throws).
  - (2) `useSyncExternalStore(callback => …)` passes a new `subscribe` function on every call, so React unsubscribes and resubscribes on every render.
  - (3) `onerror` always says "reconnecting…", but when the stream is `CLOSED` (for example, a 403 from the host check) the browser never reconnects.
  - (4) `isRuntimeEvent` is 13 lines of hand-written narrowing that checks a few fields and trusts the rest as a `ContentSnapshot`, while `Checkout[]` and `/api/session` are not checked at all.
  
  SSE lifecycle itself is otherwise sound. The server always sends a snapshot on connect, so without `onopen` the UI still recovers on the next message. The "3 s polling leak on route change" does not happen, because project cards use a full-page `<a href>` and `checkoutId` is fixed at module load.
- **Impact**: Minor crashes, wasted work and misleading status messages.
- **Recommendation**:
  - (1) Wrap the decode in try/catch and fall back to undefined, or report an error state.
  - (2) Hoist `const subscribe = (cb) => {…}` to module scope.
  - (3) In `onerror`, check `events.readyState === EventSource.CLOSED` and then show a message that asks for a reload, or reconnect with backoff.
  - (4) Define a wire-protocol schema (`runtimeEventSchema`, `checkoutSchema`) next to the server response types and share it. Or explicitly trust the same-origin server and keep only a minimal guard, but treat all endpoints the same way.

### [LOW] Delivery helpers: `never` does not narrow, and `deliveryGaps` can take exponential time
- **File**: src/data/delivery.ts:34-53, :133-146
- **Category**: readability / performance
- **Problem**: `const fail = (message: string): never => …` does not narrow on its own (TS requires a declared function or an annotated const), so the code needs `feature!` (4 times) and `unit!`. `deliveryGaps` recurses into every dependency's full `deliveryGaps` and every child task's, without memoisation. Plans shaped like diamonds grow exponentially with depth, and `validationResult` is computed twice per check (:133, :135). If an unvalidated cyclic plan ever reaches it, the recursion never ends.
- **Impact**: Non-null assertions are noisy, and there is a latent performance and termination risk.
- **Recommendation**: Declare `function fail(message: string): never`. Memoise `deliveryGaps` per unit ID within one call (pass a `Map` as cache, which also acts as a cycle guard) and compute `validationResult` once.

### [LOW] Label maps are not exhaustive by type, and `parseCatalogId` leaks a raw `URIError`
- **File**: src/data/component-structure.ts:3-8; src/data/catalog-identity.ts:10; src/data/catalog-coverage.ts:3
- **Category**: best-practice
- **Problem**: `componentKinds` is an untyped object literal, and `componentKindLabel` indexes it with the schema's kind union. `CoverageState` copies `componentScanAreaSchema` by hand. `parseCatalogId('a/b/component/%E0')` throws `URIError: URI malformed` instead of its own 'Invalid catalog ID' (verified). CLI and MCP callers get an inconsistent error.
- **Impact**: A new kind can silently return an `undefined` label in the loosely-typed app build, and user-facing errors are inconsistent.
- **Recommendation**: Use `export const componentKinds = {…} satisfies Record<ComponentKind, string>`, as `taxonomy.ts` does for product kinds, and `type CoverageState = z.infer<typeof componentScanAreaSchema>`. Wrap the decode in `parseCatalogId` and rethrow the domain error.

## Positive notes
- There is one zod source of truth. `spec.ts`/`model.ts` infer types with `import type` only, and `scripts/content.ts` generates JSON Schemas from the same `documentSchemas`, so schema and types cannot drift.
- `loadContent` validates the whole revision before exposing any of it. Error messages carry file and JSON path, and the semantic checks are unusually thorough: containment cycles, workspace isolation, boundaries between action edges and contracts, and URL/protocol and traversal safety for mockups and evidence paths.
- Shared domain modules really are DOM-free and React-free today: runtime tsc with `--lib ES2023` reports no `src/data` errors. `createRepository` is a small pure factory.
- The runtime's generation and request counters handle stale startups and stale responses correctly, and `browser-runtime.test.ts` exercises those races explicitly.
- `taxonomy.ts` uses `Record<z.infer<…>, …>`, so product kinds and stages are exhaustive at compile time. `theme.tsx` wraps every `localStorage` access in try/catch.

## Suggested refactor plan for this slice
1. Replace the plain-object indexes in `spec-index.ts` with `Map`s, add `stepOrder`, and add `buildIndex`/`refLabel` tests with IDs that look like prototype members or numbers (fixes both spec-index findings).
2. Replace the 3 s `setInterval` project poll with a self-scheduling or in-flight-guarded loop that uses `AbortController`. Move the theme bootstrap out of the inline script, or hash it into the CSP.
3. Turn on `strict` in tsconfig.app.json and tsconfig.node.json now (0 errors), then add `noUncheckedIndexedAccess` to the domain code.
4. Replace the module-level `q` with a snapshot-derived repository exposed through `useSyncExternalStore` or context, drop the remount-on-every-revision `Routes` key, and add pre-computed scope and ancestor indexes to the repository.
5. Extract `schema-primitives.ts` (id, text, sha, timestamp, relative path, HTTP method, observation kind) and derive the legacy delivery schema from it. Decide the trim semantics once.
6. Give catalog relations a typed `kind` and a `reverse` flag, deduplicate them, and share one `componentObservation()` projection between `src/data/knowledge.ts` and `server/knowledge.ts`.
7. Move the shared domain into `shared/domain/` (or `src/domain/`) with its own no-DOM strict tsconfig and an import-restriction lint rule. Split `createRepository` and the delivery rules out of the zod-heavy modules so the browser bundle drops zod.
8. Split `loadContent` into per-concern validators that each return `issues[]`, and give `validateDelivery` the same collect-all behaviour.
