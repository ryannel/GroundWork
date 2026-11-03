# Transaction source review

The active immutable selection is **bundle.final-r4.json + snapshot.final-r4.json** at snapshot
`e2ec8f901c7ba3b9fcf11455638ec14ae764a0f41c0551af91bf20efbbec3d1c`.
It reviews `volvo-cars/cds-paymentservice-transaction` at
`020d2fabb141b47b6d1e8173c02405795f71613a` without fetching, running its application or calling a live endpoint.

The repository-local source review covers all 11 REST registrations, the actual `App.main` process entry,
168 production Java files, 389 declared methods (346 bodies), and 91 source lambda bodies. The bundle has
480 method frames and no unexpanded source statement kinds. Source declarations without a body remain
generated/imported implementation boundaries. The client module is fully extracted as an unbound source
library; its location in this repository does not make its wrapper methods run in the API service.

`local-completeness-ledger.json`, `source-file-ledger.json`, `method-ledger.json`, `entry-ledger.json`,
`symbol-resolution-audit.json`, `registration-ledger.json` and `io-ledger.json` reconcile the source. All 250
repository files have a pinned blob digest and an explicit role/exclusion. Test source is excluded from
execution analysis and no source/application test or build was run.

The parse-only Javac exporter is saved as `CustomerSourceInventory.java`; `javac-source-index.json`
contains the original source text and offsets. Its syntax diagnostics are empty. Unnamed catch identifiers
are normalised to a same-length identifier only for parsing; exported evidence uses the original blob.
No erroneous/unresolved compiler type attribution is used. `java_ir.py` and `source-index.json` are the old
structural scaffold; their lexical enum-value list is not authoritative. Canonical enum constraints use
Javac enum-constant declarations. `enrich.py` authors source graphs and `reconcile.py` writes the ledgers.
Do not rerun an authoring script over a selected immutable bundle; change its output name/namespace first.

Source-local calls, constructors, inherited helpers, mappers, source guards, typed catches, returns and
field assignments retain their actual owners. Ordinary instance receivers, true formal parameters and
Java lexical captures are separate bindings. Java captures use `mode: value`, including copies of object
references. Optional suppliers execute only on the corresponding presence branch; `orElseThrow` throws
the returned exception object. Stream callbacks are registered lazily and available local bodies execute
in terminal traversal frames, including filters, flat-map exhaustion and conditional collector merging.
Logging and Kafka future callbacks remain separate deferred associations rather than synchronous calls.

The custom Mongo fragment retains the transactionId selection, conditional externalId/attributes patch,
empty-update return and ignored updateFirst result. Explicit insert/update operations have storage-write
records. Imported repository `save` calls retain write effects, actual arguments/results and normal-return
milestones; their underlying insert-versus-replace/upsert choice is not guessed. Kafka sends do not await
completion. No local broker consumer or scheduled job is registered. Initial session/transaction/link
writes, subsequent PSP calls, conditional scheduler registration and publication remain distinct source
operations and failure windows. Source history mutation is not renamed as a persistence call.

Source schemas retain local inheritance, nested collections, enum constraints and declared null/length/
pattern constraints, distinct from imported factory results, HTTP containers and effective JSON/BSON wire
representations. SDK arguments are source selections, never guessed HTTP bodies. Exact fluent builder inputs have native
field values and source flows. Capture has precisely attributes, psp, countryCode, pspTransactionId and
accountId; it has no amount field. Create payloads preserve the explicit builder fields and source setter
for accountId. Retry registration retains its two conditional RetryStrategy constructions and cartLine;
refund retains its mapped cartLines, payload and metadata envelope. Generated getter projections use the
source declaring field and caller evidence with an explicit generated-accessor assumption. Known
BigDecimal arithmetic retains operand/result lineage. These source construction facts do not establish
SDK wire field names or serializers.

PSP and scheduler components retain the identities intended by source client constructors, configuration
and committed endpoint defaults/overrides. SDK interactions target those configured components while
actual deployed routing, imported endpoint contracts and wire bodies remain unresolved. Configuration
helpers use internal source-library unknown boundaries rather than network-system claims. Source mutation claims
and exact receiver/capture bindings retain known field transformations and later object use; native queries
do not automatically prove heap versions, alias/guard feasibility or implicit runtime exception coverage.
A local exception's statusCode is kept separate from the final response selected by a catch/advice handler.

`validation.final-r4.log` verifies schema, references, runtime bindings and 4,417 pinned source ranges.
`query-final-r4/` holds all-entry interaction/control/effect/continuation/consistency/outcome/value queries,
plus specific custom-write, object-capture and instance-method-reference receiver cases.
`segment-queries-final-r4/` adds 37 representative method traces and paginated owned records.
`payload-queries-final-r4/` checks 17 native payload field/value paths. `semantic-acceptance.json` records
19 source acceptance checks. The preserved `segment-queries-final-r3/` pack contains all 480 earlier method
traces and bound invocation value queries; it is explicitly tied to the earlier immutable selection. Results are gzip-compressed JSON; requests and acceptance summaries are ordinary JSON. Large
route traces can exceed the native 2,000-node budget; those frontiers are reported, not labelled exhaustive.
Owned-record pagination closes the selected methods independently of that drawing limit.
The final selection contains 56,280 records. All-entry queries total 185, including all 11 REST entries
and the process entry; 14 create-route queries reach maxNodes and one representative create method does too.
Supporting record pages are retained separately from those control drawing frontiers.

Remaining boundaries concern exact imported/generated artefacts, middleware/framework activation,
effective configuration, deployment, serializers/drivers and broker/provider runtime behaviour. Source
review completeness does not establish end-to-end runtime completion. Actuator and Springdoc registration
families remain explicit framework exclusions. No production workspace scan mark was advanced.

The earlier deep capture is untouched. `bundle.json/snapshot.json`, `bundle.final-r2.json/snapshot.final-r2.json`
`bundle.final-r3.json/snapshot.final-r3.json`
and `bundle.checkpoint-r1.json/query-checkpoint-r1/` are earlier immutable review checkpoints; they are not
the active final selection. Their source graphs are superseded in the active selection rather than combined
with duplicate, previously inlined summaries.
