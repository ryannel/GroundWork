# Readiness evidence

This is the earlier bounded Spring workflow receipt. The current multi-language launch evidence and
publication limits are in [re-scan readiness](../rescan-acceptance/launch-readiness.md). This historical
receipt does not establish whole-corpus semantic acceptance.

The accepted source scope is `volvo-cars/cds-ecom-customer-service` at
`09623ab3a1f39845d8fc02abc3d591b53a3b5fea`. The three fixed benchmark scopes are the only other source
selections examined. The wider queue remains stopped. No application migration, application execution or
source-repository build was performed.

## Current proof

| Concern                        | Result                                                                                                                                      |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Repository inventory           | 386 tracked files; 340 selected Java files in nine shards; 46 ancillary objects accounted for                                               |
| Final unchanged-source pass    | 340 index hits; zero source blob reads; zero parses; 11.46 seconds summed extraction time                                                   |
| Ancillary reuse                | 46 verified cache hits; zero blob reads; 45 retained text files and one explicit exclusion                                                  |
| Stop/resume                    | First completed shard preserved; remaining eight completed after resume; corruption and policy changes rejected by focused tests            |
| Automatic discovery            | 19 REST entries, two Kafka consumers and one schedule; 32 source boundary candidates; no native execution graph in catalogue metadata       |
| HTTP query                     | 275 unique records through 69 bounded pages; two cached source files                                                                        |
| Schedule query                 | 1,079 unique records through 270 bounded pages; six cached source files                                                                     |
| Query completeness             | No missing, oversized or omitted selected records, and no omitted planner frontiers; unresolved source/runtime frontiers remain visible     |
| Fixed benchmark                | Three scopes, 27 files and 19 checks in every cold, warm, rule-change and parser-change phase; 19 applied destructive mutations rejected    |
| Incremental behaviour          | Add, modify, delete and unambiguous rename exercised against a synthetic Git repository with observed cache reuse                           |
| Customer-service source review | Original 22 questions retained: 13 source-supported, eight partial, one unsupported                                                         |
| Regression proof               | 225 destructive mutations rejected; 45,616 selected records returned through 11,409 pages; pinned source audit passes                       |
| Native logic replay            | Seven probes pass; all eight archive-default mutations rejected; edge-ID migration explicitly verified without changing other record fields |
| LLM interpretation             | Eleven useful inferred claims across all five required areas; exact input snapshots verified; model usage explicitly unmetered              |

These measurements describe this retained corpus and runtime. The previous agent-led workflow was not timed
under comparable conditions, so they do not establish a numerical speed-up over it. Scripted extraction
makes zero model calls; that does not count the LLM reasoning used for interpretation or development.

The final source artefacts live in
[`source-final`](../../../reports/customer-service-scan-readiness-001/source-final/repository.json), with
[`catalogue-final`](../../../reports/customer-service-scan-readiness-001/catalogue-final/catalogue.json),
[`http-query-final`](../../../reports/customer-service-scan-readiness-001/http-query-final/receipt.json) and
[`schedule-query-final`](../../../reports/customer-service-scan-readiness-001/schedule-query-final/receipt.json).
The regression receipt is
[`regression-review-final`](../../../reports/customer-service-scan-readiness-001/regression-review-final/receipt.json),
and the benchmark is
[`scan-readiness-benchmark-003`](../../../reports/scan-readiness-benchmark-003/benchmark.json).

## Corrections found by review

Resume initially ignored prepared outer scope files, and a corrupt terminal checkpoint could retry missing
work before rejecting its aggregate. Both now fail before new source work. A real cached parser projection
also exposed repeated identical facts; only exact full-field duplicate edges are coalesced, with a diagnostic
count. Distinct source/owner/target/position facts remain distinct, and conflicting identities fail.

The new content-based edge identities exposed a fragile profile proof: it inferred loop-child roles from
incidental record order. The checker now selects typed declaration, identifier and block children, retaining
its child-count, branch, return and lexical-lineage requirements. A focused native regression accepts hash-ID
page ordering and rejects missing children or missing lineage. The failed receipt is retained separately;
the final current review rejects all 225 mutations.

Interpretation validation rejects unexamined context, false source pins, dependency cycles, missing areas,
an observed label substituted for an inferred label, copied zero model usage and stale target snapshots.
The readiness I/O checks actual files and current provenance before the pure readiness assessor runs.

## Remaining limits

The eight partial source questions retain their original obligations, including effective security and
wire behaviour, PUT/PATCH and duplicate lineage, restoration durability, typed derived Mongo queries,
external token acceptance and remote/deployed freshness. Q21's source obligations remain unclosed; useful
probable actor/journey answers are supplied separately as **Inferred** interpretations.

Source-byte and page bounds do not establish arbitrary-repository heap bounds or a TypeScript parser
deadline. Complex entry plans may exhaust owner, call, syntax or frontier budgets and must remain partial.
Only the named Spring repository has this whole-repository acceptance proof; the Go and Next.js results
cover their fixed benchmark selections. Readiness does not authorise the wider queue to resume.

## Repository verification

`npm run lint:changed`, `npm test`, `npm run check` and `npm run build` pass. The final combined run passed
2,837 tests across 349 test files, with 119 tests and 26 files explicitly skipped. The separately enabled
native profile regression passed all five tests. Type coverage is 100%; formatting, dependency, cycle,
architecture and pure-layer coverage checks pass.

The final [readiness receipt](../../../reports/customer-service-scan-readiness-001/verdict-accepted/receipt.json)
records `ready_for_bounded_repository_pass`, `fullscanWorkflowReady: true` and no blockers. Its wider-scan
state remains `stopped_not_authorised`, and model usage remains explicitly `unmetered`. Its actual workflow
report contains 36 passing tests covering eight required capabilities. The gate checks all named cases,
including the seven parameterised semantic-identity cases; incomplete or foreign test reports fail.

The [readable interpretation](../../../reports/customer-service-scan-readiness-001/interpretation-final/readable.md)
contains the eleven labelled claims. Its final target metadata is byte-identical to the snapshot originally
examined by the LLM. Reuse of that interpretation is recorded explicitly; retargeting the manifest did not
invent a new model call or erase the original unknown usage.
