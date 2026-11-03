# Java 25 parser support

All **340 customer-service Java files now parse without diagnostics**, including the six previously
quarantined files. Their native local graphs are restored. The wider repository queue remains stopped.
Only `volvo-cars/cds-ecom-customer-service` at
`09623ab3a1f39845d8fc02abc3d591b53a3b5fea` was reprocessed.

| Result                                  | Previous Java 17 capture | Java 25 capture |
| --------------------------------------- | -----------------------: | --------------: |
| Java files attempted                    |                      340 |             340 |
| Files without parser diagnostics        |                      334 |             340 |
| Parser diagnostics                      |                       21 |               0 |
| Files quarantined from semantic answers |                        6 |               0 |

## Installation and selection

`npm run scan:java:setup` installs a project-local Eclipse Temurin 25 JDK under
`node_modules/.cache/groundwork/java25`. The installed version is **25.0.5+8-LTS**. The official archive's
136,446,056 bytes and SHA-256 were verified before extraction. The installer probes the extracted Java 25
runtime and atomically publishes its manifest; it changes no global Java setting. It supports macOS/Linux
on arm64/x64. An explicit `--java` executable remains available for other platforms or older compilers.

Both parsing and cache fingerprinting select the same executable: explicit override, then managed runtime,
then PATH when no managed installation exists. Invalid managed metadata or a stale/non-executable binary
fails clearly. Actual runtime version and adapter content invalidate the parser cache. The setup reuses a
verified installed runtime on subsequent invocations.

## Structures verified

The adapter preserves compiler fields for switch selectors, cases, labels, guards, yields, record and
deconstruction patterns. Named bindings are confined to their matching case or direct positive `if`/ternary
arm. Nested lambda uses retain lexical capture origins. Unnamed patterns and catches introduce no named
binding; their caught types and bodies remain in the source graph. Operators come from compiler kinds so
inline comments do not erase the `&&` guard.

Independent checks against all six real files established:

- `FactoryContext` returns complete conditional expressions with both `Optional.of(token/user)` and
  `Optional.empty()` arms, with correct pattern origins. Its constructor's lambda captures the token origin.
- `IIndividualFactory` has all four switch alternatives, with token/user operands bound to their own cases.
- All four unnamed catches retain their bodies and have zero named parameter edges.
- `OrderUpdateEventConsumer` retains its complete conjunction beside the inline comment.
- Retained source hashes match pinned Git blobs, and 1,862 native source anchors match exact line ranges.

The review caught empty compiler names for unnamed variables, same-span pattern wrapper ambiguity and
missing positive-ternary scope before final acceptance. Trial 004 stopped at public validation and remains
an incomplete historical attempt. The corrected [trial 005](../../../reports/customer-service-pipeline-005/repository.json)
has nine validated immutable shard publications; first and warm generations match for every shard.
Genuinely malformed source still contributes only a pinned source and parser gap, with no recovered
semantic declarations or operations accepted.

## Reprocessing and limits

The changed compiler/adapter required rebuilding all 340 Java indexes. The first pass used cached source:
**zero Java Git blob reads**, 340 parses, about **153.6 seconds** including extraction/publication.
The warm pass had **zero Java blob reads, zero parses and 340 index hits**, about **9.7 seconds**.
Ancillary text/binary inventory reads are separate. The scripts made no model calls; implementation and
independent agent review consumption were not measured. Volvo source was neither built nor executed. Annotation processors and repository tests were not run;
no implicit Git fetch or broader repository scan ran.

A successful parse does not establish general Java type semantics, switch exhaustiveness, dependency
injection, wire contracts, successful storage/publication or actor journeys. General pattern flow through
compound/negated predicates remains unresolved. The earlier 22-question scores remain an assessment of
trial 003; this upgrade removes the parser blocker for the order consumer without closing its full
subscription, effect and failure-policy question.

See the [independent review](java25-review.md), [machine-readable receipt](java25.json) and
[pipeline guide](../../scan-pipeline.md). The runtime is distributed by
[Eclipse Adoptium](https://adoptium.net/installation/); modern pattern fields use the
[Java compiler Tree API](https://docs.oracle.com/en/java/javase/25/docs/api/jdk.compiler/com/sun/source/tree/DeconstructionPatternTree.html).

## Verification

`npm test`, `npm run lint:changed`, `npm run check` and the production build pass. The final check passed
2,553 tests, coverage thresholds and 100% type coverage. Six modern Java 25 tests and seven existing native
backend tests passed separately. An explicit Java 17 compatibility run also passed all seven backend tests.
Thirteen runtime/provenance tests and ten package-integrity tests pass. The build exported 391 pages;
it also reported an existing Next.js security advisory. Two CLI integration tests retain their assertions
with explicit 15-second limits to accommodate concurrent coverage/build load.
