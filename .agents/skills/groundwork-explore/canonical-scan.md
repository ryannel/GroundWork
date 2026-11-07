# Canonical repository scans

Historical reference for retained proof. For current workspace authoring, use the consolidated
[Groundwork schema](../groundwork-schema/SKILL.md) and [native scan](../groundwork-scan/SKILL.md).

Use this workflow to populate the current execution model. It writes v3 knowledge JSON, not the production
workspace YAML. Read `schema/knowledge.schema.json` for exact keys/enums and
`docs/scan-trials/runtime-components.md` for the accepted model and query contracts. Do not change the
application or the original Volvo v1/v2 snapshots while scanning.

## Inputs and outputs

The brief supplies a workspace ID, clone paths and full commits, the selected endpoint/repository scope,
existing logical IDs and related records, dependency/version information, and an output directory outside
production workspace files. Do not silently fetch a different revision to fill a gap.

Return immutable `groundwork-knowledge/v3` bundles, a `groundwork-snapshot/v3` manifest selecting them under
`knowledge-query/v3`, and a plain-language report. A bundle contains `format`, `workspace` and `records`.
The report includes a discovered-entry inventory and reconciles every registration with an entry record and
its coverage, or an explicit exclusion with a reason. Selected endpoint work must state that wider repository
discovery is outside scope. Unknown implementations are opaque boundaries with gaps, not empty handlers.

For a small, fully offline example, read `test/fixtures/knowledge/notification/bundle.json`, its adjacent
`snapshot.json` and eight `*.request.json` files. The 84-record capture describes a synthetic two-file
Notification API, an early return and an unresolved SDK call. Its `source.bundle` is a local Git bundle;
`github.com/example/notification-api` is synthetic provenance, not an actual GitHub repository. The reusable
acceptance queries and offline source verification are exercised in `tools/scan-example.test.ts`.

Use `docs/scan-trials/soft-offer-proof/runtime/bundle.json` with its adjacent `snapshot.json` as the larger
worked example: inbound REST, read/write, publication, subscription and asynchronous consumer, with native
runtime hosts, schemas and source anchors. The source-reviewed capture under
`docs/scan-trials/volvo-native-rescan/captures/payment-transaction-deep/` demonstrates available local shared
modules, outer REST factory results and unresolved SDK transport. The older capture v3 fixture remains
immutable historical regression input; its local-module/transport assumptions were corrected only in the
replacement selection. Read the relevant records; do not copy Volvo IDs or its investigated scope into another scan.

## Extract in dependency order

This is an authoring order, not a required physical record order. References must resolve across the selected
bundles before they form a usable snapshot.

| Establish                   | Native records and checks                                                                                                                                                                                                                                                                                        |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Source identity             | `source_revision` for each examined repository/commit; `evidence` for actual file ranges with host, owner/repo, full commit, relative path, inclusive lines and source/test-assertion basis. Never use a moving branch or a bare URL as authority.                                                               |
| Runtime identity            | `runtime_component` for running services/apps and store/topic/external boundaries, from entrypoints or declarations. Keep source declaration distinct from deployment. `execution_binding` binds each implementation to its host; `resource_binding` binds resources to storage, transport or remote interfaces. |
| Registration and interfaces | `entry`, `entry_binding` and `interface_contract` for effective method/path, runtime execution, request parts and response cases. Keep gateway rewrites and version negotiation separate unless established.                                                                                                     |
| Schemas                     | `shape` for source, constructed, wire and persisted representations, including nested fields, array items, nullability, explicit constraints, protobuf tags/reservations and field evidence. Contract parts distinguish present, absent and unresolved; partial closure is explicit.                             |
| Local logic and data        | `implementation`, `operation`, `transition`, `value`, `flow` and `resolution` preserve branches, exception exits, formal/actual arguments, transformations and result use. Each operation/value belongs to its actual implementation.                                                                            |
| Runtime interactions        | `interaction` binds the exact operation and execution host to a contract, destination or explicit unresolved target, waiting behaviour and request/response values. A known remote endpoint uses `targetEntry`; local helper calls remain inside the host.                                                       |
| Effects and writes          | `resource`, `effect`, `storage_write`, `consistency_boundary` and `milestone` retain selection/key, persisted shape, staging versus acknowledged operation, ignored failure results and failure windows.                                                                                                         |
| Asynchronous work           | `channel_binding`, `subscription`, `handoff` and `delivery_policy` keep producer acceptance separate from consumer invocation/completion. Establish channel/profile/message/schema compatibility; unknown delivery/retry/offset policy stays unknown.                                                            |
| Dependency authority        | `artifact`, `artifact_source_binding` and `resolution` separate requested/resolved versions from candidate code. Exact foreign-library implementation binding requires verified source correspondence and artefact digest; a nearby clone is a candidate.                                                        |
| Coverage and uncertainty    | `coverage` identifies an obligation, owner, examined scope and `examined`, `partial` or `not_examined` status; `gap` identifies the missing knowledge, reason, action and evidence. `claim`/`derivation` retain supported conclusions and their inputs rather than inventing facts.                              |

Read [endpoint-flow.md](endpoint-flow.md) for acceptance questions applying to these records. Its companion
YAML is only the legacy projection; canonical scans retain control and data natively.

## Identity, evidence and closure

- Reuse logical identities before minting new ones. A runtime component follows its declared executable/host
  or resource identity, an entry follows its component/protocol/method/path, and an implementation follows its
  source symbol. Team and domain/system membership never define these technical identities. Record IDs name
  immutable revision facts; use a revision namespace, preserve `logicalId` where the concept survives, and
  update all references when creating a replacement revision. Never rewrite an already selected bundle.
- Keep repository host separate from owner/repo in evidence. GitHub.com clones live at
  `<clone-root>/<owner>/<repo>`; other hosts use `<clone-root>/<host>/<owner>/<repo>`. Evidence refers to files
  read with `git show <commit>:<path>`, not uncommitted working-tree contents. Source links are derived.
- Source evidence establishes the claim it actually supports. Reading tests supports `test_assertion`; it
  does not prove execution. Report executed tests and runtime observations separately. Never call live
  endpoints, stores or brokers merely to complete extraction.
- Expand referenced/inherited/generated schema definitions to the representation being claimed. An empty
  subclass is not an empty payload. Preserve source DTO/construction separately if effective formatter or
  imported fields are unknown. Attach a gap instead of labelling a guessed wire shape complete.
- Capture explicit source-declared constraints natively: an object shape with `container: object` may carry
  `additionalProperties: false` or `true`; fields may carry scalar `const` (including null) or a nonempty,
  unique scalar `enum`. Cite the declaration or construction that establishes the constraint. A closed
  extraction or a list of known fields does not establish an additional-properties policy; a runtime value
  observed once does not establish a constant or an exhaustive enum. Apply source constraints to the source
  representation unless their effective wire enforcement is established.
  In source schemas, retain an explicit closed enum or scalar literal union in native `enum`, an explicit
  nullable union in `nullable`, and known array element structure through array/item shapes. A human-readable
  `type` string supplements these fields; it does not replace queryable constraints. Constants discovered
  beside an open type do not establish an exhaustive enum. Optional fields and nullable fields are distinct.
- Preserve source expressions/guards, conditional omission and actual transferred values. A contract schema
  alone does not establish value lineage. Do not infer every possible response from the happy path.
  Object spreads copy properties from their actual operand; computed keys evaluate an expression. Do not
  turn spread syntax/positions or bracketed source text into fixed schema field names. Retain operand/key
  values and source associations, with partial/open shapes when their resulting fields cannot be established.
  Compile-time type operands such as Go make/new types are not runtime value evaluations or missing bodies.
- Keep local/library calls in the caller's execution context. If reusable code has several hosts, bind its
  invocations explicitly. Call-site `interaction` host, owner, operation, effect/resource, target and contract
  must agree. Candidate source cannot establish a runtime destination or cross-source implementation.
  An HTTP client/transport wrapper is not its remote destination component. A real network invocation with
  unresolved request destination retains a null target; do not invent a service for the local client chain.
  Where local callers establish method, path, query, headers or body construction, retain those source
  contracts and actual values separately from a reusable transport's generic contract.
- Link an outbound `targetEntry` only to an actual exposed entry. A caller-construction contract and a
  source-declared provider contract may remain distinct when target component, protocol, non-null method
  and non-null path match exactly for HTTP, HTTPS or gRPC. Preserve both schemas and source authorities;
  an existing shared contract also works. A similar name, candidate address, generic SDK signature or
  assumed rewrite cannot establish this link. Test that the query returns both contracts and the provider
  entry binding through normal supporting-record pagination. Address correspondence does not prove payload
  compatibility, deployed version correspondence or execution of the provider inside the caller's trace.
- Reconcile shared source/component/resource discoveries across explorers before snapshot publication. Reuse
  one logical identity when evidence proves it; do not merge by similar names. Conflicting revisions or
  assumptions need an explicit resolution or gap. References can cross bundles, so validate the full selected
  set, not an explorer's intentionally incomplete fragment in isolation.
- Include all referenced shapes, values, evidence, gaps, bindings, artefacts, subscriptions and continuation
  records in the selected closure. Incomplete extraction must retain its boundary, not a dangling reference.
  A consumer is a separate execution context: its failure cannot unwind into its producer's HTTP request.

Claims, coverage and gaps for non-executable declarations belong to their actual source revision, artefact,
shape, resource, runtime component, interface contract, channel binding or subscription. Do not attach an
OpenAPI/type declaration to an unrelated method merely to obtain an owner. A records query for a known
owner discovers its related facts under normal pagination; supporting declarations do not assert execution.
For shared code, an ambiguous-host interaction result is a limit, not a successful destination check. Verify
actual interactions from endpoint or worker roots with established execution bindings.

For a source-proven process-local transport, use Interaction.boundary: in_process and target the
interaction's exact execution component; the interface contract must name that same host. Local
publish/consume stays separate and can project a self-edge without inventing a remote service or broker.
A local consume still belongs at the actual consumer implementation entry. Preserve actual source
registration/instance associations and imported delivery/acknowledgement gaps. Foreign or null targets
cannot be marked in_process; an unknown imported library is not automatically proven local.

Real volatile maps and local channels may use resource_binding.scope: in_process with storage or
transport role on the executing service/app host. Do not invent a separate database/broker component.
Omitted scope retains existing store/topic category rules, and remote_interface cannot be process-local.
An effect-bearing local interaction must match the resource binding's locality, role and exact host;
a network interaction cannot select the local binding. Retain actual data schemas, field/key values and
source acknowledgement separately from persistence or delivery guarantees.

## Source objects and wire values

A known SDK argument is not automatically an HTTP body. In the small example, `client.send({ to, content })`
establishes a constructed object but not the SDK's transport, serialisation or destination. Its caller contract
retains that object as `sourceShape`; the possible body has `presence: unresolved`, `shape: null` and a gap.
The interaction maps the whole argument with `requestBindings[].part: selection`, an empty path and a
transformation explicitly saying that wire placement is unresolved. `responseBindings[].part: result` maps
the SDK's returned object; subsequent value flow selects `result.id`. Use `body`, `headers` or other wire parts
only when that placement is established. Likewise, preserve constructed response objects under `sourceShape`
when the framework's effective response wire representation remains unknown.

A configured SDK purpose does not establish a remote call at each invocation. Flag evaluation, cached
reads and other imported library calls may run locally. If the selected dependency body or protocol
construction does not establish the remote effect, keep interaction.target, interaction.effect and the
caller contract component null, with a specific library-boundary gap. Retain the actual source invocation,
arguments, result and separately grounded configuration declaration. Add a negative acceptance query
ensuring that this call does not appear as established remote reachability.

For an unavailable multi-argument SDK signature, retain every actual argument, its position, source value
and established source shape. One caller contract may use an explicitly labelled source call-signature
projection with indexed `argument0`, `argument1` fields and matching request-binding source paths. This is
neither an allocated runtime object nor a wire body. Keep the exact actual values in the bindings and a
source-owned claim establishing index order; do not invent unavailable callee formals or discard all but
the first argument's schema. Each argument's imported/declaration uncertainty remains explicit.

## Source method and response boundaries

Keep source-local method identities and formal/actual argument contexts when expanding a route. Bind the
controller, service, repository, mapper and publisher implementations to their actual host; connect them
with native resolutions and call bindings. A UI may inline those calls as a projection. Do not put service
or repository operations under a controller implementation merely to generate a larger route graph. If a
bounded analysis deliberately summarises a helper, retain its source boundary and partial coverage instead
of claiming that helper has a complete per-method trace.

Read complete method bodies with language-aware or brace-aware extraction. A regular expression that
stops at the first closing brace can miss all logic after an early guard. Check evidence ranges against
later branches, returns and exception handlers before describing a method as inspected; a valid line range
does not establish a complete body or a correct parse. Retain parser limitations as partial coverage.

Reconcile declaration identities before generating records. Name and signature alone can collide: Go permits
multiple package `init` functions. Include pinned path and source offset where needed, assert source-index
cardinality, and retain each actual declaration. Package initialisation follows all imports of the package,
not just imports in the file containing the selected constructor; keep those startup bindings separate
from ordinary host-specific handler activation.

For Go range statements, establish the source collection kind before assigning yielded types. Slice/array
indices, map keys, channel elements and integer iteration differ; a single channel variable receives an
element, not an index. Resolve available local aliases and source constraints. If an imported return type
remains unknown, keep the yielded type unresolved rather than defaulting it to int, even for a blank name.

Syntax trees and compiler symbols are extraction aids, not completed semantic review. Missing dependencies
can produce a wrong recovered overload rather than an unresolved symbol. Check receiver declarations,
namespace/module imports, source signatures and host-specific DI before binding targets; a highest overload
score or unique short type name is insufficient. Evaluate branches with separate reaching-value environments
and join their possible definitions explicitly; do not let a then-branch assignment become the else-branch input.

Source-declared return types take precedence over naming heuristics. A local class ending in `Builder`
may return a different object, and a class ending in `Client` need not return an HTTP wrapper. Resolve the
actual local signature before applying fluent-builder or client-result inference; unknown imported SDK
methods remain unresolved where their type is not established. Check both native result value/shape and
exported argument-type ledgers against source, including overloaded request-options helpers.
A source-known `void` invocation has no result value or returned-receiver flow. Preserve its actual mutations
and side effects separately; a fluent naming pattern cannot create a return value.
Use optional `Implementation.returnKind: value | void | unresolved` for the immediate source invocation
return; omission is unresolved. Populate it from established signatures and validate all bound calls and
return operations. Also audit unresolved calls against available local interface methods and function-type
declarations: a known void signature forbids a result even when dispatch cannot bind an implementation.
Retain that signature evidence separately from the unresolved execution target. Task/Promise handles are `value` even when their eventual completion is void. Do not
mark a new-expression result void: model allocation separately from constructor execution or retain that
specialised return boundary as unresolved. Source-typed void expression/await nodes also have no value.
Treat annotations as declarations rather than runtime validation. In dynamic languages, inspect actual
return expressions: a Python -> None annotation does not erase an explicit returned object. Retain such
source conflicts and distinguish an immediate coroutine/task handle from its eventual completion value.

Keep lexical captures distinct from actual source formals. An implementation may declare `captures` as values
with `role: capture`, owned by that implementation and defined at its entry. A proven invocation supplies
`captureBindings: [{capture, value, mode}]` in addition to ordinary formal bindings. Bind all target captures
exactly once to caller-owned origins. `mode: value` copies the variable value, including an object reference
without copying the object; `reference` aliases its variable cell; `unresolved` establishes neither. Java
object-reference locals are still captured by value. Do not infer mutable alias effects from either mode.
Captures do not establish invocation policy: keep deferred/unknown registrations as separate implementation
associations with gaps, rather than inserting eager calls while a delegate is constructed. A source-proven
conditional callback invocation needs its own guarded path, true formals and invocation-bound lexical origins.

Ordinary instance receivers are not lexical captures or fake formal arguments. Use optional
`Implementation.receiver` for an own `role: receiver` value defined at entry, and `Operation.receiver` for
the caller-owned actual object. A bound receiver-declaring target requires that actual; a bound static target
rejects one. Unresolved calls may retain an actual receiver without establishing a callee. Instance method
references use this receiver once invocation is proven; lambdas capture an enclosing `this` lexically. Receiver
lineage does not establish mutable alias updates or the runtime dispatch of a delegate passed through a helper.

Keep factory results distinct from their arguments. `SuccessResponse.ok(dto, operationId)` returns an outer
response, not the DTO. Preserve the declared outer source type, an explicit factory-result value and lineage
from the DTO and operation ID; the inner DTO remains a nested argument/projection. If the imported wrapper
implementation is unavailable, use an explicitly partial outer source shape and unknown wire shape. Partial
prose beside a DTO-shaped whole response does not correct the native type. Check cached and uncached return
paths against the same declared whole-response boundary. Apply the same rule to HTTP clients returning a
generic response wrapper: `getData()` selects its inner value, rather than relabelling the entire response.

## Source entries and local waiting

Use optional `Entry.trigger` to distinguish `rest` (the legacy default), `process`, `schedule`, `startup` and
`callback`, and `rpc`. Non-REST bindings require matching source addresses and protocol/method pairs: `process/PROCESS`,
`timer/SCHEDULE`, `lifecycle/STARTUP`, `callback/CALLBACK`, and `grpc/RPC`. Keep HTTP rules strict for REST. A Program/main
source frame does not need an invented HTTP interface; registration does not establish runtime activation.
Message consumers still use subscriptions, and framework callbacks are not ordinary controller calls.
An imported annotation/decorator policy remains a declared association outside the annotated method.
Keep its expression, argument names and known local policy body queryable, with a separate declared callback
entry when enforcement is opaque. Do not invent controller guards, error branches, eager calls or extra
formals supplied by an unbound framework. A capture-specific source profile may bind an actual wrapper's
source-defined body; it cannot supply a missing framework implementation.
A gRPC entry uses its generated `/fully.qualified.Service/Method` address, source registration and protobuf
request/response declarations. Do not label it REST or infer an HTTP JSON body. Retain source error/status
values and claims separately; gRPC codes are not `Operation.httpStatus`, and the current HTTP outcome filter
does not establish gRPC status semantics. Streaming policy needs its own source evidence and explicit limits.

A call can retain `waitsFor: return | await | none`. Use `none` only when source establishes a non-awaited
local task. Its possible child work and immediate caller continuation are separate; child faults cannot
unwind into the caller catch path. Queries retain unresolved synchronous-prefix/interleaving semantics.
Do not map a returned task/handle to the callee's eventual result. Keep the ignored task distinct from a
callback's separately returned completed task. This is not a broker handoff or a proof of task completion.

Source review need not prove every heap-state version or path feasibility. Preserve actual mutations,
receiver/capture identities, directly supported field transformations and exact native claims/derivations
linking their inputs to later reads/writes. Distinguish an engine's inability to join a higher-order delegate
or mutable alias automatically from unexamined code. Known local bodies and caller/formal/callback/capture
associations must still be inspected and queryable; a generic opaque summary is not that analysis.

## Write intent and acknowledgement

Use the actual `storage_write.mode`: `insert`, `upsert`, `replace`, `update` or `delete`. An update is not
necessarily a complete replacement; a deletion does not construct a replacement document. Preserve
selection keys, field changes and source operation conditions. A normal `SaveChangesAsync` return records
the awaited save boundary; it does not prove a row existed, an affected-row count was checked or a wider
transaction committed. If code calls save even when no entity was removed, retain that branch and its
later not-found result without claiming a successful deletion. Do not rename update/delete as replace just
to fit a schema. Keep actual store mutation, response decision and publication acknowledgement separate.
When a write call and its payload/acknowledgement are source-established but its insert/update/replace
policy is not, retain the association with `storage_write.mode: unknown` and at least one explicit gap.
Do not drop the structured write association or guess upsert from a method named save. Keep established
source intent specific, and retain the real normal-return boundary without promising mutation or durability.
For languages returning errors/results as ordinary values, normal return alone does not establish success.
Retain the exact error/result guard and use success_result only where source establishes that acknowledgement.
Keep individual SQL/queue insertion success separate from outer transaction commit and deferred rollback;
source migrations describe intended tables/indexes/cascades, not an observed live schema.

For statically available SQL, map each INSERT column or UPDATE assignment to its actual source operand
in storage_write.fields; retain WHERE/conflict key operands in effect selection and a source-owned
column association. An ordered SQL argument tuple alone is not field lineage when its mapping is known.
Inspect local tuple helpers and comprehension/append construction. Reuse actual element values or label
exact indexed source projections with helper evidence; dynamic SQL or unavailable tuple contents retain
specific gaps. Test a persisted-column value query as well as the aggregate driver-call argument.

## Cross-method staging and save

When one method stages an entity and another calls the database, keep the I/O interaction at its actual
source operation. A zero-argument UoW `CompleteAsync()` call does not receive an entity argument merely
because its caller has one. `storage_write` can retain the orchestration association with optional
`effectContext`, `stagedContext` and `acknowledgedContext` call-operation vectors rooted at its `owner`.
Compose these relative paths with the owner's enclosing query invocation. Omission means the same owner,
not an inferred call. Each step must name an actual call with a bound local/verified target, and all frames
must share a runtime component. A handoff or unresolved/candidate call cannot establish this association.

Use actual repository staging and UoW database-effect/normal-return operations. Effect and acknowledgement
contexts must identify exactly the same invocation; two calls to the same UoW method are not interchangeable.
`fields[].context` may select a value in the root or an ancestor frame of staging/effect, never an unrelated
sibling call. Preserve normal call argument/result flow; do not fabricate UoW parameters. A missing-entity
branch can still call save without a typed deletion association. Valid paths establish source context, not
automatic stage-before-save feasibility, affected rows, a transaction or durable publication. Those claims
still need control conditions, concrete source evidence and explicit gaps.

## Consumers and generic payloads

A subscription need not have an exact type-header filter. `headerFilter` is `equals`, `present`, `none` or
`unresolved`; omission preserves the earlier exact-header convention. `equals` requires `header` and
`messageType`; `present` requires the header name but a null message type. `none` and `unresolved` use null
for both, and unresolved filtering requires a gap. No header filter does not remove body guards, feature
flags or parse failures from the implementation. Keep those conditions in control records. An unmatched
producer handoff does not prevent capturing a source-declared subscription and its explicit consume execution.
When one consumer subscribes to several topics and dispatches only by a type header, keep that topic set
separate from its handler registrations. Do not pair event types to topics by name. If the schema needs
one binding per record, label topic-by-handler combinations as derived source associations and count
actual source registration calls separately; they are not extra observed consumer instances.

Preserve generic envelopes: `KafkaEvent<Classification>` is an EventType/Data envelope containing a
Classification, not the Classification itself. Resolve local generic/positional declarations and nested
payloads. Keep source names and enum declarations separate from effective JSON names and converter defaults;
unknown wire behaviour remains a gap and a source schema, never a guessed complete wire body.

Before declaring an imported implementation unavailable, search all source modules in the pinned repo and
check project references. A namespace or module boundary does not establish a foreign library or a network
call. Code found in a different repository still needs exact artefact/source correspondence before execution
is bound; source proximity and matching class names are insufficient.

## Resolve local modules before unavailable-source claims

Inventory source files and project/module references across the entire pinned repository before treating
an imported symbol as unavailable. Package imports do not distinguish another local module from an
external artefact. Reconcile unresolved implementations, inherited DTO bases and exception/status classes
against that inventory. Keep a symbol-resolution audit in the report: named symbol, local searches/module
references, resolved path or exact external dependency, and the remaining correspondence gap. Recheck this
audit before publication; a successful schema/range validation cannot detect a false unavailable-source
claim. Generated source and unresolved dependency versions remain explicit when they cannot be established.

## Validate and publish

Run from the Groundwork checkout. The validator reads arbitrary bundle paths, checks schema/semantic
references across their combined selection, and writes no database. Add `--sources` to verify the pinned
local files and ranges; this does not prove a citation supports its claim or that the code is deployed.

```sh
the historical bundle validator -- /path/to/bundle.json --sources /path/to/clones
the historical bundle validator -- /path/to/producer.json /path/to/consumer.json --write-snapshot /path/to/new-snapshot.json --sources /path/to/clones
the historical bundle validator -- docs/scan-trials/soft-offer-proof/runtime/bundle.json --snapshot docs/scan-trials/soft-offer-proof/runtime/snapshot.json --sources /path/to/clones
```

To run the small example without private repositories or network access:

```sh
example_root=$(mktemp -d /tmp/groundwork-scan-example.XXXXXX)
mkdir -p "$example_root/example"
git clone test/fixtures/knowledge/notification/source.bundle "$example_root/example/notification-api"
the historical bundle validator -- test/fixtures/knowledge/notification/bundle.json --snapshot test/fixtures/knowledge/notification/snapshot.json --sources "$example_root"
npx vitest run --project unit tools/scan-example.test.ts
```

Use either `--snapshot` to verify an existing selection or `--write-snapshot` to create a new one. The latter
refuses overwrites. Keep prior bundles and manifests available; a snapshot selects exact content digests.
Do not advance legacy workspace scan marks or claim production YAML now contains the new records.

Authoring IDs must distinguish record kinds. Reject an ID collision with unequal facts or another kind;
never silently return an existing effect when an interaction was requested. Reconcile each examined source
I/O boundary with its native interaction/effect, runtime execution, actual values and intended configured
target, or a specific unresolved-boundary gap. Acceptance must positively inspect the new endpoint/worker
root for each boundary family. Classify the actual invocation receiver and method, not a nested receiver
expression containing a repository/client call. Optional wrappers, mapper conversion and result projection
are not extra network calls; an invoked repository method reference inside an Optional callback is a real
conditional read/write. Inspect the callback target rather than its generic graph label. Check negative
local-call cases as well as positive I/O cases.
Retained historical summary interactions cannot satisfy that check. A valid
bundle and successful query with zero edges do not demonstrate that outbound calls were captured.
Use the actual exposed entry or subscription ID when claiming registration-to-effect query acceptance.
An implementation-root query demonstrates that bound local body's behaviour; it cannot stand in for a
missing entry exposure. If an internal processor view has no exposure binding, retain that diagnostic and
query its implementation separately. Label the distinction and do not count the view as another broker
registration or claim its unresolved entry query passed.

Acceptance harnesses must schema-validate every query request and response, including continuations,
using knowledgeValidators before/after queryKnowledge. A direct internal API call can produce a graph
from a malformed request and is not query-contract acceptance. Use maxNodes<=2000, maxRecords<=5000;
non-value queries require representation: constructed. Follow nextRequest without widening its budgets
or association scope. Keep prototype assertions separate until they replay through those strict checks.

Structural validity is one gate. Review the inventory and each endpoint obligation too: registration,
authentication/middleware, branching/exceptions, values across calls/storage/returns, response use, write
acknowledgement, asynchronous continuation, configuration, dependency correspondence and invalidation inputs.
An `examined` obligation only describes its stated scope. A scan containing partial or unexamined obligations
can be a valid snapshot, but cannot be reported as complete behavioural coverage.

For the existing Volvo examples, `npm run proof:capture` and `npm run proof:soft-offer` exercise the saved
interaction/control/value/continuation queries and component-first walkthroughs. Those commands do not
accept arbitrary new repository captures. For another scan, review equivalent queries through the knowledge
query APIs or add explicit acceptance fixtures; do not present a Volvo replay as validation of new facts.

Report evidence checks, native validation and acceptance queries separately. Include discoveries, excluded
scope, unresolved boundaries, schema completeness, artefact mismatches, tests read versus executed and the
next examination each gap needs. Incremental scans must follow helper/configuration/schema/library inputs
into affected analyses. When dependency closure is unknown, re-explore conservatively; unchanged cited lines
and a moved repository mark cannot prove unchanged behaviour.

When reading offline pinned Git objects, set GIT_NO_LAZY_FETCH=1 and GIT_TERMINAL_PROMPT=0 on every
subprocess. An available commit/tree does not prove all promisor blobs exist locally. Inventory required
blobs separately; missing objects remain explicit source gaps rather than triggering implicit downloads.
