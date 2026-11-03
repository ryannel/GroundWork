# PSP Inbound source review

The immutable final selection is `bundle.final-r2.json` + `snapshot.final-r2.json`, snapshot
`eaaef2ed0e7238cf7ed324b9812017073b02716f3020b53e04be8aa5b9bca64a`, at repository
`volvo-cars/cds-paymentservice-psp-inbound` commit `ae1d9ddfb34dae71c15913e9f28d41321d66266a`.
The previous reviewed three-bundle selection in `../psp-inbound/` remains unchanged.

The source review reconciles all 104 repository files, 28 production Java files, 84 declared methods
(79 explicit bodies), 17 separate lambda bodies: 96 body frames and 101 native frames including five declaration/opaque frames. All available local bodies,
source registrations, constructors, configuration helpers and exceptions are examined. Five declaration-only
methods remain generated/interface/abstract boundaries; they are not unavailable local method bodies.
The 16 test Java files and fixtures were inventoried, excluded from execution analysis and not run.

There are two REST entries, the actual process main, one conditional schedule, one PostConstruct startup
entry and six callback entries: the filter, two converter callbacks, advice and two future callbacks.
Framework registration does not establish activation or ordering. The source filter is associated with HTTP
handling and has its own complete callback graph; it is not an invented controller method or eager main call.
Actuator/Springdoc built-in registration families and imported cloud-config refresh remain explicit exclusions.
No local subscription or broker consumer is declared.

The controller's existing query-map platformAccountId takes precedence over the path default through
putIfAbsent. Canonical InboundRequest construction preserves payload, params and headers separately.
The factory selects the first matching PSP service or throws; native source dispatch expands a guarded local
Stripe receiver branch and retains an unresolved other-runtime-receiver branch. One source implementation
does not establish the complete runtime registry.

The IP source retains forwarded-header precedence, comma splitting/trimming, IPv4 port suffix handling,
excluded paths and configured matcher traversal. A concrete compatibility gap is retained: base application.yml
supplies stripe.ip-addresses as a sequence, while init requests LinkedHashMap.class through Class.cast.
Source alone proves neither successful property conversion nor a runtime failure. Effective remote settings,
framework binding and lifecycle activation need separate evidence.

Raw body, selected signature and selected platform/connected secret remain the actual parser arguments.
AccountConfigService is an internal library boundary with unknown storage/transport, not a network service.
Webhook.constructEvent and ObjectMapper.readValue are likewise imported local parsing boundaries. Signature
and JSON parsing catches retain the actual local exception constructors without inventing shared HTTP status
mapping. Optional present/absent callbacks, no-argument get/orElseThrow failures, source switch arms, source
receiver dispatch, stream terminal traversal and Java captures are represented separately.

Explicit caller schemas and field values retain the four PspInboundEventPayload fields, five Metadata fields,
Event metadata/payload nesting, Swagger construction and the distinct outer ResponseEntity status/body intent.
Payload.id, metadata.id and correlationId are different source identities. Metadata.created selects source
created milliseconds or current time; Stripe's seconds-to-milliseconds multiplication remains explicit.
Source-observed metadata/params/header maps are partial and allow unknown or missing keys. Local @NonNull
record declarations are captured as source constraints; effective generated enforcement remains a boundary.
The literal VolvoID alias, metadata source aliases, three category switch arms, Optional fallback order and
configuration membership guards remain queryable. Imported enum/constant values are not guessed.

The native POST source root positively reaches the internal Kafka topic; the schedule root positively reaches
the heartbeat topic. The exact topic/key/message arguments belong to their actual producer method. Internal
publication selects metadata.id as key and the whole constructed event as value. Heartbeat uses an epoch
millisecond String key and a literal null Java value with its own source shape. Neither establishes effective
serializer output, a tombstone or broker persistence. Both calls return a future and register a separate
whenComplete logging callback without awaiting it. Source callback association records name the send,
registration, callback body and capture origins; no eager callback, handoff or consumer is invented. A later
callback failure cannot unwind into the earlier HTTP response. Synchronous send invocation may still fail.

Whitelisted non-secret committed configuration leaves retain exact source defaults, including the VOC
SETUP_INTENT_SUCCEEDED restriction, topics, heartbeat settings, serializers, IP sequence and refresh cron.
Configuration and field initialiser facts belong to their source revision or declared shape. Mutable defaults
are not treated as constant payload fields. Committed profiles do not establish effective runtime values.

Native validation passed 10,715 records and 636 pinned source ranges. `query-final-r2/` contains 164 all-entry
queries; `segment-queries-final-r2/` contains all 101 method traces, complete owned-record pagination and
78 invocation value queries. `source-acceptance-final-r2/` adds 26 field/value/destination queries and 39
passing semantic assertions. Positive checks assert actual native POST/schedule-to-topic edges, actual
send bindings and callback separation; negative checks exclude extra Optional/configuration/mapper network
edges. No query hit node or record budgets. All results still report exhaustive:false because imported runtime,
configuration, exception and wire frontiers remain. Automatic mutable heap versions, alias/guard feasibility
and isolated deferred-callback capture origins are query limitations, not unexamined source.

`source-file-ledger.json`, `method-ledger.json`, `entry-ledger.json`, `registration-ledger.json`,
`symbol-resolution-audit.json`, `io-ledger.json` and `configuration-ledger.json` reconcile the review.
`CustomerSourceInventory.java` is a parse-only Java17 syntax exporter, with original source offsets/text,
implements clauses and no compiler attribution. `enrich.py` refuses to overwrite the final selection; advance
its output and revision namespace before another authoring pass. Draft r1 and its query snapshot remain
historical. The final-r2 bytes equal the retained draft-r2 input selected by its query packs.

No fetch, live API/store/broker calls, source/application test or build, source edit, production workspace
change or scan-mark advancement occurred. Source review is complete; runtime coverage remains partial.
