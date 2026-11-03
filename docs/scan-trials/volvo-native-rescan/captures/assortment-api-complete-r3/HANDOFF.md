# Assortment source-local capture

The pinned repository has been inspected and expanded into an immutable native v3 candidate. Source inspection is complete for the production inputs in the ledger; automatic delegate/iterator dispatch, heap alias feasibility and imported runtime behaviour retain explicit limits. The parent agent owns combined selection and independent review.

- Repository: `volvo-cars/popcat-assortment-api`
- Commit: `6114c5db0f2b4b490cf89b9c512088f01dbf0b98`
- Bundle: [bundle.complete-03.json](bundle.json)
- Manifest: [snapshot.complete-03.json](snapshot.json)
- Snapshot: `12219e2034df0e17bbddb39b0cb84cb758d43e05f42dd145321613bd27300899`
- Bundle digest: `8696057f59b4e96fb05d5523ebe0dd38875a5f5f0ff367cadecd86b23470e257`
- Validation: [validation.complete-03.log](validation.complete-03.log); all 7,127 evidence ranges match pinned local files.

## Scope and evidence

The candidate contains 54,241 records. The source pass covers 266 pinned production files/inputs, 210 C# files, 277 type declarations, 467 explicit bodies, three top-level Program bodies and 362 lambda bodies (832 actual source frames). All 362 lambdas have source registration associations; local functions remain their own source methods with lexical captures. The symbol audit records 2,581 invocation sites and 600 checked native local bindings. Recovered Roslyn overload symbols were not accepted as authoritative: receiver declarations, namespace imports, source signatures, arity, named/default slots and determining argument types establish local bindings; unresolved local dispatch remains explicit.

The current catalogue has 29 controller routes, seven Ocelot route templates, ten processors, one hosted Kafka loop, eight health registrations, the Swagger proxy and three process-source entries. The 60 query entry views also include the immutable historical proof entry; they are not 60 independent endpoint registrations. Source process entries represent Program startup and its local configuration. Health/gateway registrations preserve imported framework boundaries.

Local C# shapes include inheritance/generic closure and actual source return wrappers. The 237 OpenAPI definitions across both generator inputs retain references, arrays, constraints and alternatives. All 15 protobuf files are audited, including repeated fields, envelopes, enum declarations and reserved declarations. Imported Google wrapper/time definitions and generated NSwag implementations remain explicit boundaries. SDK/generated-client selections contain actual source arguments; no transport envelope, effective wire serialisation or header filter was invented.

## Review ledgers

- [source-file-ledger.json](source-file-ledger.json): exact hashes, line counts and source scope.
- [method-ledger.json](method-ledger.json): all 832 actual source bodies, inspection status and native implementation IDs.
- [entry-completeness-ledger.json](entry-completeness-ledger.json): all 60 entry views and owned coverage/gaps.
- [symbol-audit.json](symbol-audit.json), [di-audit.json](di-audit.json): invocation candidates and source registration resolution.
- [callback-associations.json](callback-associations.json), [higher-order-ledger.json](higher-order-ledger.json): registrations, genuine formal slots, exact caller delegate values, callback bodies and captures; 36 local higher-order associations.
- [iterator-ledger.json](iterator-ledger.json): three construction→formal/capture→iterator body→foreach associations, without eager iterator execution.
- [declaration-associations.json](declaration-associations.json): 118 primary-constructor/base-expression source declarations; no synthetic constructor execution is asserted.
- [return-boundaries.json](return-boundaries.json), [source-shape-ledger.json](source-shape-ledger.json), [openapi-schema-ledger.json](openapi-schema-ledger.json), [protobuf-schema-ledger.json](protobuf-schema-ledger.json): actual source return/type/schema closure.
- [io-ledger.json](io-ledger.json), [local-dispatch-ledger.json](local-dispatch-ledger.json), [dependency-audit.json](dependency-audit.json), [configuration-audit.json](configuration-audit.json): actual I/O boundaries, 42 unresolved local automatic-dispatch sites, exact dependency declarations and configuration.
- [review-notes.json](review-notes.json): source-reviewed semantics and material failure/ordering details.
- [overlap-ledger.json](overlap-ledger.json), [superseded-records.json](superseded-records.json), [revision-map.json](revision-map.json): historical proof and replacement identity accounting.

## Source semantics worth checking

Classification returns a successful cache read through deserialisation; a warm deserialisation failure does not enter provider fallback. Blob download prefixes the name, checks existence, awaits download, and requests background Hot tier only for status409 with BlobArchived. That tier Task has a fault-only continuation; its success is not acknowledged at helper return.

The three cache fallback lambdas start Redis SetAsync without awaiting its Task and return a separate successful data Result. Native `waitsFor:none` preserves child execution and immediate parent continuation, keeps fault propagation isolated and leaves interleaving unresolved. Source callbacks capture enclosing `this` where fields/primary constructor state are read at invocation; they are not labelled frozen field copies.

TryCall returns its delegate Task without awaiting, so its catches establish synchronous invocation handling only. ProductMapper's separate helper awaits its delegate. Source higher-order/iterator associations retain exact local inputs and bodies, but mechanical query dispatch through dynamic delegate values/MoveNext contexts is explicitly unresolved. This is a query analysis limit, not missing or unexamined local source.

Cold fallback, ignored cache Results, non-atomic whole-list mutation, variant history ordering, purge cold-copy retention, batch failure-to-null mapping, fan-out parsing, cancellation and HTTP login-redirect detection have explicit source findings. The hosted consumer's selected processor and awaited local callback are represented separately from unavailable exact Kafka SDK commit/retry defaults.

## Remaining limits

Generated AssortmentProxy/ProductMapperProxy bodies do not exist in the pin. Exact FluentResults4, transport, Redis/Blob/Kafka/framework policy and deployed values were not executed or inferred from other cached versions. Imported type/alternative constraints and source-local generic/delegate automatic dispatch retain native gaps. No query proves heap alias feasibility, concurrent scheduling, SDK server acknowledgement beyond the actual source boundary, deployment configuration, external response contents or generic MAS publication equivalence to the original SoftOffer handoff.

Declaration claims, gaps and coverage now own their exact source shape or source revision. No unrelated source method is used as a catalogue anchor. Unresolved invocation operands/results have source association claims, not generic argument-to-result flows. SDK/client receiver values are explicit source selection bindings. I/O ledger rows repeat the same source operation once per allowed host; they are not additional source calls.

[historical-crossrefs.complete-03.json](historical-crossrefs.complete-03.json) records every reference to the historical602. Actual new source graphs reference only original source revisions and runtime components; eight retained registration cases also reuse the original consumer channel binding. No actual new source graph references an original operation/value/method. The historical MAS HTTP endpoint is not an Assortment HTTP route; historical SoftOfferCreated consumer proof overlaps the current ManageCommercial processor family.

The original 602 proof records, its entry/subscription/control graphs and SoftOffer handoff are preserved byte-for-byte in meaning (deep record equality). They overlap current source frames and remain historical proof, not additional current registrations or new source methods. Thirty-one earlier route/hosted/Swagger summary frames are superseded by actual source methods. Ten retained processor registration adapters dispatch to the true source methods; the direct source entries are views of those processors, not ten additional subscriptions. Parent selection must retain this distinction when combining repositories.

## Reproduction

`python3 reports/volvo-native-rescan/assortment-api-complete/enrich.py` writes only mutable working outputs. Do not overwrite the immutable complete-03 files when revising: use a fresh candidate name and manifest.

Validation command: `npm run knowledge:validate -- reports/volvo-native-rescan/assortment-api-complete/bundle.complete-03.json --write-snapshot <new-manifest> --sources /Users/RNEL/.cache/groundwork/clones`.

Final acceptance: **255 queries across all 60 entry views passed, with no query limits hit**. This includes route-rooted API→Blob and worker-owned processor→Blob host assertions with actual receiver/argument value traces. Shared-method interaction requests with no unambiguous host are labelled diagnostic only and do not count as meaningful interaction acceptance. Classification has no Redis path in this source; provider/generated-client callback traversal remains explicit. No REST interaction projection currently reaches Redis automatically: Redis SDK I/O lives inside FluentResults Try callbacks. Actual Redis boundary/arguments/captured source graphs are present and discoverable through source associations, while strict endpoint interaction traversal stops at imported callback invocation policy. ProductDetails→Redis was not mechanically proven.

Acceptance harness: `node --import ./tools/register.ts --conditions=react-server reports/volvo-native-rescan/assortment-api-complete/queries.complete-03.mjs`; requests/results are under `queries.complete-03/`. The harness verifies original602 equality, all entry roots, classification200/404/500, Blob archive branch, receiver/value traces, local higher-order associations, iterator bodies, ignored-Task isolation and store records. Its query index is disposable.

No source application build/test, live endpoint, store, broker, fetch or deployment operation was performed. Application/schema checks are coordinated by the parent agent. All authored changes are confined to this report directory; earlier r5/602/checkpoint inputs are unchanged.
