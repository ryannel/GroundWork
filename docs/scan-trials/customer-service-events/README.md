# Customer service asynchronous work and events

Q15 and Q16 are supported by native source bindings and an independent bounded review.
The unchanged 22-question review now has **9 supported, 12 partial and 1 unsupported** answers.
Only `volvo-cars/cds-ecom-customer-service` at
`09623ab3a1f39845d8fc02abc3d591b53a3b5fea` was analysed. Other scans remain stopped.

- [Question review](answerability-review.md) retains all 22 answers and their boundaries.
- [Machine-readable review](answerability.json) records the results and evidence locations.
- [Independent source review](source-review.md) fixes the required Q15/Q16 clauses.
- [Pipeline guide](../../scan-pipeline.md) describes the reusable contracts and commands.

## What can be answered

Q15 follows the repository's returned customer into post-processing and the returned result, using
reaching values rather than variable names alone. The source invokes customer publication, analytics,
audit save and consent publication in that order. The model distinguishes declared asynchronous methods,
executor candidates, direct self-calls, unverified proxy dispatch, ignored futures and ignored audit
returns. Local failure paths and transaction declarations remain separate from runtime guarantees.

Q16 retains all four ordered skip guards, SIGNATORY selection, previous/current comparison, event
construction and message submission. A CDB-ID-only change passes the change test. The payload contains
the complete current consent values: `consentGranted` maps to `consented`, and `dateOfConsent` maps to
`timestamp`. The country-code expression is joined to a uniquely identified private source helper with
candidate-qualified argument/formal bindings; it does not invent a generated accessor implementation.

An invocation order is not an order of completed effects. Effective Spring interception, queue admission,
SDK behaviour, codecs, broker acknowledgement and storage durability remain unobserved. The name
`sendSafely` does not establish retries, swallowed errors or successful delivery.

## Reusable contracts

`async_binding` retains exact Spring annotations, activation and executor declarations, invocation
dispatch and result use. `execution_binding` retains selected methods' returns, throws, catches,
finally blocks, transaction declarations and observed call-result use. Deferred bodies remain separate.
`event_binding` retains typed publisher calls, source argument roles, constructor fields, builder
applications, conditions, comparisons and qualified helper candidates. SDK arguments remain source
contracts. These extend the shared call/value model without asserting effective wire semantics.

## Evidence

Paths below are relative to the workspace root. Development captures remain available; the accepted
proof uses the following immutable source and binding publications.

| Artefact                               | Path                                                                                   |
| -------------------------------------- | -------------------------------------------------------------------------------------- |
| Source capture                         | `reports/customer-service-events-002/repository.json`                                  |
| Canonical bindings and receipt         | `reports/customer-service-events-001/accepted/{document,receipt}.json`                 |
| Bounded review, pages and source audit | `reports/customer-service-events-001/accepted-review/{receipt,pages,source-pins}.json` |
| Earlier question replays               | `reports/customer-service-events-001/independent-native/accepted-native-replay.json`   |
| Archival default proof                 | `reports/customer-service-events-001/independent-native/Q08-default-review.json`       |

The accepted bounded review returns 37,432 records in 9,362 pages (17,437,936 bytes). The independent
audit verifies 9,227 source anchors across 255 files.

The full review rejects **152 destructive evidence mutations**, including 22 for Q15/Q16. They cover
guards before payload construction and submission, saved-result propagation, cross-method argument
bindings, callback ownership, payload fields and caller result use. A mutation counts only when the
complete original question passes and the mutation actually applies. Seven earlier native proofs are
freshly replayed from returned pages; the archival default proof rejects eight additional mutations.

The source run inventories 386 tracked files and reuses all 340 Java indexes across nine shards.
Both its first and warm phases perform zero Git blob reads and zero parses. The combined source run
takes 30.51 seconds, and binding extraction takes 28.75 seconds, under concurrent work. Both GraphQL
resources reuse verified retained bytes. These are cache-reuse measurements, not cold-scan timings or
a measured speedup against the earlier agent workflow. Scripted extraction makes zero model calls;
development and review agent consumption is separate.

Reproduce the bounded review into a new directory:

```sh
node --import ./tools/register.ts --conditions=react-server tools/scan-events-review.ts \
  reports/customer-service-events-001/accepted/document.json /path/to/clones /path/to/NEW-output
```

Each request selects at most 32 IDs; each page returns at most four records and 65,536 bytes. The larger
combined acceptance suite explicitly caps its total at 49,152 records and 32 MiB. Earlier review defaults
remain unchanged. An independent audit verifies returned source anchors against pinned Git trees,
recomputed blob hashes and line bounds. This work does not migrate the production workspace reader.

Changed-file lint, full unit tests, `npm run check` and `npm run build` pass. Targeted native parser and
extractor tests cover async annotations, result use, payload construction and the independent question
proofs. Local source and analysis freshness is recorded in
`reports/customer-service-events-001/freshness.json`; remote and deployment currency remain unobserved.
