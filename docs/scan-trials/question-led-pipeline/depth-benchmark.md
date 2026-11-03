# Endpoint and actor depth benchmark

All **19/19 depth checks pass** on the same three fixed scopes, across cold, warm, changed-rule and
changed-parser trials. All **19 destructive semantic mutations are rejected**. Depth, reuse, integrity and
mutation gates pass. **The wider scans remain stopped by the user.** No production scan marks moved and the
application has not migrated.

| Fixed scope         | Files | Cold extraction | Warm extraction | Freshness check | Depth |
| ------------------- | ----: | --------------: | --------------: | --------------: | ----: |
| spring-write-async  |    10 |          4.85 s |          428 ms |          151 ms |   7/7 |
| go-dispatch-river   |     9 |          6.63 s |          387 ms |          122 ms |   6/6 |
| next-actor-endpoint |     8 |          0.32 s |          111 ms |          118 ms |   6/6 |

The manifests, source commits and 19-check oracle are unchanged from the [initial 2/19 baseline](benchmark.md).
This run was taken after project checks and the build finished. These are single local measurements, with
empty source/index caches for cold trials; OS and compiler caches may be warm. They are not a measured
speedup against the previous agent workflow. Scripted runtime model calls and tokens are zero;
implementation consumption and previous workflow timing were not measured.

## What changed

The schema now contains native semantic nodes and edges for operands, guards, ordered statements, local
assignments and reaching values, lexical bindings, callbacks, deferred work, exception paths and SQL column
bindings. Literal values and operators come from parser output. Display syntax is retained for inspection,
but cannot supply a missing semantic relation. Public validation checks record kinds, ownership, scope,
operators and commit/blob/source containment.

Reusable Java, Go and TypeScript extractors populate these relations from the same selected source files.
Checkers were authored independently of their language extractors. The depth checks cover:

- Spring's equality exit, saved-result rebinding, async declaration/activation boundary, publication guards,
  returned completion, archive ordering and failure window: **7/7**.
- Go's contextual registry dispatch, returned errors, transaction/deferred rollback ordering, queue acceptance
  versus delivery, SQL column/argument lineage and staged commit/error handling: **6/6**.
- Next/browser callback registration, address lookup conditions, awaited response lineage, derived income
  details, server request constants and response/error status paths: **6/6**.

Every check also rejects a deliberately broken required relation or parsed value while leaving display syntax
unchanged. Further regressions reject decoy callback bindings, discarded JSON results with fabricated local
values, wrong HTTP methods and errors belonging to unrelated calls. The acceptance gate requires the exact
oracle denominator and consistent mutation metadata; missing or contradictory receipts fail.

## Reuse, freshness and retrieval

All cold runs read and parse exactly their 10, 9 or 8 selected files. Warm runs read and parse zero files.
Rule changes reuse cached syntax. Parser changes reparse cached source without another Git blob read.
Each isolated one-file change reads/parses exactly one file and reuses the rest; same-blob renames read/parse
none and refresh their evidence anchors. Original Volvo clones remain read-only. Incremental trials use
synthetic repositories containing only the selected cached files.

Freshness checks compare current scanner/schema/parser fingerprints and observed local HEAD with each pinned
baseline. They establish local source and analysis status at the recorded times, not current remote or
production deployment status. Semantic summaries are recomputed from cached syntax; persistent semantic
summary reuse remains future work. An unchanged verified refresh can skip extraction/index reads entirely.

All four trials per scope pass public schema/semantic validation with zero parser diagnostics. Bounded
retrieval delivers every selected depth-evidence record and its direct source anchor: Spring 50 records in
13 pages, Go 67 in 17, Next 82 in 21. Pages allow four records and 65,536 bytes; selection is capped at 256
records and does not recursively expand support. These evidence slices total roughly 27–40 KB per scope.
The full detailed captures are 5.2–8.1 MB and are not application UI payloads.

## Limits and verification

Passing a source proof includes preserving uncertainty: an async annotation does not establish activation;
send/commit does not establish delivery; archive catch handling does not establish rollback; a mutable
registry needs runtime dispatch context. These checks do not establish arbitrary path feasibility, heap
aliasing, whole-program dependency injection, actor intent or deployment identity. Broad endpoint/journey
receipts remain unresolved when their complete obligations are not closed. Passing this benchmark does not
authorise restarting the wider queue.

`npm test` and `npm run lint:changed` passed. The final `npm run check` passed **2,522 tests**, architecture,
lint, formatting, coverage thresholds and 100% type coverage. Native tests are opt-in in normal runs;
the explicit four-file native suite passed **16 tests** separately. `npm run build` exported **391 pages**.
All three updated scan skills passed their validator. Sol agents ran on Medium reasoning in parallel.

See the [pipeline guide](../../scan-pipeline.md), [machine-readable receipt](depth-benchmark.json) and
[full local benchmark](../../../reports/scan-depth-003/benchmark.json). The receipt retains source pins,
analysis fingerprints, observation times, per-trial counters and every check/mutation result. The earlier
execution proofs retain their original schemas and replay rules.
