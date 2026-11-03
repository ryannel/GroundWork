# Manage and Segment source capture

This revision captures the available local source of `volvo-cars/popcat-manage-and-segment` at
`b3605063154f542ec1615d363ab858b86c743110`. All 100 controller registrations now enter their actual source
methods. The source review covers local controllers, services, repositories, model and identity helpers,
mapping declarations, UnitOfWork, notification/builder/producer code, authorisation clients and handlers,
configuration/startup, middleware and the 25-file VersionHandling module. There is no local message consumer
implementation; the retained historical consumer belongs to the separately pinned Assortment source.

The bundle has 123,231 records and 1,484 source method contexts, including concrete generic contexts and
separate lambda bodies. These are inventory counts, not a completeness argument. The review follows the
actual CRUD families and their variations, source registrations, source mutations, return envelopes,
conditional publication, failures and exceptional regions. `depth-ledger.json` records all 100 routes and
recomputed accepted local call reachability after the reviewed replacements. No available local module is
classified as unexamined. Native mechanical execution/value proofs remain partial for the reasons below.

## Source behaviour

Calls have actual method owners, real formals, caller actuals and separate return values. Ordinary instance
receivers use native receiver bindings. Lambda formals and lexical captures are distinct: captured outer
`this` is projected into fields at invocation, rather than inventing a frozen field copy at registration.
Registration is an association; it does not eagerly execute callbacks. Local delegates/Result callbacks,
deferred LINQ, AutoMapper callbacks and framework dispatch retain explicit invocation/capture correspondence
frontiers where the exact invocation frame is not established. Their available bodies remain inspected and
source-owned, rather than being described as unavailable external code.

Meaningful source guards and mutations include the four mapping services' Market validation, Mileage's
non-commercial service/repository family, Market's Name/Languages-only update, PreOrder's preserved identity,
code and requirements on update, and SoftOfferPackage's InternalId/DeterministicId fallback. Selected message
builder contexts retain only their actual source case. SelectionCategory and SkuCategory have no builder
case and do not enter KafkaProducer. CustomerType has Created/Deleted cases, but no Updated case.

UnitOfWork.CompleteAsync has zero parameters. The store effect belongs to its actual
`_context.SaveChangesAsync()` operation. The 57 typed write associations identify the repository staging
operation, the actual UoW invocation and acknowledgement through the same invocation context. Missing
Update/Delete can still call SaveChanges; they do not establish staged entity writes. EF lookups are logical
reads: FindAsync may return tracked state. No guaranteed round trip, affected-row count, transaction across
publisher/store calls or downstream completion is asserted.

Source HTTP response helpers keep Result, complete Status/OperationId/Data envelope, and ObjectResult distinct.
The imported ObjectResult.Value implementation and imported mapper output are not inferred from constructor
arguments. Local response statuses, success/list/null-data branches and errors are explicit. Source HTTP client
request messages are distinct from their eventual wire body and decoded response DTOs.

Auth review retains the exact null behaviour of `!res?.allowed ?? false`, GET/disabled skips, the startup
helper's ignored bool and caught errors, and source JWT parsing without a signature-validation claim. Token
cache/expiry behaviour includes the discarded DateTime.AddSeconds return. Source token request cleanup and
Program pending returns/errors run through explicit finally paths. Program is a process entry for actual
top-level statements, not a fabricated declared Main. Registered framework callbacks are separate native
callback entries. RequestResponseLoggingMiddleware is available source but is not the installed logging
middleware. Version selection gives Accept precedence over Content-Type; the local formatters, filters and
406 result remain source-owned, including the non-awaited response write.

## Coverage and proof limits

Pure expression syntax is compressed into values at consuming source operations. Source declarations,
getters, logging, schemas and unused library bodies remain provenance/inventory; they are not all expanded
into a separate user-facing execution step. Migration history/schema snapshots and 72 test files are explicitly
classified in the 462-file ledger. Tests are not runtime entries and were not executed.

The offline reference-only Roslyn analysis reports 1,670 diagnostics because exact foreign packages/generated
protobuf and the target runtime are unavailable to that analysis. It is not an application build. Recovered
symbols are candidates until source receiver/type, namespace, arity, generic argument count, overload and DI
family checks establish the local target. `symbol-resolution-audit.json` includes syntactic Invalid calls as
well as returned symbols. No retained executable local candidate remains unresolved; that audit is not a
claim that compiler recovery proves all possible dispatch. Foreign implementation/transport behaviour,
runtime profile/topic selection and framework scheduling remain external boundaries.

Source inspection and native proof closure are separate. Mutable alias/heap state, guard feasibility,
implicit imported exceptions, complex filter/finally transfer and exact delegate/capture invocation origin
are partial mechanical proofs. Explicit source mutation/field-transform claims and mapper/save contexts are
retained; inspected mutations are not marked unexamined merely because the query engine does not solve heap
SSA. Every query remains non-exhaustive and reports its own frontiers and budgets.

## Selection and verification

`validation.log` verifies the v3 bundle, references, ownership, receiver/formal bindings and 6,638 pinned source
ranges. `query-requests.json`, `query-summary.json` and sampled `query-results.json` replay every controller
route plus startup/callback, outcome, value, effects, consistency and special variation queries. The original pack retains 58 maxRecords limits as historical evidence. After the coordinator narrowed
revision-wide related-fact discovery, `query-replay-002/` replays all 153 queries with zero limits; source
bundle and snapshot are unchanged. Every query still remains non-exhaustive. No app build/test, fetch, live API, broker or store operation was run.

The previous deep snapshot remains immutable at
`9958d25719399c959ece547e827c4b7f92f853a983c8b2669f34e08ca6f7f0cc`.
The 602 historical shared records remain supporting scope in this replacement bundle. Four records deliberately
change: `s2/endpoint`, `u3/exposes/soft-offer` and the two historical coverage records. The existing natural
POST `/api/commercial-items/soft-offers` entry is rebound to its actual source method; no duplicate current
POST registration is added. The old original proof itself remains frozen outside this selection.
`supersession-overlap-ledger.json` gives exact before/after records, old/new entry owners, actual entry bindings,
and every direct dependency on shared historical records. New native graphs do not directly reference old
summary operations, method graphs, handoffs or subscriptions. Historical valid SoftOffer correspondence is
preserved; generic publishers are not joined to it by name similarity. Combined selection must choose these
authoritative replacements deliberately rather than concatenate conflicting copies.

Sealed native manifest: `snapshot.json`, ID
`42b83383c124f0eed1b45a578d77700adb7a7a33115fe46e20b41f0d52af25b2`.
