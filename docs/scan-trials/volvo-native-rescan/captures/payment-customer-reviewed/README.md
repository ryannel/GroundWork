# Payment customer: canonical repository re-scan

Repository `volvo-cars/cds-paymentservice-customer` is pinned at `b0010537cdd5a308a30a885541748727c97ecb2e`, matching the previous scan checkpoint. Sources were read from local Git objects. No fetching, live endpoints/stores/brokers, Maven build or Volvo runtime tests were performed.

**The registration census is complete within the repository; all 12 REST routes retain partial end-to-end coverage.** This batch expands useful create, update-by-ID and read-by-ID control/data/runtime slices. Other handlers use source-backed opaque operations and explicit coverage/gaps rather than empty logic.

This replacement preserves the original selected capture and corrects its inner-DTO/outer-response mismatch. [review.md](review.md) records the finding, source comparison and precise changes. Select this bundle **instead of** the original customer bundle; activating both would duplicate the logical routes/runtime bindings. [revision-map.json](revision-map.json) maps every original record to its replacement.

## What a user can now explore

- **Create:** conditional response-cache hit versus method body; the configured Redis lock boundary; source account selection; existing/missing customer and existing-account-relation branches; anonymised source customer construction; Mongo save before the imported PSP client; response externalId used in a new PSP relation; final local save. Source anonymised customer names/mobile/address are deliberately null in `convertTo(true)` while the PSP details builder uses the original payload. These are source constructions; imported builders and effective JSON/BSON remain partial.
- **Update by ID:** load customer and PSP relations; choose market or source 400; selectively merge company/nonblank market/locale/email; save; source optimistic-lock 409 continuation; source 404 after save if no PSP relations; per-relation PSP update loop. The SDK update return is ignored. A later failure is not shown to roll back earlier Mongo or remote updates.
- **Read by ID:** `customers` query, Optional present/missing branch, separate `customer_psp_relations` query, and bounded local mapping to the domain object and response DTO.
- **Storage:** source declarations and fields for `customers`, `customer_psp_relations`, `payment_instruments` and `recurring_charges`; local `BaseEntity` inheritance; source selection and prepared write values. Customer save precedes per-relation deletion and conditional replacement; that sequence has its own native consistency boundary. Physical destinations, installed indexes, driver wire encoding and transaction/write-concern guarantees are unresolved.
- **Cache/lock advice:** source cache association and default TTL 86,400 seconds, declared Redis lock wait 10,000 ms / lease 40,000 ms / fault-tolerant true, canonical request-key construction and independent cache/lock evaluations. Physical Redis prefixes/connections and advisor order remain unknown. The local cache wrapper can invoke a supplied loader again after a runtime exception in one overload; which overload imported advice chooses is unverified. This is a synchronous source wrapper association, not a consumer or asynchronous handoff, and it establishes no exactly-once guarantee.

The selected component views show the API, its declared Mongo data and Redis cache, alongside unresolved lock/account/PSP boundaries as applicable. Libraries remain inside the caller. The configured PSP URL is an intended source setting; it does not establish the exact imported client route or a deployed destination. The Mongo declaration uses `payment_services`, but matching a database name in another repo is insufficient to merge physical runtime components.

## Census

All 55 production Java files were searched for controller mappings, listener/scheduler annotations and functional registrations. The legacy model's nine business endpoints are all accounted for, plus Swagger configuration and v1/v2 version controllers.

| Method | Source registration                                                | Selected control scope |
| ------ | ------------------------------------------------------------------ | ---------------------- |
| GET    | `/v1/customers/{idType}/{idValue}/{countryCode}`                   | partial                |
| GET    | `/v1/customers/{customerId}`                                       | read                   |
| GET    | `/v1/customers/{customerId}/recurring-charges/{recurringChargeId}` | partial                |
| PATCH  | `/v1/customers/{customerId}/recurring-charges/{recurringChargeId}` | partial                |
| POST   | `/v1/customers`                                                    | create                 |
| POST   | `/v1/guest-customers`                                              | partial                |
| POST   | `/v1/customers/get-or-create`                                      | partial                |
| PATCH  | `/v1/customers/{idType}/{idValue}`                                 | partial                |
| PATCH  | `/v1/customers/{customerId}`                                       | update                 |
| GET    | `/v1/configurations/swagger-config`                                | operational-partial    |
| GET    | `/v1/version`                                                      | operational-partial    |
| GET    | `/v2/version`                                                      | operational-partial    |

Actuator health/prometheus/probes and springdoc UI/API-docs are two imported framework registration families retained with explicit unexpanded coverage. No local consumer or scheduled-job registrations were discovered. Source registrations/configuration do not establish actual deployment, effective profiles or gateway rewrites.

**Fully traced end-to-end routes: 0. Partial routes: 12.** Three useful source control/data slices are expanded; imported models/middleware/SDKs/drivers and bounded local preparation/query/loop details remain explicit frontiers or gaps. [inventory.json](inventory.json) reconciles every registration and includes the original source hits.

## Returned objects and cached values

All nine business routes return imported BaseResponse generic wrappers constructed through SuccessResponse.ok. Both version routes do too; Swagger configuration is a raw imported response DTO and remains an explicit opaque partial boundary. Eleven source contracts and terminal results now point to partial **outer** response values/shapes. DTOs and operation-ID results are separate factory arguments with native flows, not guessed outer JSON fields. The outer shapes have no invented shared fields. Create/get-or-create cache hits retain the whole prior returned object without the current invocation's body/DTO/fresh operation-ID lineage. Fresh whole-response values, rather than inner DTOs, feed conditional cache storage.

The extra saved query families are `create.outer-response`, `update.outer-response`, `create.cached-response`, `create.cache-value` and `response-associations.records`. Together with the original eleven families, 16 saved requests pass; all 12 route traces, eleven outer factory returns and two cache associations are checked.

## Schema and policy detail retained outside flat fields

[claims.json](claims.json) contains 16 native claims: two conditional source failure-window claims, 12 schema/advice claims and two whole-response/cache associations linked to affected schemas/entries, evidence and gaps. They preserve nonblankness, response annotations versus output guarantees, email declarations, the unresolved imported locale regex, paired first/last-name nullity, commented-out address cascade validation, index declarations with automatic index creation disabled, cache/lock association/options, key fallbacks and conditional loader re-invocation.

No minimum-length/numeric-bound rule is invented where this source declares none. The source custom name validator accepts both null or both non-null; its expression alone does not reject two blank strings. Flat optional/nullable field flags cannot encode that relationship. Declared DTO validation is not a proof of complete wire acceptance.

Automatic trace claim delivery currently selects inputs present as graph nodes; claims linked to shape IDs are not all automatically attached by that path. The explicit `schema-claims.records` request/result and inventory claim IDs make these facts retrievable without pretending the graph query already serves every schema-associated rule.

## Immutable selection and replay

Accepted [bundle](bundle.json) and [snapshot](snapshot.json): `5f8e714355588ffe92a4d7d00956d46f2f68763596d7a5a365f1b974904be709`. Record IDs use the repo/revision namespace `volvo/cds-paymentservice-customer/b0010537cdd5-r2/`.

- Create entry: `volvo/cds-paymentservice-customer/b0010537cdd5-r2/entry/create`.
- Update-by-ID entry: `volvo/cds-paymentservice-customer/b0010537cdd5-r2/entry/update-id`.
- Read-by-ID entry: `volvo/cds-paymentservice-customer/b0010537cdd5-r2/entry/get-id`.

Saved query families: `create.interactions`, `create.continuations`, `create.psp-value`, `update.interactions`, `update.continuations`, `update.404-outcome`, `update.consistency`, `read.interactions`, `read.continuations`, `schema-claims.records`, and `source.impact`. [acceptance.json](acceptance.json) records all 12 entry traces and source snapshot selection.

```sh
python3 reports/volvo-native-rescan/payment-customer-reviewed/build.py
npm run knowledge:validate -- reports/volvo-native-rescan/payment-customer-reviewed/bundle.json --snapshot reports/volvo-native-rescan/payment-customer-reviewed/snapshot.json --sources /Users/RNEL/.cache/groundwork/clones
node --import ./tools/register.ts --conditions=react-server reports/volvo-native-rescan/payment-customer-reviewed/acceptance.mjs
```

Validation passed for 1461 records, 33 shapes, 30 contracts, 23 interaction records and 16 execution bindings. The generic source check verified file availability and range bounds for 180 pinned source ranges across 41 files. [source-lock.json](source-lock.json) retains raw file SHA-256 and explicitly normalised range hashes. A range check does not prove an interpretation or deployment.

Acceptance passed for all route/contract/runtime bindings, chosen create/update/read graphs, caller value provenance, ignored update SDK return, cached body bypass, update's 404 slice retaining prior local writes, store consistency, schema/advice claim retrieval and bounded support pages. Conservative derivations link the source revision and explicit references to dependent facts; fine-grained helper/configuration/imported dependency closure remains partial, so source changes require conservative re-exploration.

Production workspace YAML, previous scan marks, earlier proof bundles and the app are unchanged. The SQLite file is a disposable index rebuilt during acceptance and removed after it closes.

## Remaining gaps

All 24 native gaps, their actions and their exact source ranges are in [gaps.json](gaps.json).

- `source-wire-closure`: Source DTOs, inheritance and explicit validation are retained; imported Address/Customer/AttributeBase models, serializers, response wrappers and effective JSON/BSON formats remain partial.
- `runtime-configuration`: Committed defaults name Mongo payment_services, Redis caching/locks and a PSP integration URL; physical connections, config-server overrides and deployment are not established.
- `security-middleware`: Role guards and imported EcomWebAppConfiguration are declared, but effective filter/token/header/advice ordering is not traced at exact artefact versions.
- `psp-sdk`: Requested PSP client 1.3.243 has no resolved artefact digest/source correspondence. Source constructor wiring, arguments, response use and configured intended endpoint are retained; effective HTTP route/serialization/retry policy is unresolved.
- `mongo-driver`: Mongo repositories declare derived/custom queries and saves; generated driver commands, write concern, server behaviour and exact byte representation are not inspected/executed.
- `cache-lock-advice`: Cache and distributed-lock annotations are source declared. Effective advisor order, lock implementation/fault tolerance and connection scope are imported. Cache hit can bypass body; source cache errors can fall back to body or ignored put. The local get(key,Callable) wrapper can re-call its loader after RuntimeException, but the imported advisor overload selection is not established.
- `read-mapping`: Local customer and relation mappings are inspected but compressed to a bounded mapping operation; implicit getter/collection failures and imported domain class/defaults remain partial.
- `save-sequence`: Save duplicate/conflict checks and relation loops are compressed, not a complete per-branch/per-item trace. Customer save, each relation delete and relation saveAll are separate calls; atomic shared transaction and write concern are unknown. Per-relation deletion remains an explicit conditional write effect/operation; this bounded capture does not establish a separate normal-return acknowledgement for each loop iteration.
- `create-helper-closure`: Source create branching, anonymisation, store-before-PSP and relation-save order are native. Existing lookup internals, account configuration, nullable imported builders/getters and exception status/serialization remain partial.
- `update-exception-closure`: Source store-before-PSP order, conflict handling and per-relation loop are captured; imported SDK/network exceptions, earlier relation writes, physical transactions and exact status paths are not exhaustive.
- `route-get-external`: Source get by external identifier resolves STRIPE market account, finds customer and requires matching PSP account relation; full library/config/query/mapping closure remains partial.
- `route-get-recurring`: Load recurring charge, throw404 if missing, require requested customer ownership or403, build response; imported models and inner repository closure partial.
- `route-update-recurring`: Load recurring charge, validate customer/current/new instrument ownership (missing old instrument can be ignored), replace instrument, save, build result; full inner branches partial.
- `route-guest-create`: Create anonymised customer in DB, then call PSP, append PSP relation and save again; full guest-specific source data/exception trace remains partial.
- `route-get-or-create`: Apply Quebec fr-CA override for Canadian G/H/J postal prefixes; missing Volvo ID creates directly; otherwise get customer and align locale/email; CustomerNotFound creates. Alignment may write DB and call PSP; full branch closure partial.
- `route-update-external`: Require VOLVO_ID in controller, load external identifier, perform market/merge/save/PSP relation updates; shared update body and exception closure not expanded for this invocation.
- `operational-swagger-config`: Operational route registration is known; local statements and imported config/constructor/wrapper behaviour remain a bounded opaque source body.
- `operational-version-v1`: Operational route registration is known; local statements and imported config/constructor/wrapper behaviour remain a bounded opaque source body.
- `operational-version-v2`: Operational route registration is known; local statements and imported config/constructor/wrapper behaviour remain a bounded opaque source body.
- `framework-actuator`: Actuator health/prometheus with health liveness/readiness probes; source health groups exclude Redis; exact effective imported route expansion not established.
- `framework-springdoc`: Springdoc Swagger UI and API-docs configured defaults; imported dynamic registrations/profile conditions unexpanded; exact effective imported route expansion not established.
- `cross-field-update-validation`: Source custom validator requires firstName and lastName to be both null or both non-null. Flat field optionality alone cannot express this; the source check is retained by evidence and coverage. Preferred-locale regex and imported Address validation/defaults remain unresolved.
- `account-config`: AccountConfigService is imported from cds-paymentservice-properties 2.0.32. Caller arguments/Account field use are known; exact source/artefact and whether it uses local configuration or any network transport are unresolved.
- `invalidation-closure`: Conservative derivations link facts to this entire source revision and explicit referenced records/evidence. Imported helper/policy/schema correspondence is still unknown; unchanged cited lines cannot establish unchanged behaviour.
