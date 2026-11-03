# Final capture now available

The unfinished handoff below is historical. The sealed capture is described in `report.md`, with
`bundle.json` and v3 `snapshot.json` (`42b83383c124f0eed1b45a578d77700adb7a7a33115fe46e20b41f0d52af25b2`).
Validation checks 123,231 records and 6,638 pinned ranges. Current replay is `query-replay-002/`: 153 queries,
zero limits. Source review and partial runtime/mechanical proof closure remain distinct. See the exact
`supersession-overlap-ledger.json` before combining historical shared records with another capture.

---

# Manage and Segment complete-pass handoff

Checkpoint requested by parent to switch all parallel work to Sol with Medium reasoning. **Stop this explorer
here; this directory is an unfinished draft and has no bundle or snapshot to promote.**

## Authorised task and scope

Finish this repository before moving to another: all 100 controller routes, all reachable local methods,
request/response/message/store schemas and mappings, auth/client/formatter/middleware bodies, source runtime
entry/effect census. Distinguish imported/runtime unknowns from local authoring gaps. Actual source ownership,
formal/result bindings and invocation-context storage writes are required. No production app/workspace/source
edits, fetches, application tests, live runtime/broker/store calls or subagents.

Repo: `volvo-cars/popcat-manage-and-segment`.
Pinned commit: `b3605063154f542ec1615d363ab858b86c743110`.
Clone: `/Users/RNEL/.cache/groundwork/clones/volvo-cars/popcat-manage-and-segment`.
Output scope: `reports/volvo-native-rescan/manage-and-segment-complete/**`.
Read current `.agents/skills/groundwork-explore/canonical-scan.md` and source-method/cross-method write sections.

## Stable previous inputs

`reports/volvo-native-rescan/manage-and-segment-deep/{bundle.json,snapshot.json,report.md,depth-ledger.json}` is
selected, immutable and independently reviewed. Its snapshot is
`9958d25719399c959ece547e827c4b7f92f853a983c8b2669f34e08ca6f7f0cc`.
It has 5,555 records, 1,174 verified ranges, 23 passing queries, 11 native representatives (Fee5, Brand5,
package fallback GET), original proof1, 72 source-inspected summaries and 16 locally untraced routes. The user
explicitly says that this breadth/slice coverage is insufficient. Do not call the current repo complete.
Previous original broad capture is `reports/volvo-native-rescan/manage-and-segment/` (3,546 records), whose
scripts extract DTO/proto/persisted structural metadata. Preserve all prior inputs unchanged.

## Files created in this unfinished draft

- `generate.py`, `bound-flows.py`, `static-flows.py`, `check-records.mjs`: copies of deep-pass scripts.
- `generate.py` changes namespace from `masdeep-b360506/` to `mascomplete-b360506/`, removes the final original602
  equality assertion, and tries to execute **missing** `complete-flows.py` after the old bounded pass.
  It is not runnable until that file/workflow is implemented. Other copied scripts still only produce the
  previous representative coverage. They are scaffolding, not completion evidence.
- `Extract.cs`: an offline Roslyn syntax/semantic/CFG extractor built against the installed .NET8 SDK.
  It does not execute repository code. It currently inventories all declarations, source type members,
  calls, source formal arguments, source locations and compiler basic blocks/branches/regions.
- No canonical bundle/snapshot generated in this directory yet.

## Temporary reusable compiler/source artefacts

- `/tmp/mas-complete-source/src/**`: all 390 C# files copied with pinned `git show`; original clone untouched.
- `/tmp/mas-extractor/Extract.dll`, runtimeconfig and Roslyn DLLs: compiled `Extract.cs`.
- `/tmp/mas-extractor/compile.rsp`: compile command response file, references .NET8 reference assemblies and
  `/usr/local/share/dotnet/sdk/8.0.203/Roslyn/bincore/Microsoft.CodeAnalysis*.dll`.
- `/tmp/mas-extractor/references.txt`: .NET8 Core/ASP.NET reference assemblies for analysis only.
- `/tmp/mas-complete-semantics.json`: current large extractor output (not a canonical capture).

Replay extractor:

```sh
dotnet /usr/local/share/dotnet/sdk/8.0.203/Roslyn/bincore/csc.dll @/tmp/mas-extractor/compile.rsp
dotnet /tmp/mas-extractor/Extract.dll /tmp/mas-complete-source /tmp/mas-complete-semantics.json /tmp/mas-extractor/references.txt
```

Installed SDKs are6.0.413,7.0.400,8.0.203. Repo targets newer packages/.NET10; the extractor is **not an application
build**. It records1,670 semantic errors (mostly unavailable foreign EF/AutoMapper/etc and generated protobuf),
so never claim full semantic compilation succeeded. It still resolves many source-local calls correctly,
e.g. `CrudService.Add` calls source `IRepository.Add`, `IUnitOfWork.CompleteAsync`, private `Notify`, preserving
source signatures and complete CFG branches including short circuit Created/HasData.

Extractor totals:390 source files,416 declared source types,3,045 method/accessor/lambda declarations. Excluding
Migrations:1,918 declarations,700 non-null CFGs,437 lambdas. Non-executable abstract/interface/accessor declarations
can legitimately have null CFG. Lambdas currently emit `cfgError=anonymous function: graph obtained from enclosing
CFG separately`; implementing `ControlFlowGraph.GetAnonymousFunctionControlFlowGraph(IFlowAnonymousFunctionOperation)`
is a possible next improvement. **Do not equate these counts with inspected or fully modelled methods.**

## Findings that the next explorer must retain

1. **IdHelper is local**, `Core/Common/IdHelper.cs`. Earlier capture incorrectly treats the helper broadly as
   imported. Only `Be.Vlaanderen.Basisregisters.Generators.Guid.Deterministic.Create` is imported. Local code:
   null property array→empty; empty attribute string; join with underscore; construct
   `prefix_typeName__properties_attributes`; Bind ConvertToGuidString; throw MnSIdCreationException on error;
   call Deterministic.Create with declared namespaceGuid and version5; DeterministicId.FromString.
2. **VersionHandling is local**,25 C# files with custom input/output formatters, model-version registration,
   filters, media type parsing and errors. Do not classify its bodies as unavailable external middleware.
3. **Mileage uses `CrudService<Mileage,InternalId>` and `Repository<Mileage,InternalId>`**, not CommercialItemService.
   Mileage PUT prefetches existing, builds new Mileage(existing.Id, wrappedCode,Value,Unit,System), then updates.
   No commercial post-save refetch/identity call should be invented.
4. Four mapping services (Cap/Jato/Natcode/Schwacke) override Add and Update: MarketService.GetNoTracking(entity.MarketCode);
   NotFound→Result.ValidationFailed (HTTP400 via actual local response mapper); otherwise await base Add/Update.
5. MarketRepository.Update is custom: FirstOrDefault(x.Code==item.Code); missing→NotFound; otherwise assign
   existingMarket.Name and .Languages only, then Result.Ok(item). No generic Exist/DbSet.Update on this path.
6. PreOrder PUT preserves existing InternalId,Code,Requirements,Id; updates Name,SKU wrappers,ActiveVersion.
   PreOrder POST mapping constructs requirements and hardcodes ActiveVersion1. Its GET route is string→InternalId.FromString.
7. SelectionCategory/SkuCategory notification builder has no matching case, so Notify logs/null-skips and does
   not publish. Preserve that proved local branch rather than inventing events.
8. SoftOfferPackage GET has InternalId then DeterministicId fallback. Generic FindAsync may use identity map;
   do not call it guaranteed network I/O.
9. Generic Update/Delete save even when repository returns NotFound. Keep the separate missing invocation;
   actual delete staging only on found path. UoW itself returns void Task; SaveChanges affected count discarded.
10. Actual store interaction/effect belongs to UoW.SaveChangesAsync and has no entity request argument. Typed
    StorageWrite can now use effectContext/stagedContext/acknowledgedContext rooted at service owner; effect and
    ack vectors must be the **same exact call invocation**. See the reviewed deep Fee/Brand cases.
11. Keep internal Result<T>, complete HTTP body envelope (Status/OperationId/Data), and returned ObjectResult/
    IActionResult distinct. Source proves response constructor argument and StatusCode assignment; do not infer
    imported ObjectResult.Value internals. Source response helper itself should now receive an actual method frame.
12. Auth source exact null test `!res?.allowed ?? false` does not deny a null response. GET/disabled paths skip
    CheckAccess. Source ReadJwtToken does not prove signature validation. Actual local client ExecuteSend accepts
    success/403, rejects other statuses/null content; namespace/object/relation/lowercased subject body fields.
13. Program.cs is **top-level statements**, not an explicit declared Program.Main method body. Startup.Build,
    WebApp and Route compose actual local extensions. WebApp runs startup authorisation mapping and DB update.
    Startup.Route installs local/imported middleware and maps controllers. Framework callback dispatch should
    have source registration associations; do not fake a direct controller→auth/middleware source call merely
    to make one graph.

## Source reading already performed in this complete pass

Read full Program/Startup; complete MappingProfile and AutoMapperExtensions; all 100 controller method bodies
(with brace-aware extraction, not early-guard-truncating regex); full IdHelper/ValidationHelper; four mapping
service overrides; MileageService/PreOrderService; custom MarketRepository/MileageRepository/Cap repository;
full CommercialItemRepository. Earlier deep pass also read generic CrudService/Repository/CommercialItemService,
UoW, notification/publisher/builder, local auth/client, response/middleware and representative model bodies.
**Remaining source modules/helpers still require purposeful inspection and native modelling.**

Source census:562 files total;390 C# source files across Api113,Core123,Infrastructure119,MessageBroker10,
VersionHandling25. Project references link all five. Infrastructure count includes migrations/snapshot;
classify migration history/design-time/test/build code separately from runtime reachability with explicit reasons.

## Recommended next action

Finish the local source/method inventory and exact symbol-resolution audit before claiming unavailable code.
Choose a reviewed authoring approach: generalise the known-correct method templates for all CRUD families and
special overrides, or build native graphs from Roslyn CFGs with independently audited interface/virtual dispatch,
arguments/results, catch/finally and callbacks. The extractor is a useful inventory/parser aid, **not** a finished
extractor or completeness proof. Do not silently promote invalid/partial semantic operations as complete.

Create real frames for response helpers, model/identity/wrapper helpers, mapping callbacks, notification builder/
serializer, auth/client and reachable startup/formatter code. Maintain a per-entry reachability ledger separating
external implementation boundaries, schema/dispatch limits and genuine local authoring gaps. Query every entry,
plus branch/value/write/async cases; validate pinned sources; then independent source review before immutable
manifest selection. Scope ends only when same-repo reachable local code has no untraced authoring gaps.
