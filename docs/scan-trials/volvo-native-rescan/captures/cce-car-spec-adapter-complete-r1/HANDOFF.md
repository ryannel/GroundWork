# CCE Car Spec Adapter complete-01

Pinned source inspection is complete. The immutable native candidate is ready for independent review and parent selection; source inspection does not imply complete runtime, heap or whole-entry query analysis.

- Repository: `volvo-cars/cce-car-spec-adapter`, commit `667a00a5f96fdb8b9aad35e0afe80dc792cbc1b5`.
- Workspace: `volvo-cars`; namespace: `cce-car-spec-adapter-667a00a-complete-r1/`.
- Pair: `bundle.complete-01.json` and `snapshot.complete-01.json`.
- Snapshot: `31585b5be35778f319c8edc78ed346af9eba722bbd9e09a0e819d25ba3eeb1d1`.
- Canonical bundle digest: `2c67f4ae2136fbb14f16f4841d0b855e78adf9ed0b6c0639d6a30ab5cb8abcaa`.
- Bundle byte SHA-256: `8374d820919f8374306cb31d22759d5a67886ba721aee99ed6a23694546cda6e`.
- 118,416 unique records. Authoring rejects unequal or cross-kind ID reuse. No historical capture is embedded or counted as a second current registration.

## Source and native scope

All 366 tracked files are reconciled in `complete-01/source-review-ledger.json`. All 157 production-named Go files (151 ordinary, six generated; 22,922 lines) and all 1,416 real source method/lambda frames were examined. Generated protobuf/getter/descriptor templates are source declarations, not extra running registrations. Auxiliary fake/stub/mock source is examined without a production host assertion. Tests/fixtures and repository tooling do not establish production activation. Config, scripts, dependency declarations, OpenAPI, SQL migrations, operational documentation and the reference DOCX text were reviewed as their respective authorities. No `.proto` exists at this pin; committed generated tags/descriptors supply protobuf authority, including partial imported-wrapper facts.

The catalogue has seven actual business REST registrations, the imported Swagger wildcard, two process roots, ten lifecycle callbacks, one readiness callback, and three actual message subscriptions. Common JWT middleware also covers `/private`. An unavailable imported Swagger implementation remains one explicitly opaque registration target with partial coverage; it is not an invented local function. Default Fx/interface/named-field associations retain host/module/tag context and source activation limits. Local wrappers are actual implementations, never invented services.

`complete-01/source-symbol-audit.json` records 3,684 actual invocation sites: 2,365 source bindings and 1,319 unresolved contexts. Parser signature candidates are not binding proof. Sixty-six calls have exact available local interface/function-type signature facts; concrete dispatch is a separate question. All source-known return kinds are populated: 86 bound void calls and five signature-known void calls have null results. Multiple Go returns are labelled source tuples, not wire envelopes. Closures retain genuine formals, lexical variable cells, receivers and actual registration/formal/target associations; 136 higher-order associations and 70 closure associations remain queryable without pretending construction invokes them.

Source, tagged JSON, generated protobuf, caller-indexed signatures, actual REST wrapper schemas and persisted JSON/relational declarations remain distinct. Eight exact HTTP construction contexts cover three Assortment requests, two Car Features versions, filter service, CPAM XML/SOAP and OAuth token form. V1 contains modelYear; V2 excludes it and includes options. CPAM's generic local HTTP wrapper remains a dynamic transport boundary rather than a fabricated CPAM-specific SDK invocation. Source-configured purposes and actual path/query/header/body construction are discoverable via native claims and values. Bound deployment URLs, foreign codecs and imported runtime policies remain explicit gaps.

There are 37 outbound boundary ledger rows (35 actual effect sites; shared Sentry API/migrator rows are deliberately per host), plus three consume interactions. Six typed SQL writes retain actual column/value/selection associations, source nil-error success_result acknowledgement and unknown atomicity. Exec/helper nil error, transaction Commit and deferred Rollback are distinct. Deletes do not inspect RowsAffected. Source DDL is not observed applied schema. All storage changes precede publication; source publication failure does not roll back earlier mutations, and no outbox or wider transaction is invented.

Messaging retains actual x-type predicates, payload decoding, identifier flow, feature/year nil-return skips and conditional Kafka/GoChannel profiles. Poison middleware publishes literal `poison`, whereas the registered handler subscribes to `poisonqueue`; no correspondence is guessed. Watermill UUID is not asserted to be a Kafka partition key. Broker persistence/offset/retry/order/delivery guarantees and cross-repository handoffs remain unresolved.

Five Go goroutines have waitsFor:none and null results. Sync/Baseline child work uses Background plus operationID; REST202 acknowledges initiation only. Shutdown goroutine arguments and the source WaitGroup association are retained separately. Scheduler/interleaving/process-wide panic and recover semantics are not inferred from local frame separation. Deferred arguments are evaluated at registration; source LIFO/exit associations are preserved without general defer/heap proof. Seventy-three finite analysis-limit records describe defer, goroutine, panic, Scan and codec/alias joins; none labels an unexamined executable expression as complete.

The finite aid audit covers all 319 range sites: 287 slice/array projections, 26 maps, one integer and five unresolved imported/callback types. No channel range occurs. Unknown keys are not guessed int. Evaluated map keys are distinct from struct fields, including the actual PCG `pno12` key at `convertintocarspecification.go:136`; `complete-01/map-construction-ledger.json` retains actual key and payload values.

## Acceptance and limits

`complete-01/queries/` contains 253 strict primary query fixtures and one executed strict continuation replay. Normal requests retain maxNodes2000/maxRecords5000 and constructed representation for non-value queries; the explicit pagination test uses maxRecords40. Requests, responses and embedded next requests are schema checked. No traversal budget was raised to conceal an incomplete whole-entry projection.

All seven business entry IDs are query roots with positive expected targets:

| Root suffix after `entry/rest/`        | Positive source interaction targets | Projection                      |
| -------------------------------------- | ----------------------------------- | ------------------------------- |
| carspecifications/Sync                 | Assortment, Postgres                | Bounded                         |
| carspecifications/Baseline             | Assortment                          | Bounded; no whole-path DB claim |
| carspecifications/GetCarSpecifications | Postgres                            | Bounded                         |
| localeditions/List                     | Postgres                            | Unbounded within query limits   |
| localeditions/GetLocalEditionCode      | Postgres                            | Unbounded within query limits   |
| localeditions/Upsert                   | Postgres, Assortment                | Bounded                         |
| localeditions/Delete                   | Postgres                            | Unbounded within query limits   |

Thirty-three of 37 boundary owner projections positively reach their exact native interaction, including real SQL, HTTP, migration, flag purpose, JWKS and publication boundaries. Two of these positive traversals encounter later node limits; the observed edges remain positive conditional source facts, not exhaustive execution/feasibility proof. Four shared Sentry method-only rows correctly return binding_unresolved because API/migrator hosts are ambiguous; these are not meaningful interaction acceptance. Their exact SDK calls, actual arguments and per-host source associations remain available as records. Subscription-ID roots positively expose all three exact consume interactions; business message paths can reach limits later. Swagger is a negative opaque imported-body fixture.

All six write/error-nil control and field-lineage fixtures, eight caller constructions, source/wire/persisted distinctions, actual argument values, async forks, source-known void results, dynamic map key, unresolved range types and pagination are exercised. Source call operands/field construction associations do not invent generic argument-to-return lineage through JSON/HTTP/SDK libraries. Available local delegate/conversion/alias bodies are inspected even where automatic context joining remains partial. CPAM's source request construction is explicit; automatic specialised destination dispatch through the generic HTTP wrapper remains a documented limit.

Full offline pinned validation checked all 14,282 ranges at snapshot `432bf9ff3ec20106f8bead334e606a974afc513502aa85dc9bd5a24410c1dfa8`. The final map-key correction preserved every evidence record exactly, proven against that indexed snapshot in `complete-01/pinned-evidence-equality.json`. Final native validation and the entire strict query pack were replayed on the selected `31585b...` pair. See pinned/final validation logs, native assertions, completeness, symbol, I/O, write, construction, registration, channel and schema ledgers in `complete-01/`.

`publication-seal.complete-01.json` hashes the pair, this handoff and immutable acceptance files. Mutable `working.*`, parsers and preparation notes outside `complete-01/` are not a second selection. No fetch, dependency download, source application build/test, live call, broker/store operation, migration, production edit, app/schema change or global scan-state edit was performed. Parent coordinates independent review, global app checks and combined publication.
