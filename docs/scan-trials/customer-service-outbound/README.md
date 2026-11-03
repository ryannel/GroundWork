# Customer service outbound bindings

Q12 and Q13 are supported by source contracts, control and value bindings, and a bounded independent review.
The full review now reports **7 supported, 14 partial and 1 unsupported** answer against the same 22 questions.
Only `volvo-cars/cds-ecom-customer-service` at
`09623ab3a1f39845d8fc02abc3d591b53a3b5fea` was analysed. The wider scan queue remains stopped.

- [Question review](answerability-review.md) records all 22 results and their remaining boundaries.
- [Machine-readable review](answerability.json) retains the question results and evidence locations.
- [Independent source review](source-review.md) fixes the source clauses for both questions.
- [Pipeline guide](../../scan-pipeline.md) describes the reusable contracts and commands.

## What can be answered

Q12 follows both Volvo ID HTTP client alternatives, including token/header construction, response shape,
sanitisation and failures. It distinguishes Connect and Entra token claims from profile network requests,
and captures their shared external decoder boundary. CDB has a typed GraphQL document, variables, selected
fields, response model and failure paths. Identity selection, context caching and per-field individual
merge precedence are available to drill into.

Q13 follows both Fleet requests and the Partner GraphQL lookup through request-variant dispatch,
validation, mapping, null filtering and insertion in the returned customer. Future and filter callback
joins are explicit. The source mapper candidate for Partner remains distinct from an exact executable
binding when the generated roles getter's return type is unresolved.

These are source answers. External discovery/verification, client configuration, effective codecs,
deployed addresses, remote completion and production currency remain unobserved.

## Reusable extraction

The schema adds distinct GraphQL, library, source-document and Java constant bindings. GraphQL and
library calls do not inherit fictitious HTTP methods or URIs. Source documents retain variable types,
argument bindings and nested selection paths with file anchors. Unsupported GraphQL syntax produces a
gap. Compiler literal values establish constants; arbitrary expressions are not evaluated.

Shared Java resolution now handles null arguments conservatively, direct positive pattern bindings and
declared collection element types for supported stream mapping. Ambiguous calls, unsupported scope flow,
custom streams and generated executable bodies remain unresolved. Deferred client assignments and
GraphQL projections cannot be mistaken for immediate execution.

## Evidence and reuse

Paths below are relative to the workspace root. Earlier development outputs remain available; the
question review identifies the final accepted proof receipt.

| Artefact                                  | Path                                                                                        |
| ----------------------------------------- | ------------------------------------------------------------------------------------------- |
| Source capture                            | `reports/customer-service-outbound-003/repository.json`                                     |
| Local source and analysis freshness       | `reports/customer-service-outbound-001/freshness.json`                                      |
| Canonical bindings and extraction receipt | `reports/customer-service-outbound-001/accepted/{document,receipt}.json`                    |
| Accepted bounded review and source audit  | `reports/customer-service-outbound-001/accepted-review-v2/{receipt,pages,source-pins}.json` |
| Earlier supported question replays        | `reports/customer-service-outbound-001/independent-native/accepted-native-replay.json`      |
| Independent archival default proof        | `reports/customer-service-outbound-001/independent-native/Q08-default-review.json`          |

The source capture inventories 386 tracked files and reuses 340 Java indexes across nine shards.
Both its first and warm phases perform zero Git blob reads and zero parses; the combined capture takes
22.76 seconds. The binding stage takes 8.95 seconds, also with 340 index hits, and verifies both retained
GraphQL resources without rereading Git blobs. Source and binding analysis fingerprints agree.
These are cache-reuse measurements under concurrent work, not cold-scan timings or a speedup estimate
against the earlier agent workflow. Scripted extraction makes zero model calls; development and review
agent consumption is separate.

Run the independent bounded review into a new directory:

```sh
node --import ./tools/register.ts --conditions=react-server tools/scan-client-review.ts \
  reports/customer-service-outbound-001/accepted/document.json \
  /path/to/clones /path/to/NEW-output
```

The review reconstructs its input solely from returned pages. Each request selects at most 32 IDs;
each page returns at most four records and 65,536 bytes. This larger acceptance suite explicitly caps
the total at 32,768 records and 32 MiB; smaller binding reviews retain their original default limits.
All 130 destructive checks reject their affected claims, including 40 mutations of complete Q12/Q13
answers. An independent source audit checks returned anchors against pinned Git trees, blob hashes and line
bounds. Wider scans and the production workspace reader remain unchanged.

Changed-file lint, the full test suite, `npm run check` and `npm run build` pass. The final full check
passes 2,664 tests across 319 files. Native parser, extraction and question-proof regressions are also
run explicitly; the earlier archival default proof rejects eight additional relation removals.
