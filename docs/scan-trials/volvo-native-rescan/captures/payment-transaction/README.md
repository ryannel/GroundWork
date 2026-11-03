# Payment transaction: canonical repository re-scan

Pinned repository: `volvo-cars/cds-paymentservice-transaction` at `020d2fabb141b47b6d1e8173c02405795f71613a`. This matches the original capture proof revision. Source is read from local Git objects; no fetch, live API/store/broker calls, Maven build or Volvo runtime tests were performed.

**A repository registration census is complete; end-to-end behavioural coverage remains partial for all 11 explicit REST routes.** There are no empty placeholder handlers. Every route has a native entry, runtime binding, interface contract, source-backed schema references and a controller graph; unexpanded business/middleware/serialization behaviour is represented by opaque operations, coverage and gaps.

## What this batch adds

- The former unresolved session lookup is now source-local: the root Maven reactor includes the core module, the API depends on that module at the project version, and `CaptureTransactionService` imports its local `PaymentSessionService`. The active trace follows `getByPaymentSessionId` -> `PaymentSessionOperationService` -> Mongo's derived query -> Optional present/missing branch -> local `PaymentSessionMapper.to` -> expiry/field construction -> return. The imported `PaymentSession` data class remains partial; its existence does not turn the service into a foreign library.
- Payment-session source fields now include local `BaseEntity` inheritance and referenced local nested declarations. The core mapper retains copied fields and `expireAt = created.plus(configured expiryValue, expiryUnit)`. Configured source defaults are DAYS / 7; effective loader/runtime correspondence stays explicit.
- The new capture interaction graph contains transaction API, Mongo and one unresolved PSP client boundary. The source-local lookup is a Mongo read, not an invented remote service. The PSP client's requested version remains unmatched to newer candidate source; caller arguments are retained as source selections and do not become asserted HTTP wire fields.
- Refund traces show session/transaction reads, a bounded validator with a prior-refund query, source event construction and publication to `app5981.ps-refund-internal`. Charge retains its partial pre-publication local processing and publication to `app5981.ps-recurring-charge-internal`.
- Both Kafka methods call `send(...).whenComplete(...)` and return without awaiting the future. Their callback logs failure/success. HTTP return does not prove broker persistence or consumer success. Keys are paymentSessionId and recurringChargeId respectively. No consumer is invented in this repository.
- Source REST payload/response DTOs, local inherited/nested members, source validation constraints and Event/payload/metadata constructions are retained. Effective JSON, inherited imported fields and wrapper formats remain partial instead of empty or guessed wire schemas.

## Discovered entries

The census searched all 168 production Java files for controller mappings, listener/scheduler annotations and functional registrations. Eleven explicit routes were found. The old model listed eight business endpoints; Swagger config and both version routes are now included.

| Method | Source-registered route                                                | Native coverage                                      |
| ------ | ---------------------------------------------------------------------- | ---------------------------------------------------- |
| POST   | `/v1/payment-sessions/{paymentSessionId}/transaction-capture`          | Expanded capture + source-local session query/mapper |
| POST   | `/v1/payment-sessions/{paymentSessionId}/retry`                        | Controller trace + explicit downstream/contract gaps |
| POST   | `/v1/payment-sessions/{paymentSessionId}/resubmit`                     | Controller trace + explicit downstream/contract gaps |
| GET    | `/v1/payment-sessions/{paymentSessionId}`                              | Controller trace + explicit downstream/contract gaps |
| POST   | `/v1/payment-sessions`                                                 | Controller trace + explicit downstream/contract gaps |
| POST   | `/v1/payment-sessions/charge`                                          | Controller trace + explicit downstream/contract gaps |
| POST   | `/v1/payment-sessions/{paymentSessionId}/transaction-refund`           | Controller trace + explicit downstream/contract gaps |
| POST   | `/v1/payment-sessions/{paymentSessionId}/psp/{psp}/transaction-create` | Controller trace + explicit downstream/contract gaps |
| GET    | `/v1/configurations/swagger-config`                                    | Controller trace + explicit downstream/contract gaps |
| GET    | `/v1/version`                                                          | Controller trace + explicit downstream/contract gaps |
| GET    | `/v2/version`                                                          | Controller trace + explicit downstream/contract gaps |

Two imported framework registration families are explicitly accounted for but not expanded into guessed routes: actuator health/prometheus/probes, and springdoc UI/API docs. Their configuration evidence and `not_examined` obligations are in [inventory.json](inventory.json). No local consumer/listener or scheduled-job registrations were discovered. Source controller annotations and config do not prove deployment or effective gateway rewrites.

Local controller statements are represented for all 11 routes. Source-local session service/query/mapper logic is expanded, while the other large service interiors remain explicitly partial. **Fully traced end-to-end routes: 0. Partial routes: 11.** Even the detailed capture retains imported middleware/client/schema and driver/runtime boundaries. Counts are not a completeness claim.

## Selection and replay

- Authoritative new [bundle](bundle.json) and [snapshot](snapshot.json): `ec4e7c5d37593f43639ecef8a8040dccbb30260eba2fc2b84825f2deaa74cb92`.
- Active capture entry: `volvo/cds-paymentservice-transaction/020d2fabb141/capture/r1/endpoint`.
- Unchanged runtime identities: `u3/component/transaction` and `u3/component/mongo`.
- Changed facts and their reference closure use the revision namespace `volvo/cds-paymentservice-transaction/020d2fabb141/`. [inventory.json](inventory.json) maps every original proof ID to the new closure and lists the superseded unresolved-lookup contract/derivation removed from this selection. Old candidate dependency records remain excluded source candidates; they establish no active execution binding.
- The old inlined session-map summary now says the mapped session is received; the actual mapper runs in the source-local callee trace. The new resolution no longer depends on the shared artefact for this service implementation. The shared-version gap remains relevant to imported model/base/serialization behaviour.
- Draft authoring selection `7a107258...` is archived under `revisions/draft-7a107258/`; it is superseded and is not the accepted final selection. Original v1/v2/v3 documentation proof inputs remain untouched.

Saved requests/results: `capture.interactions`, `capture.continuations`, `capture.session-value`, `refund.interactions`, `refund.continuations`, `charge.interactions` and `charge.continuations`. [acceptance.json](acceptance.json) records each route's trace size and remaining frontiers.

```sh
python3 reports/volvo-native-rescan/payment-transaction/build.py
npm run knowledge:validate -- reports/volvo-native-rescan/payment-transaction/bundle.json --snapshot reports/volvo-native-rescan/payment-transaction/snapshot.json --sources /Users/RNEL/.cache/groundwork/clones
node --import ./tools/register.ts --conditions=react-server reports/volvo-native-rescan/payment-transaction/acceptance.mjs
```

Validation passed for 1141 records, 97 shapes, 26 execution bindings, 19 interface contracts and 7 interactions. The generic source check verified availability and range bounds for 350 pinned ranges across 111 files. [source-lock.json](source-lock.json) additionally retains SHA-256 hashes of the actual file/range bytes used. Structural validation and range checks do not prove that every interpretation is correct or that the source was deployed.

Acceptance checks passed: all 11 entry/contract/host traces, source-local capture reachability and value origins, both non-awaited Kafka publications, commit-pinned source links and bounded support delivery. The disposable SQLite index can be rebuilt from the bundle and snapshot.

## Remaining gaps

All 23 native gap records, including their actions and evidence, are in [gaps.json](gaps.json). No production workspace model, scan mark or app migration is included.

- `shared-version`: Shared 2.0.32 is unmatched to candidate 2.0.33-SNAPSHOT
- `client-version`: Client 1.3.257 is unmatched to candidate 1.3.274-SNAPSHOT
- `security-policy`: Effective shared middleware not traced
- `expiry-policy`: Expiry mapping/configuration may fail even when computed expiry is unused
- `client-policy`: Retries, timeouts, interceptors and error decoding unresolved
- `deployment-and-config`: Committed defaults do not establish deployed Mongo/PSP destinations
- `response-envelope`: Exact inherited envelope serialisation unresolved
- `completion`: 202 does not establish provider completion or durable write
- `nested-storage-shape`: Inherited fields and nested converters not closed
- `other-failures`: This proof encodes selected 208/422/500/202 paths; decoding, lookup 404, middleware and other failures are not exhaustively encoded.
- `capture-wire`: Effective inherited request and success/error wrapper wire schemas are unresolved at the imported shared-library version.
- `source-wire-closure`: Source members and source-declared validation are retained. Imported nested types, inherited AttributeBase members, framework naming/accessors and effective JSON/BSON serialisation are not fully resolved.
- `mongo-driver`: Spring Data derived query and mapper declarations are known; driver command generation, connection, physical topology and Mongo runtime behaviour are not executed or inspected.
- `local-retry`: The local method exists at this source revision but its full branches, helper calls, effects, retry outcomes and exception paths are not yet extracted into native records.
- `local-resubmit`: The local method exists at this source revision but its full branches, helper calls, effects, retry outcomes and exception paths are not yet extracted into native records.
- `local-manager-get`: The local method exists at this source revision but its full branches, helper calls, effects, retry outcomes and exception paths are not yet extracted into native records.
- `local-manager-create`: The local method exists at this source revision but its full branches, helper calls, effects, retry outcomes and exception paths are not yet extracted into native records.
- `local-charge`: The local method exists at this source revision but its full branches, helper calls, effects, retry outcomes and exception paths are not yet extracted into native records.
- `local-create-transaction`: The local method exists at this source revision but its full branches, helper calls, effects, retry outcomes and exception paths are not yet extracted into native records.
- `refund-validator`: RefundValidatorService contains cart-line loops, currency/amount/quantity and partial-refund rules, permitted stage checks and prior-refund queries. Its internal control/data branches are read but not fully encoded in this bounded batch.
- `refund-delivery`: Producer schedules Kafka send and a logging callback without waiting. Effective serializer/envelope/headers and broker delivery/retry/consumer acknowledgements are not established; no consumer registration exists in this repo.
- `framework-discovery-0`: Imported actuator registrations and exact effective default paths/conditions are not expanded; no source-local controller exists for them.
- `framework-discovery-1`: Imported framework registrations and effective profile/route expansion are not analysed; source config registration family retained.
