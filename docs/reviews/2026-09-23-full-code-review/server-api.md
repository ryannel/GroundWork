# Server operations, HTTP/MCP surface, catalog query and freshness

## Summary
This slice is careful about security in the places people usually get wrong. The HTTP server checks the Host header, so DNS rebinding is blocked. It checks Origin, requires a bearer token plus a JSON content type for mutations, whitelists asset paths with a strict regex, walks paths symlink by symlink in `safePath`, and uses `--end-of-options` for ref resolution. Catalog responses carry explicit uncertainty and byte budgets. The biggest risks are three bugs, each reproduced with a scratch script:
- POST bodies are decoded one chunk at a time, so non-ASCII text that falls on a chunk boundary is silently corrupted and persisted.
- An SSE client that disconnects early leaks two intervals and a recursive file watcher for good. They keep polling git and survive `app.close()`.
- `catalogIndex` reverses its own reverse links, which invents relations such as "endpoint Referenced by schema". The module comment forbids exactly this.

On structure, operation metadata is spread across four places. `operate()` contains domain mutation logic. Error classes do not map consistently onto HTTP status codes. The same repository-identity normaliser exists three times with different rules. Lines are very dense (400–700 chars), which hurts readability everywhere in the slice.

## Findings

### [HIGH] POST body decoded chunk-by-chunk: multi-byte UTF-8 split across chunks is corrupted and persisted
- **File**: server/http.ts:77-78
- **Category**: correctness
- **Problem**: `let body = ''` / `for await (const chunk of req) { body += chunk; if (Buffer.byteLength(body) > 4 * 1024 * 1024) ... }`. `body += chunk` calls `chunk.toString()` on each Buffer separately. If a multi-byte character is split between two chunks, both halves become U+FFFD. Reproduced: I sent a `write_plan` body in two TCP writes split inside "日". The server returned 200 and stored the member name as `Zoë ���本`. Also, `Buffer.byteLength(body)` re-encodes the whole growing string on every chunk, which is O(n²) up to 4 MB.
- **Impact**: Plan documents are corrupted silently. The write is accepted because the result is still valid JSON. Any body over one socket read (~64 KB) that contains non-ASCII text is at risk: briefs, names, CJK or emoji content.
- **Recommendation**: Collect Buffers and decode once. Check `Content-Length` before reading.
  ```ts
  const chunks: Buffer[] = []; let size = 0
  for await (const chunk of req as AsyncIterable<Buffer>) { size += chunk.length; if (size > MAX_BODY) return json({ error: 'Request exceeds 4 MB' }, 413); chunks.push(chunk) }
  const body = new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks))
  ```
  Add a test that sends a split multi-byte body.

### [HIGH] SSE handler leaks timers and a recursive watcher when the client disconnects before `selectRoot` resolves
- **File**: server/http.ts:65-71
- **Category**: best-practice (resource leak)
- **Problem**: `setInterval` (l.66-67) starts before `await selectRoot(...)` (l.68), and the watcher is created after that await. `res.on('close', ...)` is registered only at l.71. If the socket closes during the await, the `close` event fires before a listener exists, so cleanup never runs. Reproduced with 5 clients that disconnect immediately: afterwards the process held `Timeout: 10` and `FSEventWrap: 250` (a recursive watch of `.groundwork`, ~50 inotify handles per client). After `app.close()` they were still there. With a normal disconnect (clients that waited for the first event) nothing leaked.
- **Impact**: Each leaked client runs a full `readPlan` plus several git subprocesses every 1.5 s, forever. Browsers produce these early disconnects routinely on reload and on EventSource reconnect. Over time CPU, file descriptors and inotify watches are exhausted, and `close()` does not stop the process from being kept alive.
- **Recommendation**: Register the close handler first, synchronously, and check `closed` after every await:
  ```ts
  const cleanup = () => { closed = true; clearInterval(timer); clearInterval(heartbeat); watcher?.close(); clients.delete(res) }
  res.on('close', cleanup)
  ...; const root = await selectRoot(...).catch(() => null); if (closed) return
  ```
  Also have `close()` call `cleanup` for every client, not just `client.end()`. Add a regression test that aborts `/api/events` immediately and asserts `process.getActiveResourcesInfo()` returns to its baseline.

### [HIGH] `catalogIndex` re-reverses its own reverse links and invents relations
- **File**: src/data/catalog-index.ts:44-47
- **Category**: correctness
- **Problem**: The reverse pass iterates over `entries` while pushing new `Referenced by <kind>: <name>` relations onto entries that have not been visited yet. When the loop reaches such an entry, the injected relation matches `relation.reason.startsWith('Referenced by')`, so it is reversed a second time. Reproduced with one endpoint whose `response` is `User`:
  `p/api/endpoint/get-user [..., {"id":"p/api/schema/user","reason":"response contract"}, {"id":"p/api/schema/user","reason":"Referenced by schema: User"}]`
  The schema never references the endpoint. Whether this happens depends on insertion order. It also happens for finding→flow subjects (findings are indexed before flows) and for step `dependencyIds` that point to components indexed later. Relation semantics are inferred from human-readable reason strings (`startsWith('Investigated subject')`, `endsWith('contract')`, and `reason === 'Recorded execution path'` at server/catalog.ts:30).
- **Impact**: `get_discovery_context` and `get_catalog_entity` report relationships that do not exist, which breaks the rule stated at l.43: "Reverse only explicit links… never asserted relationships". The duplicates also use up the 5-relation summary budget (catalog.ts:64). They are frozen into retained baselines too (knowledge.ts:29). A fix will therefore make existing baselines compare as `changed` at src/data/knowledge.ts:23, so plan a migration note.
- **Recommendation**: Give relations a typed field, e.g. `{ id, reason, type: 'owner' | 'contract' | 'trace' | 'trigger' | 'step-ref' | 'subject' | 'reverse' | 'dependency' }`. Compute reverse links from a snapshot of forward relations only (`const forward = entries.flatMap(e => e.related.filter(isReversible).map(r => [e, r]))`, then push). Test with one endpoint and one schema, and assert there are no `Referenced by schema` relations on the endpoint.

### [MEDIUM] Error-to-status mapping is inconsistent: stale edits get 400 or 409 depending on the operation, and server faults are reported as 400
- **File**: server/http.ts:106; server/operations.ts:114; server/knowledge.ts:19,56
- **Category**: correctness / best-practice
- **Problem**: `json({ error: message(error) }, error instanceof Conflict ? 409 : 400)`. `writePlan` throws `Conflict` for stale edits (repository.ts:145), but `operate()` pre-checks with `throw new Error('Stale edit: re-read the plan before changing it')`, and so do `retainDiscoveryBaseline` and `assessFeatureDiscovery`. Verified: a stale `write_plan` returns 409, while a stale `record_progress` returns 400. A missing asset (`readFile` ENOENT), an unknown `checkoutId`, and internal git or filesystem failures (EACCES, git crash) all return 400 as well.
- **Impact**: Clients cannot rely on status codes to choose between "re-read and retry" and "fix your input". Real server faults look like client errors, so they are harder to monitor and debug.
- **Recommendation**: Throw `Conflict` for every stale-revision check. Better still, remove the duplicate pre-checks and let `writePlan` own them. Introduce `NotFound` and `InvalidInput` error classes, or map `ZodError` and `SyntaxError` to 400, NotFound/ENOENT to 404, Conflict to 409, and everything else to 500 with a generic message. Keep this mapping in one `statusFor(error)` function.

### [MEDIUM] Operation metadata spread across four places; MCP annotations are wrong for some tools
- **File**: server/operations.ts:29-83,84-162; server/mcp.ts:16-20
- **Category**: architecture / correctness
- **Problem**: Adding an operation means editing `operationSchemas`, `descriptions`, the hard-coded `readOnlyHint`/`destructiveHint` name lists in mcp.ts, and an `if` branch in `operate()`. Only `descriptions` is type-checked for completeness. The lists are already wrong. `discard_repository_scan` deletes a scan and `plan_delivery` overwrites `delivery.json` wholesale, yet both are explicitly marked `destructiveHint: false`. In MCP the default is `true`, so these tools were actively downgraded. `prepare_repository_scan` is marked `readOnlyHint: true` even though it clones and writes scan state. No tool sets `idempotentHint`.
- **Impact**: MCP clients use these hints to decide whether to ask the user before running a tool, so wrong hints skip confirmation for destructive operations. The scattered metadata makes future drift likely.
- **Recommendation**: Use one typed registry: `const operations = { write_plan: { schema, description, annotations: { readOnly: false, destructive: true }, run: (root, args) => ... }, ... } satisfies Record<string, OperationDef>`. `operate()`, `tools/list` and the HTTP whitelist then all derive from it, and the `if` chain disappears.

### [MEDIUM] `operate()` contains domain mutation logic, validates partly by hand, and parses input twice
- **File**: server/operations.ts:110-161
- **Category**: architecture / readability
- **Problem**: The create_feature, plan_delivery, record_progress and link_branch mutations are written inline (JSON.parse of stored files, structuredClone of delivery, status assignment). Rules that belong in the schema are imperative checks, some of which run after mutation has started: `if (args.status && !args.unitId)`, `if (!unit || !args.status)`, `if (!args.stage && !args.unitId && !args.evidence)` (l.142-149). `plan_delivery` does `JSON.parse(plan.files[file])` without `featureSchema.parse`, but `link_branch` does parse it. Each read branch repeats `const { checkoutId: _checkoutId, ref, ...input } = args` 9 times. Downstream modules (`queryCatalog`, `retainDiscoveryBaseline`, `compareCatalogSources`, ...) parse again with their own schema, so every call is zod-validated twice.
- **Impact**: The HTTP/MCP adapter and the delivery domain are tightly coupled. The business rules cannot be unit-tested without git and a filesystem. Input rules are only discoverable by reading code, and the generated JSON schema does not express them.
- **Recommendation**: Move the mutations into pure functions in a domain module, e.g. `server/delivery-operations.ts`, with signatures like `recordProgress(plan, args) => changes`. `operate()` then only selects the root, calls the function and runs `writePlan`. Express the cross-field rules with `.superRefine` on the schema. Separate selection args (`checkoutId`/`ref`) from payload once, generically, before dispatch.

### [MEDIUM] Search tokenizer's ad hoc stemming breaks common plurals and exposes truncated words
- **File**: server/catalog.ts:19
- **Category**: correctness
- **Problem**: `term.length > 4 && term.endsWith('s') ? term.slice(0, -1) : term`, plus special cases for `consum*`/`publish*`. Measured output: `apis→apis` vs `api`, `jobs→jobs` vs `job`, `statuses→statuse` vs `status→statu`, `queries→querie` vs `query`, `address→addres`. `HTTPServer` is not split, because the camel-case regex only splits lower→Upper. The mangled stems are shown to users as `Text match: statu` (l.77).
- **Impact**: This is an agent-facing discovery tool. Queries like "which jobs…" or "what APIs…" miss exact matches, and the response then says "Missing matches do not prove absence". Recall depends on word length rather than meaning.
- **Recommendation**: Replace it with a small, documented normaliser: split acronym boundaries (`/([A-Z]+)([A-Z][a-z])/`), handle `ies→y`, `ses/xes→s/x`, and a plain `s` for length ≥ 3, and report the original query term in `reasons`. Pull the normaliser into a tested pure function with table-driven cases, since the tokenizer currently has no direct tests.

### [MEDIUM] Repository identity normalisation is implemented three times with different rules
- **File**: server/catalog-freshness.ts:14-17,44,47; server/scanner.ts:183-190; src/data/execution-flow.ts:54
- **Category**: architecture / correctness
- **Problem**: There are three regexes. Measured: `github.com/acme/web` becomes `acme/web` in scanner `normalizeRepository` but stays `github.com/acme/web` in `sourceIdentity`. `https://github.com/Acme/Web.git` becomes `Acme/Web` in the scanner (case kept) and `acme/web` in freshness (lowercased). `https://github.com/acme/web/` gives no evidence URL in `sourceEvidenceUrl` because its regex does not accept the trailing slash. Inside catalog-freshness.ts, `normalize` is defined at l.44 and then written out again inline at l.47.
- **Impact**: A component whose `repo` is written as `github.com/org/repo` never matches its own origin (`git@github.com:org/repo.git`) in `check_catalog_freshness`, so the result is permanently `unknown`. Source links silently disappear for URLs with a trailing slash. Future fixes will have to be made in three places.
- **Recommendation**: Create one `src/data/repository-identity.ts` exporting `parseGitHubRepository(value) → { owner, name } | null` and `repositoryIdentity(value)`, which is case-insensitive for GitHub. Put the async `realpath` wrapper in a single server helper and use it in scanner, freshness and `sourceEvidenceUrl`. Add table tests for the URL forms.

### [MEDIUM] Each SSE client runs its own polling loop and recursive watcher
- **File**: server/http.ts:55-73, 23-36
- **Category**: performance
- **Problem**: Every `/api/events` connection gets its own 1.5 s `setInterval` running `snapshot()`, which is `readPlan` plus `activity()`. Each `context()` call alone spawns 3 git processes. Each connection also gets its own `fs.watch(..., { recursive: true })`, and ref views are re-read every 1.5 s even when the ref is a fixed SHA. The `lastValid` map (l.22) is keyed by client-supplied `checkoutId:ref` strings and is never pruned.
- **Impact**: N tabs means N times the git and filesystem load, even when they all watch the same checkout. On Linux, recursive watch creates one inotify watch per directory for every client.
- **Recommendation**: Keep one shared "channel" per `checkoutId:ref` key, holding one poller, one watcher, the last payload hash and a subscriber set. Start it on the first subscriber and dispose it on the last. For ref views, resolve the ref once and stop polling when it is an immutable SHA. Bound or prune `lastValid`.

### [MEDIUM] Freshness reuse in `assessFeatureDiscovery` builds fake `Entity` objects; component child-exclusion list duplicated
- **File**: server/knowledge.ts:27,61,71-72; src/data/knowledge.ts:22
- **Category**: architecture
- **Problem**: To reuse `compareCatalogSources`, knowledge.ts builds a fake entity: `const component = { id: identity.component, productId: 'retained', name: observation.name, order: 0, ... }`. `compareCatalogSources` therefore depends on the full `Entity`/`Component` shape when it only needs `{ id, repo, sourceRevision, raw }`. Separately, the "exclude child inventory" destructuring (`api, data, messaging, executionFlows, findings`) is written in both knowledge.ts:27 and src/data/knowledge.ts:22. Both omit `jobs`, even though jobs are a catalog child kind (catalog-index.ts:26). The `await import('./catalog-freshness.ts')` at l.61 is presented as a way around an import cycle, but no cycle exists. server/knowledge.ts is imported only by operations.ts, and catalog-freshness imports only catalog/git/repository. knowledge.ts already imports `./catalog.ts` statically.
- **Impact**: If either exclusion list changes without the other, every retained baseline compares as `changed`. Placeholder values such as `'retained'` and `0` can leak into results. The dynamic import hides the real dependency graph from readers and tools.
- **Recommendation**: Define a narrow `SourceObservation` type (`{ id, repository, sourceRevision, raw }`) and have `compareCatalogSources` take `SourceObservation[]`. Adapt from `Entity` in one place. Export a single `componentObservation(component)` from src/data/knowledge.ts, include `jobs` in its exclusions, and use it in both places. Replace the dynamic import with a static one.

### [LOW] MCP JSON-RPC handling drops malformed requests silently
- **File**: server/mcp.ts:9-12,25,28
- **Category**: correctness
- **Problem**: `request.id` is read without checking that the parsed value is an object. For the line `null`, a TypeError is caught at l.28 and printed to stderr, and no response is sent. A batch array has `id === undefined`, so it is treated as a notification and dropped. Verified: `null` produced only `TypeError: Cannot read properties of null` on stderr, and the batch produced no output. `(error as Error).message` is `undefined` when a non-Error is thrown. The server version `'0.4.12'` is hard-coded, duplicating package.json.
- **Impact**: Clients that send malformed input hang waiting for a reply instead of getting `-32600 Invalid Request`. Version drift will happen on the next release.
- **Recommendation**: Validate the envelope with a small zod schema and reply `-32600` with `id: null` for non-objects and batches (or support batches). Use `message(error)` as http.ts does. Read the version from package.json.

### [LOW] `queryCatalog` summarises every candidate on every page and discriminates operations by property presence
- **File**: server/catalog.ts:107,114-127,142
- **Category**: performance / readability
- **Problem**: `items = results.map(result => ({ ...summary(plan, result.entry), ... }))` builds summaries (URL params, pointers, gaps) for all ranked results, and then the loop at l.142 slices 10 of them. The whole index is rebuilt and re-ranked for each cursor page. Operations are told apart with `'id' in args` and `'seeds' in args` even though `operation` is available. The cursor query hash covers `limit` and `maxBytes`, so a client that gets "Catalog item exceeds maxBytes" cannot raise the limit and continue paging. It has to start over, which is not documented.
- **Impact**: Wasted CPU on large catalogs, and branching logic that is easy to break.
- **Recommendation**: Rank and dedupe by entry, slice the page window first, then call `summary()` on the page only. Branch on `operation` using a discriminated union. Either exclude `limit`/`maxBytes` from the cursor binding or document that they are part of it.

### [LOW] Asset route bypasses the hardened git wrapper
- **File**: server/http.ts:13-15,90-92
- **Category**: security / consistency
- **Problem**: `exec('git', ['-C', root, 'ls-tree', ...])` and `exec('git', ['-C', root, 'show', ...])` call git directly. That skips `gitRaw`'s `-c core.fsmonitor=false -c core.hooksPath=/dev/null` and `GIT_OPTIONAL_LOCKS=0` / `GIT_TERMINAL_PROMPT=0` (git.ts:7). It exists only because `gitRaw` cannot return a Buffer. The path is safe, since `assetPattern` allows only `[A-Za-z0-9_-]` segments and the ref goes through `resolveRef --end-of-options`. A missing asset, however, returns 400 "Unsupported asset mode" or ENOENT→400 instead of 404.
- **Impact**: Security hardening is inconsistent. Any future change to the wrapper will not reach this route.
- **Recommendation**: Add `gitBuffer(root, args, { maxBuffer })` to git.ts that shares the hardening flags and environment, and use it here. Return 404 when `ls-tree` is empty or the file is missing.

### [LOW] Bearer token compared with `!==` and served to any local GET; its threat model is not documented
- **File**: server/http.ts:19,52,75
- **Category**: security
- **Problem**: `req.headers.authorization !== \`Bearer ${token}\`` is not constant-time. `/api/session` hands the token to any request that passes the Host/Origin check, and the bundled viewer (src/data/runtime.ts) never makes POST requests. The token therefore protects only against cross-origin browsers, which the Origin and JSON content-type checks already stop. It does nothing against other local processes.
- **Impact**: Low risk on loopback. The real risk is that maintainers assume the token is an authentication boundary against local processes, which it is not.
- **Recommendation**: Compare with `crypto.timingSafeEqual` on equal-length Buffers. Add a comment at `/api/session` stating the threat model (a CSRF token for browsers, not local authentication). Consider requiring `Origin` to be present and same-origin on POST as defence in depth.

### [LOW] Status severity ordering encoded three times; very long expression lines
- **File**: server/catalog-freshness.ts:123,131,141; server/knowledge.ts:47,76-77; server/catalog.ts:28
- **Category**: readability
- **Problem**: The status precedence `unknown > review-required > impact-unknown > unchanged` is written as nested ternaries at l.123 and again at l.141. knowledge.ts:76 has its own `severity` table with a different order (`unknown: 3, 'review-required': 4`), so the per-check aggregate and the per-observation aggregate disagree. knowledge.ts:47 is a single ~700-char `return` that builds a nested object. catalog.ts:28 is a ~400-char `unshift` with sentinel values (`revision: ''`, `lines: ''`).
- **Impact**: The two orderings disagree, so an aggregate status can differ depending on which path computed it. The code is very hard to review.
- **Recommendation**: Export one `freshnessSeverity` map and a `worstStatus(statuses)` helper from catalog-freshness and use it in all three places. Break the l.47 return into named `const lastSourceAssessment = ...` pieces.

### [LOW] Test gaps for this slice's riskiest behaviour
- **File**: tests/runtime.test.ts:125-143,161-192; tests/adapters.test.ts:26-40; tests/catalog-query.test.ts
- **Category**: testing
- **Problem**: HTTP tests cover 401, 403, 409, Host rejection and two asset rejections. They do not cover: chunked or non-ASCII POST bodies, 413, early SSE disconnect cleanup, a successful asset response (working tree and `ref`), static-file traversal (`/%2e%2e/`, `//`), or 400-vs-409 for non-`write_plan` stale edits. MCP tests cover the happy path only (no notifications, malformed lines, or unknown tool). The catalog tests assert that a `request contract` relation exists but never assert that bogus relations are absent. The tokenizer has no direct tests.
- **Impact**: Each of the three HIGH findings would have been caught by a small targeted test.
- **Recommendation**: Add the regression tests listed under each finding above. They are cheap: `serve({ port: 0 })` plus raw `http.request` writes.

## Positive notes
- The local HTTP hardening is well thought out: Host allow-list (DNS rebinding), Origin check, `application/json` requirement (forces CORS preflight), strict CSP, `nosniff`, `no-store`, `no-referrer`, and a listener bound to 127.0.0.1 only.
- Path safety is thorough. `assetPattern` accepts raster files only (no SVG). `safePath` rejects `..`, empty and `.` segments and symlinks per component. `resolveRef` uses `--end-of-options` with `^{commit}`, and freshness diffs use `--no-ext-diff --no-textconv`.
- The catalog query envelope is honest and bounded: byte-budgeted pages, cursors bound to the snapshot and query, lossless JSON-pointer detail slicing, and explicit `sourceTrust`/`uncertainty` fields.
- `compareCatalogSources` fails closed. Missing history, repository mismatch or an unavailable target produces `unknown` with a next-inspection hint rather than a false "current".
- Operation schemas are `strictObject` zod definitions that are reused directly as MCP JSON schemas, so input validation and the published contract cannot drift apart.

## Suggested refactor plan for this slice
1. Fix the three HIGH bugs, each with a regression test: buffer-and-decode POST bodies (http.ts:77), register SSE cleanup before any await (http.ts:65-71), and compute reverse relations only from forward links (catalog-index.ts:44-47). Note that fixing relations changes baseline comparisons.
2. Introduce an error taxonomy (`Conflict`, `NotFound`, `InvalidInput`) with one `statusFor()` mapping. Make every stale-revision check throw `Conflict`, and return 500 for unexpected errors.
3. Replace `operationSchemas`, `descriptions`, the MCP annotation lists and the `operate()` if-chain with a single typed operation registry, and correct the destructive/read-only hints.
4. Move the create_feature, plan_delivery, record_progress and link_branch mutations out of `operate()` into pure domain functions, and put the cross-field rules in zod refinements.
5. Consolidate repository identity into one shared module, used by scanner, freshness and `sourceEvidenceUrl`. Replace the fake-`Entity` adapter in knowledge.ts with a narrow `SourceObservation` input and a shared `componentObservation()`.
6. Share one poller and watcher per SSE channel, and summarise only the page window in `queryCatalog`.
7. Replace the ad hoc stemmer with a tested normaliser, validate the MCP envelope (`-32600`), and unify the freshness severity ordering.
