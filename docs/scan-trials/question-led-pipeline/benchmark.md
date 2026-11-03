# Initial question-led pipeline benchmark

Historical 2/19 baseline. See the [19-check depth benchmark](depth-benchmark.md) for the subsequent result.

The initial contracts and reusable source tools work, but semantic depth is not proved. **The wider Volvo
scan remains stopped.** The fixed experiment covers 27 files, nine questions and 19 independent semantic
checks. 2/19 checks are supported; the other 17 are unresolved. There are no failed structured checks in
this run. Unresolved checks keep the restart gate closed.

| Fixed scope         | Files | Cold extraction | Warm extraction | Freshness check | Depth supported |
| ------------------- | ----: | --------------: | --------------: | --------------: | --------------: |
| spring-write-async  |    10 |          3.83 s |          117 ms |          135 ms |             1/7 |
| go-dispatch-river   |     9 |          6.34 s |           74 ms |          105 ms |             1/6 |
| next-actor-endpoint |     8 |          0.26 s |           62 ms |          119 ms |             0/6 |

These are single local measurements after application checks finished, not a speedup comparison with the
old agent workflow. Cold means an empty source/index cache; OS and compiler caches may be warm. Node
26.8.2, TypeScript 6.0.3, Go 1.24.5 and Java 17.0.19 ran on macOS arm64. The scripts used zero model calls
or tokens at runtime. Implementation effort and the previous workflow's timing/tokens were not measured.

## What passed

- Each cold run read and parsed exactly its selected files. Every warm run read and parsed zero Git blobs.
- In all three isolated delta trials, a one-file change read/parsed one file and reused the rest.
- Same-blob renames read/parsed none and refreshed the source paths, commits and blob anchors.
- Changed extraction rules reused cached syntax; changed parsers reparsed cached source without Git blob reads.
- Current analysis fingerprints and local HEAD observations matched all three pinned baselines. This establishes
  local source/analysis status at the recorded observation times, with remote and deployment status unproved.
- All parser diagnostics were empty. Bounded record retrieval delivered all 16 selected records in four pages
  per scope. This tests the paging contract, not complete endpoint answer retrieval.
- Independent CLI fixtures prove a fully unchanged refresh skips extraction/index reads and preserves the
  selected generation. Deletions or renames of selected files stop for explicit scope review.

Incremental mutations occurred only in disposable synthetic repositories containing the selected cached
files. Original Volvo clones were read-only; no wider source scans or application migration ran.

## What remains

The supported checks are Spring's equality early return and Go's ordinary returned-error behaviour. This is
local source logic, not complete answers to either endpoint question. All broad question receipts remain
unresolved until their semantic closure is established.

The remaining work requires both contracts and reusable extractors:

- **Spring:** rebound save-result lineage, actual async activation/completion, publication guards and the
  archive write/delete failure window.
- **Go:** contextual generic registry dispatch, SQL column/argument bindings, transaction/rollback windows and
  queue acceptance separated from later delivery.
- **Next/browser/server:** actual callback/control bindings, input/request/response lineage, action conditions,
  waiting/continuation and response-to-visible-outcome mappings.

`scan/v1` is an initial pipeline contract. Native assignments/reaching values, field lineage, resource/SQL
bindings and transaction/catch topology are incomplete. It is not a settled canonical replacement. Existing
execution proofs retain their schema and replay rules. Syntax counts, raw source and old accepted captures
were not used to satisfy missing semantic checks.

## Verification

`npm test`: 2,437 passed. `npm run check`: 2,486 passed including architecture tests, type coverage 100%,
format/lint and coverage thresholds passed. Two native compiler tests passed. `npm run build` exported
391 pages successfully. The two native tests are opt-in in the ordinary unit/check runs and were executed
separately. All three edited skill entrypoints passed the skill validator.

See the [pipeline guide](../../scan-pipeline.md) for `scan:run`, `scan:freshness --scope`, `scan:refresh`,
publication, cache and query contracts. [The compact machine-readable receipt](benchmark.json) preserves the
pins, observations, timings, counters and check results. The full local report is
[benchmark.json](../../../reports/scan-benchmark-004/benchmark.json).
