# Manage and Segment immediate return boundary correction

This immutable successor preserves revision-002's reviewed source and 102 native interactions while correcting
false void expression results. The previous sealed bundle/manifest remain unchanged. Exact source declarations
now populate native immediate returnKind: 947 value, 77 void and 480 unresolved implementations. Task and Task<T>
remain immediate values; eventual completion is separate. Constructor returnKind remains unresolved because a
new-expression's object allocation is not a separately modelled operation.

The source return audit found 38 ordinary void invocations and 79 base-constructor initialisers with false
result values. The broader explicit source-void expression audit removes 721 values (528 Invocation and 193
Await) and 842 operand flows. Native source operations and control remain. There were no value-return exits in
source-void methods. No interaction, actual binding, claim or other record referenced the removed values beyond
those operand flows. Exact removed IDs, source evidence and declarations are in return-kind-audit.json.

Negative assertions verify bound void calls have null results and removed void values/flows are absent. They also
verify preservation of all 473 immediate Task/Task<T> handles and all 294 ObjectCreation expression values in the
previous capture, including 140 locally bound constructor allocations. Actual operand/receiver read values may
be attributed to the same invocation operation; those are separate inputs, not method return values.

Validation passes 126,768 records and 6,638 pinned source ranges. The 153-query pack and four positive component
checks pass with the existing Program startup maxNodes frontier retained. Market→Postgres SaveChanges,
authorisation→PopAuthz, startup→Azure AD/PopAuthz and SoftOffer→configured topic remain positively asserted.
The five shared historical replacements and source/runtime limits remain as documented in the overlap ledger.
The original historical proof and both preceding sealed revisions are unchanged. No source application build,
test, fetch or live API/store/broker call was used for this bounded correction.

The source pin remains `volvo-cars/popcat-manage-and-segment` at
`b3605063154f542ec1615d363ab858b86c743110`. All 100 controller registrations use actual source owners. The
available local service/repository/model/mapper/UoW/auth/config/startup/VersionHandling/notification/publisher
bodies and variations remain source-reviewed. Method, entry, file and symbol audits accompany the bundle;
source inspection remains distinct from partial alias, feasibility, delegate-invocation and imported runtime
proofs. Tests and migration history retain explicit exclusions. No fetch, application build/test or live
API/store/broker call was run.

Market PUT reaches the shared PostgreSQL component at the actual zero-argument SaveChanges operation in
UnitOfWork. The 57 typed write associations retain separate repository staging and acknowledgement through
the same save invocation. Missing update/delete can save without establishing staging. Logical EF lookups
remain logical: FindAsync may use tracked state. The shared component's label is corrected to **Manage and
Segment database**, retaining its technical identity.

The registered auth callback reaches configured PopAuthz through actual AuthorizationClient.SendAsync. Actual
startup auth mapping reaches PopAuthz and Azure AD through the source GetRequiredService/registered AddScoped
binding and local client calls. Both HTTP resources have matching remote-interface bindings. Caller values
retain whole HttpRequestMessage and HttpResponseMessage objects, with later content/DTO projections separate;
no generic whole request is relabelled as a wire body. Intended source-configured destinations do not establish
deployment, dependency transport or enforcement.

SoftOffer's service constructor supplies CommercialItemTopicName through local notification formals into its
actual ProduceAsync invocation family. That native interaction targets the configured commercial topic. Other
source families preserve their actual CommercialItem/CommercialSegment option. These contexts describe the
notification caller family; they do **not** assert the producer message generic T is the entity. T comes from
the builder envelope. The generic producer root retains a null destination and dynamic-topic gap. Actual
source kafkaMessage, topicName and awaited producer report remain separate from source protobuf DTOs and
wire transport. No historical consumer handoff is invented. Sku/Selection's missing builder case still prevents
publisher reachability. Non-Persisted reports still log and return normally.

`interaction-result-review.json` distinguishes the immediate call Task/handle from the explicit source Await
result for 22 client/producer interactions. Response bindings use the awaited wrapper/report where the source
provides it; ignored tasks are not treated as completed results.

The query pack executes all 100 routes and representative outcome/value/effect/consistency, callback and
variation cases. `positive-interaction-summary.json` separately asserts Market→Postgres at SaveChanges,
authorisation→PopAuthz, startup→Azure AD/PopAuthz, and SoftOffer→configured topic at ProduceAsync. The full
Program startup graph reports a maxNodes frontier now that its authorisation mapping is actually expanded.
Its positive destination edges are reached before that frontier. Every other standard query fits its budgets;
all results remain non-exhaustive and feasibility is unchecked. The limit is recorded rather than hidden by
trimming available source or inventing another entry.

`validation.log` records schema/ownership/resource-binding/reference checks and pinned source-range verification.
`supersession-overlap-ledger.json` contains exact before/after records for five deliberately replaced shared
historical IDs: `s2/endpoint`, `u3/exposes/soft-offer`, both historical coverage records and
`u3/component/postgres`. The original historical proof stays immutable outside this replacement selection.
There is one current POST `/api/commercial-items/soft-offers` registration, rebound to its actual source owner.
The coordinator must reconcile these authoritative replacements rather than concatenate conflicting copies.

Sealed v3 manifest: `snapshot.json`, ID
`41fc2e67ba0f71e8d93ec9e55ec52ba3339603546e54372c7859c34a14409877`.
The bundle contains 128,331 records; final validation verifies 6,638 pinned ranges.
