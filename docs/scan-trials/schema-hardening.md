# Schema and scanning review

The review covered canonical v3 integrity, query/snapshot behaviour and whether the scanning skills can
populate that model from another repository. Three reviewers examined the implementation independently;
a separate agent exercised the revised instructions on a small repository outside the Volvo proofs.

## Findings addressed

| Finding                                                                                                         | Change and regression coverage                                                                                                                                                                                                                                                                      |
| --------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Snapshot import checked combined records as v1, bypassing v3 evidence/duplicate-host-binding checks.            | Shared `verifyKnowledgeSelection` preserves the selected format and checks the complete reference closure. Import and generic scan validation use it. `runtime-selection.test.ts` rejects missing hosts and duplicate bindings across bundles, while permitting legitimate cross-bundle references. |
| Scan skills prescribed legacy YAML and an unvalidated endpoint companion even for the new model.                | Explicit canonical/legacy routing, a native authoring guide and arbitrary-path `knowledge:validate` command. Existing application refresh remains separate.                                                                                                                                         |
| Ownership-based component splitting contradicted runtime identity; storage was described as outside components. | Canonical boundaries follow executable hosts and declared resources. Teams remain separate; stores and topics are component kinds.                                                                                                                                                                  |
| Candidate/unresolved or non-HTTP contracts could establish inbound REST exposures.                              | Exposed REST contracts must be source-declared HTTP contracts and match the registered route and execution host.                                                                                                                                                                                    |
| Interaction mode could contradict its effect; relabelling a blob write as consumption reversed the map edge.    | Mode/effect checks and consumption entry/topic/handoff rules reject that mutation.                                                                                                                                                                                                                  |
| Duplicate request parts and impossible transferred field paths could pass validation.                           | Contract parts are unique, absence cannot assert source/wire shapes, and closed schema paths reject nonexistent fields. Uncertain paths need explicit gaps.                                                                                                                                         |
| Unsafe relative evidence paths could produce misleading GitHub anchors.                                         | V3 validates host, owner/repository and relative source path structure. Generic source checks read the actual pinned file and reject ranges beyond its real final line.                                                                                                                             |
| Direct subscription queries lost their runtime host.                                                            | Entry resolution follows explicit consume bindings, including a source subscription without a matched publisher. Missing execution bindings remain unresolved.                                                                                                                                      |
| The contract inspector omitted recorded field nullability.                                                      | Nullability is shown separately from optionality.                                                                                                                                                                                                                                                   |

The independent scan also exposed missing native JSON constraints. Object `additionalProperties` and field
`const`/`enum` now preserve explicit declarations; conflicting constraints and non-object policies are rejected.
The inspector shows these restrictions separately from extraction completeness.

Subsequent real-source scans exposed consumers with no header filter and consumers checking only header
presence. Subscriptions now distinguish exact-value, presence-only, unfiltered and unresolved selection.
Header/body guards remain distinct; an unknown filter requires a gap and cannot establish a match. Source
JSON envelopes retain their outer event fields instead of substituting the generic inner payload. The
matcher still requires proven protobuf wire correspondence for cross-message handoffs; JSON correspondence
is not silently inferred.

EF source also exposed missing write modes. V3 now retains `update` and `delete` alongside insert/upsert/
replace; archived v2 remains unchanged. Publication and consistency-query regressions preserve the mode,
while the guidance distinguishes an awaited save call from proof that a matching row changed.

## Operational gates

Canonical authoring validates the whole selected set: references can legitimately cross explorer bundles.
The generic CLI verifies an existing manifest or creates a new immutable selection only after validation;
it refuses to replace an existing snapshot. `--sources` checks local Git objects without touching a running
service. Without it, the result explicitly says source verification was not requested. The validator writes
no database and does not alter production workspace files or scan marks.

Scanners also reconcile a discovered-entry inventory with native coverage records and exclusions. Schema
validation does not prove discovery completeness, control-flow feasibility, evidence relevance or deployment.
An `examined` coverage record applies only to its stated obligation and scope. Partial or unavailable code,
candidate dependency sources, formatter uncertainty and unknown destinations remain explicit gaps.

The original capture v1 and soft-offer v2 snapshots remain immutable and replayable. The current v3 bundles
also retain their content digests: this hardening changes validation and serving behaviour, not Volvo facts.
Enterprise-scale discovery, byte/time budgets, production persistence and application migration remain
separate adoption work.

## Verification

Focused mutation regressions cover the rejected invalid documents, snapshot import and multi-bundle closure.
CLI tests cover arbitrary paths, source ranges, snapshot replay and refusal to overwrite a prior manifest.
Both Volvo v3 bundles are checked through the generic CLI with all 90 pinned source ranges; both proof
walkthroughs are regenerated and visually inspected. Full lint, unit tests, checks and build gate hand-off.

The independent agent captured a synthetic 16-line Fastify endpoint from raw pinned source, with a branch,
an unavailable SDK and value mappings. Its eight query checks passed. The small worked example is retained
in `test/fixtures/knowledge/notification`; `source.bundle` contains the local Git objects, so source verification
runs offline. Its owner/repository is synthetic and does not identify a live GitHub repository.
`tools/scan-example.test.ts` checks its source ranges, runtime boundary, early return, response lineage and
native declared constraints. No Volvo identity or code was reused.

The `version_unresolved` query frontier remains a broad compatibility label for unresolved dependency
implementation/source correspondence. A declared package version may still be exact. Consumers must read
its detail and supporting gaps instead of interpreting the label as an unknown version string. The independent
capture retains that distinction. General query CLI ergonomics remain separate from the validated authoring
and API query contracts; the small example includes executable API acceptance tests.

The rescan also found in-process producer-future callbacks. Separate bound implementation graphs and
source-backed association claims preserve their registration and behaviour. They are not fabricated broker
subscriptions. Typed future-result transfer and automatic delegate dispatch remain a model boundary. Lexical captures and
receivers now have native invocation bindings; source associations still retain deferred registrations.
The broker continuation query does not reinterpret these registrations as message consumers.

Expanded captures are stored separately under `volvo-native-rescan`, with their own selections and coverage.
Original proof inputs remain immutable. The new capture view uses source implementation names and a
wrapping internal layout, so additional local modules remain visible without becoming extra components.

Real-source review found two further extraction errors that structural validation cannot detect: inner DTOs
used as whole REST response wrappers, and same-repository shared-module code described as unavailable.
Replacement captures correct the affected native shapes/return values or local traces. The scan guide now
requires separate factory-result lineage, correct cached whole-response boundaries and an explicit module/
symbol audit. Source method identities and native call frames remain distinct from UI inlining or bounded
source summaries. Initial selections are retained as historical baselines and labelled accordingly.

The method-boundary review then exposed a structural write-association gap: repository staging, database
I/O and acknowledgement can belong to different local methods. V3 now retains owner-relative call contexts
for those references and field values. Validation checks actual bound call steps, exact terminal ownership,
one common runtime component and identical effect/ack invocation paths. Unrelated sibling values and a
second save invocation cannot be substituted. New context references participate in supporting-record
closure and invalidation. Defaults preserve the original same-owner rule and archived v2 rejects the new
properties. The Volvo Fee/Brand captures exercise repository staging and real UoW save/return boundaries.

Whole-repository review exposed three further distinctions. Lexical captures now differ from actual source
formals, and ordinary instance receivers have their own binding. Both participate in native invocation-bound
value lineage, supporting records and dependency references. A captured object reference is not a copied
object, and neither binding provides automatic mutable alias analysis. Local non-awaited tasks fork their
control projection without letting child failure unwind into the caller; their returned handles remain
distinct from eventual results. Synchronous prefix and interleaving remain explicit uncertainty. Source
process/timer/startup/callback entries also have their own protocols, preserving strict REST validation.
[Invocation values and entry rules](lexical-captures.md) describe the contracts and regressions.

The scan guide now checks compiler recovery, receiver/import/signature correspondence, host-specific DI,
branch reaching values and complete top-level startup bodies. Recovered symbols can identify the wrong
overload when dependencies are missing. Full syntax traversal and valid source ranges are therefore not
claims of completed semantic review. Source-inspection coverage is tracked separately from deployment,
formal feasibility, heap-state analysis and automatic higher-order delegate dispatch. Exact source-backed
associations and transformations remain queryable even where the engine cannot mechanically join all of them.

Declaration facts now belong to their actual catalogue records, such as a shape, contract or source revision,
instead of an unrelated method used as an anchor. Record queries discover owned claims, coverage and gaps
under the existing pagination budget; related declarations remain separate from path-supported claims and
executed control nodes. Review also rejects an ambiguous-host interaction query as destination acceptance:
shared library code must be checked from an established endpoint or worker host.

Full-source review exposed an authoring collision that structural validation could not detect: a helper
reused the same key for an effect and interaction, silently omitting the latter. Native source methods then
had store effects but no runtime interaction edges, while historical summaries still contained edges.
The scan guide now requires unequal/cross-kind collision rejection, an I/O boundary reconciliation and
positive acceptance from current source roots. Zero-edge queries and old summary facts cannot satisfy this gate.
The same review distinguishes an Optional wrapper from a callback that really invokes a repository method
reference. Classification checks the actual source receiver/target rather than a generic graph label, with
negative cases for local mapper/configuration/result operations and positive conditional repository reads.

PSP source review also found a fluent-builder heuristic overriding a real local return declaration:
`StripeRequestOptionsBuilder.requestOptions` returns `RequestOptions`, not its receiver class. The scan guide
now gives source signatures precedence over builder/client naming heuristics and checks native result shapes
alongside exported argument-type ledgers. A plausible type name is not evidence of the transferred value.

The cross-capture audit then found synthetic values on source-known `void` calls. Optional native
`Implementation.returnKind` now distinguishes an immediate `value`, `void` or `unresolved` return. Validation
rejects a result at a bound void invocation and a value-return operation inside a void implementation.
Task/Promise handles remain immediate values even when their eventual completion has no value. Constructors
require separate allocation semantics; a new-expression result is not inferred to be a void constructor's
return. Archived schemas remain unchanged. Source audits also remove synthetic void expression/await values;
the new contract does not replace checking compiler/source correspondence.

Scheduler source exposed a separate write gap: a repository `save` has a known payload and normal-return
boundary while its insert/update/replace policy remains imported. `storage_write.mode: unknown` now retains
the structured staging, field and acknowledgement association without guessing that policy. It requires an
explicit gap. Source-established insert/update/delete modes remain specific; acknowledgement still does not
establish affected rows, durability or a wider transaction. Archived write modes remain unchanged.

CaaS source registers nine unary gRPC methods, rather than REST routes. Native `Entry.trigger: rpc` now requires
a `grpc` contract, `RPC` method and matching full `/service/method` address. It retains protobuf source schemas
and registrations without invented HTTP JSON interfaces. Source gRPC status/error values remain separate from
`Operation.httpStatus` and the HTTP outcome filter. Streaming policy is not inferred from unary registrations.

Independent Assortment review also distinguishes an internal processor entry view from an exposed
registration. An implementation query can reach Blob while the internal entry ID correctly reports an
unresolved exposure. Acceptance now names the exact root used and requires the actual exposed entry or
subscription when claiming registration-to-effect coverage. This avoids hiding a missing binding behind
an implementation-only positive result or counting processor views as extra broker registrations.

The first Go source passes retain returned error tuples separately from thrown exceptions. A normal Go
return can contain an error, so it cannot establish successful storage acknowledgement. Nil-error guards,
SQL operation results, commit return values and deferred rollback are separate source facts. Migration
DDL and source JSON tags establish intended stored representation, not the observed live schema.

Policy Admin exposed a known local Watermill transport that the old network/unresolved choice could not
state accurately. `Interaction.boundary: in_process` now requires the interaction target and contract to
name the execution host. Local consumption can use that host instead of an external topic; other
consumption still requires a topic. Strict synthetic publish/consume projections retain a same-host edge,
while foreign/null targets and non-local service consumption are rejected. Imported delivery policy and
actual callback scheduling remain separate. Existing v3 selections remain readable without rewriting them.

The same source review required first-class resource locality. Optional
`resource_binding.scope: in_process` binds real volatile storage/maps or local transport/channels to a
service/app, preserving storage/transport roles. Category validation rejects local resources on a separate
store/topic and rejects a local remote-interface role. Interaction effects must select a resource binding
with matching locality. Omitted scope retains existing category checks; immutable v3 inputs are unchanged.

Policy Admin's 5.9 MB stored fixture also exposed the source verifier's fixed output buffer: valid local
source was incorrectly reported unavailable. Pinned Git output now goes to an owned temporary file, is
checked in 64 KiB chunks and is removed afterwards. One validation run caches line counts and text checks
per clone/commit/path, rather than rereading a file for every evidence range. It retains inclusive line
bounds, binary rejection and offline Git settings. Regression checks cover files above the former limit,
CRLF and final lines, a late binary marker, empty files and the per-run cache. All 4,532 selected Policy
Admin source ranges now pass the native verifier; that check does not establish semantic completeness.

CDLS browser-to-API review exposed a caller/provider link that previously required both sides to share one
contract. `Interaction.targetEntry` now also accepts distinct caller-construction and source-declared
provider contracts when their component, protocol, non-null method and non-null path match exactly. This
applies to HTTP, HTTPS and gRPC addresses. Both contracts retain their own request/response schemas and
authority; the query returns the receiving entry binding and explicitly limits the link to source address
correspondence. It does not infer compatible payloads, deployed versions, gateway rewrites or provider
execution. Strict regression queries retain both sides across small supporting-record pages; candidate,
unresolved, mismatched and generic-library addresses cannot establish the link. Existing shared-contract
links and immutable captures remain valid.

The ongoing optimisation-facade review has exposed a further adoption gate: its generic dispatcher reads a
mutable, process-local registry keyed by the source query/response or command types, then invokes a handler
through a type assertion. The local dispatcher and concrete handlers are available. A shared `.Handle`
operation cannot safely acquire one concrete target across all its generic callers. The capture retains
the real map lookup, missing-handler branch and unresolved invocation, alongside exact source registration,
receiver, typed caller and formal/actual associations. Direct handler queries can establish their SQL work;
they cannot establish that a broad endpoint query traversed the dispatcher successfully.

The current query contract does not substitute a generic key or registry cell per invocation. This analysis
limit is separate from uncertainty about the registry's runtime contents. A future contextual binding must
retain the actual dispatch frame, caller/type/host scope, receiver and argument values, source conditions and
possible mutation; it must not bypass the lookup or turn a default registration into an unconditional target.
Until that contract is implemented and tested from actual endpoint roots, the frontier remains explicit.
These repository scans do not close that application-adoption gate.
