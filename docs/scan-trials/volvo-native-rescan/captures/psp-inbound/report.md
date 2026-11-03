# PSP inbound native rescan

This capture reads `volvo-cars/cds-paymentservice-psp-inbound` at
`ae1d9ddfb34dae71c15913e9f28d41321d66266a`, directly from pinned Git objects. It captures the local webhook,
publication, key/source filtering, heartbeat and callback source graphs. Imported implementation/wire details
and effective deployment remain partial. No fetch or Volvo runtime calls were made; upstream freshness is separate.

The reviewed selection contains **362 native v3 records across three bundles**, including **53 pinned source ranges**, 16 shapes,
10 bound implementations, three interactions, two delivery policies, HTTP/publication milestones and a
failure-window record. The 15 coverage obligations are six `examined` and nine `partial`; these are scoped
obligations, not a claim that all behaviour is complete. Eight native gaps retain the missing information.

## Source census

The old one-endpoint/two-handler/two-message inventory was treated as context. The independent census found:

- Two explicit REST registrations: `POST /v2/{psp}/{platformAccountId}/inbound` and
  `GET /v1/configurations/swagger-config`. Both have native entry/exposure/contract/execution records.
- Four configuration-declared operational families: management health and Prometheus, configured Springdoc UI
  path `/swagger-ui.html`, and the API-docs/UI-link family. Unknown effective methods/base paths stay explicit
  `UNRESOLVED`/`unresolved:` placeholders. Management port 8779 is declared; Actuator base paths and generated
  assets are not invented from framework defaults. The UI link's `/v3/api-docs` fallback is source configuration,
  not verified endpoint registration. The public gateway/virtual path remains separate from application routes.
- One concrete application scheduler: `ScheduledMessageProducer.sendHeartbeat`, conditional on
  `payment-service.scheduled-message.enabled=true`, with its fixed-delay setting and base literal `10_000`.
  The actual runtime selection/parser/overrides remain partial.
- One imported scheduled-behaviour declaration: `app-cloud-config.refresh-enabled` and refresh cron
  (base `35 */2 * * * ?`, production profile `35 */5 * * * ?`). Its executing library implementation and
  network/storage effects are unknown.
- No local message-consumer/listener/subscription, repository/entity persistence implementation, or other
  direct application route/job registration in the pinned main sources. Producer completion callbacks are
  local future callbacks, not message consumers. CodeQL/Sonarqube schedules and Dependabot updates are
  repository maintenance automation, explicitly outside this application-runtime capture.

The inventory contains eight trigger/family records. Non-REST jobs are represented by bound implementation
roots and coverage, and queried by implementation ID; no fake HTTP route/contract is created for a scheduler.
The current native entry-exposure record remains REST-specific. Imported/dynamic registrations remain partial.

Six technical components are declared: the API/its in-process schedulers, internal-events topic, heartbeat topic,
configured Mongo database, configured Spring Cloud Config server and configured OTLP receiver. The last three
are configuration intent with unverified runtime use. No executing call site or persisted schema is invented
from their settings. Teams and domain/system grouping do not define these component identities.

## Webhook control and values

The local IP filter reads `x-original-forwarded-for`, falling back to `x-forwarded-for`, then the remote address;
it chooses the first comma-separated value, trims it and removes an IPv4 port suffix. A source-excluded path
or any configured PSP IP matcher permits the request; otherwise the filter explicitly sets HTTP403 and writes
an imported error envelope. Trusted-proxy handling, filter order and imported matching/serialisation remain gaps.

A native configuration gap also retains a source discrepancy: base YAML declares Stripe `ip-addresses` as a
sequence, while local initialization requests `LinkedHashMap.class` through `PspSettings.get` and iterates
its values. Effective binder conversion or remote/profile overrides may reconcile these declarations; neither
successful initialization nor a runtime defect is asserted. The gap names the examination needed.

The source converter uppercases the PSP route value before `Psp.valueOf`. The local factory chooses a matching
service; Stripe is the available local implementation. Other/invalid PSP behaviour and imported contributors
remain opaque. The controller calls `params.putIfAbsent("platformAccountId", routeValue)`: an existing query
value therefore takes precedence over the route default. Both input paths remain visible in native lineage.

Java argument evaluation matters here: `getSignature(request)` runs before `getSecret(request)` in the
`parseEvent(...)` call. Missing `stripe-signature` can throw before the imported account lookup. The trace
preserves this order. Secret selection uses the connected-account boolean (default false), the effective
platform account, imported `AccountConfigService.getAccount`, the returned `secretKeyId` and the matching
platform/connected settings map. Secret values are excluded. The imported account lookup is an unresolved
boundary within the caller context; it is not guessed to be a Mongo read or another network service.

Stripe `Webhook.constructEvent` is an opaque imported implementation, with the local signature-exception
translation retained. The data object uses a deserialised Stripe object's JSON when available and otherwise
its raw JSON. Jackson then parses that data JSON into a map. Local signature/parse exceptions and generic
failures are retained without inventing shared HTTP status mappings.

The source constructs `PspInboundEventPayload.id/type/platformAccountId/additionalParameters`, plus Event
metadata `id/correlationId/type/source/created`. Created time is Stripe seconds multiplied by 1000 when present,
otherwise current milliseconds. Every meaningful observed field has source anchors; source construction is
separate from the unknown complete inherited/serialized wire model.

The Kafka key is metadata.id, selected by event category and data-object metadata. Transaction/transfer/refund/
unknown cases prefer Volvo ID aliases, then the payment-session key, then a random UUID. Payment-instrument
cases reverse those first preferences. The literal `VolvoID` alias is local; other alias/key constant values
come from imported classes and remain unresolved. Empty metadata produces a random UUID. Documented
unreachable recurring/customer switch cases return null and remain visible; source comments do not prove
runtime path infeasibility.

The source filter requires metadata, chooses an allowed source candidate using imported `Source.SOURCE`,
literal `Source` and `system_name`, lowercases it, then applies the configured event set. An empty allowed-event
set allows all types. Missing metadata, unrecognised source or disallowed type avoids publication but still
returns the source HTTP200 response. Base configuration declares `cds-payment-service`, `VOC` with a restricted
setup-intent event, and `manual`; effective remote/runtime configuration may change this.

## Publication, acknowledgement and failure windows

For an allowed event, the code invokes
`KafkaTemplate.send(configuredTopic, event.metadata.id, event).whenComplete(...)` and returns without waiting
for the future. The source completion callback logs success or failure; it neither performs a local retry nor
supplies the HTTP response with a durable acknowledgement. Synchronous send invocation can still throw.
Consequently HTTP200 can mean an ignored event or a registered producer future, and can precede a later send
callback failure. The native failure window and milestones preserve that distinction.

The heartbeat independently sends an epoch-millisecond String key and **null Java value argument** to its
configured heartbeat topic. Its callback logs success/failure and elapsed duration. The schema retains the
null source argument separately from unresolved effective Kafka serialization/tombstone behaviour.

No broker persistence/default acknowledgement, retries, idempotence, ordering, consumer completion, outbox or
exactly-once guarantee is inferred. The external Stripe event ID remains `payload.id`; metadata.id is a routing
key and correlationId is trace correlation. They are not silently treated as the same identity or a
message-deduplication mechanism.

Future callbacks have their own bound implementation graphs. The current native broker `handoff` contract
requires a subscription; it is not used to fabricate a consumer just to connect an in-process future callback.
Source-backed association claims explicitly reference the send registration operation, publication effect, callback implementation and execution binding. Agents can retrieve those associations without rereading the repository. Typed future-result/closure transfer into that separate callback is a remaining model boundary, documented
as source behaviour rather than claimed as a broker continuation. No subscription or header-type filter is
invented: this repository has no local consumers.

## Schemas and sources

Native shapes retain the raw String webhook boundary, path/query/header observations, `InboundRequest`,
metadata used for key/source selection, explicit Event/payload construction, internal NotificationResponse,
Swagger response construction, Kafka key and null heartbeat argument. The configured producer JSON/String
serializers are declared, but their effective inherited schema/type headers remain unresolved.

Stripe Java 31.4.1, payment-service core/properties 2.0.32 and Ecom web 4.0.36 are requested dependency
versions. No exact resolved artefact digest/source correspondence is claimed. Imported Psp enums, Stripe Event,
Account, common Event/Metadata and PspInboundEventPayload closure therefore remain partial. All retained field
facts cite local construction/use sites; no additional-properties policy, enum, constant field or complete wire
DTO was inferred from an incomplete list of source observations.

Source-backed claims also retain validation policies that do not fit scalar shape-field constraints: IP/path
policy, PSP conversion, required map lookup, raw-body signature verification, metadata/source selection and
configuration-dependent event membership. They are not silently reduced to invented string patterns or enums.

Base configuration declares Mongo `payment_services`, but no local store access, entity schema or applied write
acknowledgement is established. This is explicitly **not a global no-write claim**: imported lookup/framework
and SDK effects are unknown. Config-server and OTLP settings are likewise source-declared external intent,
with no invented executing network interaction or payload schema.

## Verification

The generic validator passed the selected snapshot with all **53 pinned local source ranges** verified. This
checks file availability/ranges and source-link derivation, not deployment or citation entailment.

**16 native query acceptance checks passed**: webhook control/interactions, HTTP200 and 403 outcomes, effective
account precedence, publication value lineage, effects/consistency, heartbeat control/interactions, callback
branches, Swagger control, imported-refresh boundary, contracts/sources, trigger inventory and explicit callback/validation association retrieval. The main source
trace has 32 nodes and 54 edges. The 403 slice excludes account lookup and publication; the HTTP200 slice
retains both ignored-event and publication paths. The main component view has one explicit topic connection
and one unresolved imported-account boundary; heartbeat has its own topic interaction.

All queries stayed within their node/support budgets and retain `exhaustive: false`. Traversal completion
only describes the represented graph. Opaque, unresolved-binding/representation/dependency and exception
frontiers remain present. Source tests and Volvo APIs/stores/brokers were not executed.

Run from the Groundwork checkout:

```sh
npm run knowledge:validate -- reports/volvo-native-rescan/psp-inbound/bundle.json reports/volvo-native-rescan/psp-inbound/associations.bundle.json reports/volvo-native-rescan/psp-inbound/source-review-v2.bundle.json --snapshot reports/volvo-native-rescan/psp-inbound/final-snapshot.json --sources /Users/RNEL/.cache/groundwork/clones
node --import ./tools/register.ts --conditions=react-server reports/volvo-native-rescan/psp-inbound/acceptance.mjs
```

`generate.py` reproduces the source-pinned capture and refuses changing a bundle once its snapshot exists.
The final reviewed authoritative selection is `final-snapshot.json`, selecting `bundle.json`,
`associations.bundle.json` and `source-review-v2.bundle.json`. The original 355-record bundle and its `snapshot.json`
remain unchanged; `expanded-snapshot.json` and earlier reviewed manifests preserve intermediate selections. The v2 source review attaches its coverage to the HTTP entry so the new gap is visible in ordinary webhook queries; the earlier implementation-scoped review remains historical. Do not merge all
historical manifests as independent facts. `generate-associations.py` and `generate-source-review.py` reproduce
the append-only review records. Inventory, requests/results and validation logs are alongside them. No app, production workspace, skills, source repository or original proof files were edited.
