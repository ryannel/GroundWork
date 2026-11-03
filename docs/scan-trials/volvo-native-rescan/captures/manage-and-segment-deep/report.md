# Manage and Segment deeper capture

This capture reads `volvo-cars/popcat-manage-and-segment` at
`b3605063154f542ec1615d363ab858b86c743110` from pinned local Git objects. It replaces the added closure of the
previous report with a new revision namespace and preserves the original soft-offer proof’s 602 records
identically. It does not migrate the application or production workspace. Upstream freshness remains separate
from the available checkpoint and local commit.

## Depth and coverage

The census remains 100 controller registrations in 23 controllers and four operational middleware families.
Every discovery has an entry, HTTP exposure, runtime host and native coverage. The controller method ranges
were corrected to include the complete body: the previous parser could stop at a `Guid.Empty` guard.

| Controller routes | Capture depth                                                                                                                                           |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 11                | Representative native source-method call frames: all five Fee routes, all five Brand routes, and SoftOfferPackage GET with fallback                     |
| 1                 | Original immutable soft-offer POST proof retained with its existing scope and gaps                                                                      |
| 72                | Local source inspected; behaviour retained as source-backed summaries or bounded static/aggregation graphs. Native method decomposition remains partial |
| 16                | Available local behaviour not yet inspected in depth; opaque calls and explicit partial coverage retained                                               |

The 84 source-inspected routes must **not** be described as 84 complete native execution traces. The four
operational families remain partial. `depth-ledger.json` separates the categories and links retained summary
claims; `entry-inventory.json` reconciles all registrations. Summary claims can be retrieved through the native
records query; an opaque control graph does not imply an effect-free route.

The remaining 16 locally untraced routes are all five Mileage routes; PreOrder POST and PUT; Market PUT; and
POST/PUT for Cap, Jato, Natcode and Schwacke mappings. The source is available. These are outstanding authoring
work, not missing dependency source. The original census’s application listener/job exclusions still apply;
this pass does not claim to discover new deployed registrations.

## What the representative method frames establish

Native calls bind the real controller methods to their service methods, repository methods, UnitOfWork,
private notification helper, NotificationService and KafkaProducer. Context-specialised generic analyses keep
actual source-symbol identity. Formal arguments, returned `Result<T>` objects and typed return/exception exits
cross those calls; void Task calls have no fabricated return value. Smaller mapper, identity, protobuf builder
and HTTP-response helper bodies remain explicitly anchored summaries rather than fully decomposed methods.

Fee and Brand delete retain `FindAsync` → found/missing → repository staging when found → awaited
`CompleteAsync` on **both** paths. A missing entity can reach SaveChanges before returning404, but has no
asserted delete staging. `FindAsync` remains a logical EF lookup: the provider can return a tracked entity
without a physical database round trip.

Fee update retains the controller prefetch and `TryGetData` success test, route InternalId override,
preservation of the existing deterministic Id, repository existence check and update staging, awaited save,
post-save re-read, successful re-read guard, notification setting and publication branches. Published data
comes from the re-read entity, which can differ from the original input after an intervening writer.
SoftOfferPackage GET tries InternalId first and the same route Guid converted to DeterministicId only after
NotFound. Fixed GET authorisation context has no CheckAccess path.

Publication has its own real publisher frame and API runtime host. It is awaited, but a non-persisted producer
report is logged and still returns normally. Disabled notifications, unsuccessful refetch, null message/bytes
and exceptions remain distinct paths. Source-declared broker acceptance does not establish consumer execution,
delivery guarantees or downstream completion. No additional consumer handoff is invented.

The actual database interaction is `_context.SaveChangesAsync()` in UnitOfWork. It takes no entity argument;
its tracked context may contain changes or none. Entity staging, that store invocation and caller acknowledgement
remain separate source operations. Six new typed write associations cover Fee and Brand insert/update/delete. Each
uses a service-owned association, the actual repository staging operation through its repository call context,
and the actual UnitOfWork store effect and normal-return acknowledgement through the **same** save invocation.
The missing-row save invocation has no typed delete association. Source entity values use the caller context;
delete has no replacement fields. This must never be represented by moving a database interaction onto the local
zero-argument `CompleteAsync()` call in a service.

## Contracts and data

All 99 added controller success response cases now point to the **full** source envelope: Status, OperationId
and Data. A list envelope has a collection under Data; the inner DTO is not the entire response. Source
`Result<T>`, the response body and returned IActionResult/ObjectResult are separate values. The latter records
the declared constructor-body argument and StatusCode assignment; imported framework object internals are
not guessed. Delete returns `Result<Null>` internally while constructing the declared `SuccessResponse<Fee>`
or `SuccessResponse<Brand>` body with null Data.

Request/response, protobuf and persisted source schemas and field anchors from the previous capture remain
available. Effective formatter/model-version behaviour, imported AutoMapper conventions, identity helpers,
EF/provider behaviour, authentication enforcement, Kafka policy and deployment remain explicit gaps. No JSON
additional-properties policy or wire enum/constant is inferred from a list of extracted fields. Write
AuthorisationClient method bodies are currently an explicit local source summary, not a claim of fully bound
client call frames.

## Verification and replay

The selected snapshot is `9958d25719399c959ece547e827c4b7f92f853a983c8b2669f34e08ca6f7f0cc` and contains **5,555 records**. The adjacent `query-summary.json` records 23 passing native query fixtures. They
exercise all representative route families, delete404 save ordering, update/refetch, optional and non-persisted
publication, package fallback, response lineage through formal/return bindings, publication lineage to the
re-read entity, runtime interactions, consistency, retrievable summary claims and the original asynchronous
continuation. Assertions verify all entry/exposure/coverage pairs, all 99 added success envelopes and original
proof-record identity. No query hits its node/support budget; every response retains `exhaustive: false`.

The generic validator checks the selected bundle, reference/ownership/runtime consistency and 1,174 pinned
file/range anchors using local clones. File/range availability does not independently prove citation entailment
or extraction completeness. A separate source review checked the delete404, update/refetch, package fallback,
method/result ownership and response-wrapper boundaries. No Volvo application tests, runtime calls, broker/store
operations, fetches or deployment observations were performed.

Run from the Groundwork checkout:

```sh
npm run knowledge:validate -- reports/volvo-native-rescan/manage-and-segment-deep/bundle.json --snapshot reports/volvo-native-rescan/manage-and-segment-deep/snapshot.json --sources /Users/RNEL/.cache/groundwork/clones
node --import ./tools/register.ts --conditions=react-server reports/volvo-native-rescan/manage-and-segment-deep/acceptance.mjs
```

Select this replacement bundle rather than combining it with the older Manage and Segment added namespace.
Other captures can share the original 602 records identically; reconciliation must reject contradictory IDs
and avoid selecting two active revisions of the same added closure.
