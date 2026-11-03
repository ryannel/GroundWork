# PSP integration native rescan

The pinned rescan produces a self-contained v3 bundle of **1,203 records**, validated against **601 pinned local source ranges**. Eleven representative query checks pass. The final revision namespace is `psp-dabd6c8-r3/` and the snapshot is `83dca2d1f3de790273d6451f1ba875edfc6f9661680d0124077485d0aec4b24c`.

Repository: `github.com/volvo-cars/cds-paymentservice-psp-integration`, pinned commit `dabd6c825499b706ff4ddbf15eaf354adbfb6794`. Local HEAD is `dabd6c825499b706ff4ddbf15eaf354adbfb6794`. Source inspection is pinned; no remote freshness or deployment check was made.

## Census and coverage

There are **20 explicit server controller actions**: five customer, four payment instrument, five transaction, one refund, three transfer, one Swagger configuration and one version action. Method mappings reside on controller interfaces and class prefixes on their `@RestController` implementations; the inventory combines both. These are 18 business actions and two operational/documentation actions. Deprecated transfer update remains visible.

The client module is callable library code. Its APIs are not counted as another HTTP server. The previous 40 endpoint records were context rather than a census authority. All 20 newly discovered actions have a native entry, implementation, HTTP contract, host execution/entry binding and explicit partial coverage. Capture and refund additionally have examined bounded local control/value obligations. The other 18 remain opaque beyond their recorded contracts and local implementation anchors. End-to-end coverage remains partial for every action because imported libraries and provider SDK behaviour are unresolved.

One `App.main` calls `SpringApplication.run`, proving a separately runnable Spring Boot API host. The Dockerfile supports its executable boundary. Shared, Stripe and client modules execute as libraries, not as separate components. The bundle has one service host and one source-configured Mongo database declaration. The Mongo `payment_services` name and `spring.mongodb.uri` setting are retained, but no local MongoRepository, MongoTemplate, @Document or record-access code was discovered. No storage interaction or persisted business schema is invented from that configuration.

No local message listener, publisher or @Scheduled method was found by the saved main-source searches. `@EnableScheduling` and five refresh cron settings do exist: four paymentservice reload settings plus cloud-config refresh. Five explicit configuration discoveries retain health exposure, Prometheus exposure, Swagger configuration, the four property-refresh settings as one group, and cloud-config refresh as another group. Imported scheduling and management/default-path implementations remain gaps; these configuration groups are not represented as five established jobs. Tests and API-test stub fixtures are excluded from production registrations.

## Runtime and candidate separation

This service source declares **1.3.274-SNAPSHOT**. Transaction’s older imported client **1.3.257** is not proven to correspond to it. A native gap records the mismatch, and no cross-repository implementation binding, `targetEntry` or Transaction→PSP edge is introduced. The bundle is independently useful evidence for this service revision without upgrading the earlier client candidate to an established call target.

All four provider call sites retain native interactions with null targets and explicit unresolved boundaries. They are direct Stripe SDK calls, and `stripe-java` 31.4.1 is declared, but the resolved artefact/digest, SDK HTTP implementation and default destination were not examined. A Stripe class name does not establish a remote runtime component. SDK execution remains within the PSP API host; its outbound implementation remains opaque. Source configuration also contains a `stripe-client.endpoint` declaration for an imported HTTP client, but this is not silently substituted for the direct SDK paths traced here.

Source role annotations require `hasRole('Cds.Payment.Psp.Interaction')` on the business methods, with @Valid and request binding as annotated. App excludes default security auto-configuration and imports EcomWebAppConfiguration. Actual imported enforcement, gateway rewrites, Jackson configuration and response envelope implementation remain explicit gaps.

## Capture flow

`POST /v1/transactions/{transactionId}/psp/{psp}/capture` passes path transactionId, path PSP and the body to PspTransactionService.capture. Local account mapping sets payload.externalAccountId from AccountConfigService when accountId is non-null; the imported lookup implementation is unresolved.

The factory selects a provider using **path PSP** and **payload.paymentSessionType**. This source’s PaymentIntent provider declares STRIPE / PAYMENT. Missing matches throw UnsupportedOperationException, which the generic source advice maps to 500. The provider receives **payload.pspTransactionId**, while the path transactionId is logged rather than sent as the Stripe transaction identifier. A value query asserts that distinction.

The capture mapper constructs metadata from request attributes and adds `latest_charge` to expansion. MetadataService iterates attributes into a HashMap, adds its source/system expressions, creates camel-case alternatives, removes original keys containing spaces, uses putIfAbsent for existing alternatives and retains the special VolvoID alias. Imported AttributeBase fields and external enum/constant definitions remain gaps.

The private retrieve helper calls PaymentIntent.retrieve. A caught StripeException becomes PaymentServiceException with source-selected 404; source advice preserves that status. Normal retrieval permits a second, independently evaluated request-options lookup for capture. Each lookup maps configured account/key identifiers; the source overloads used here set no explicit idempotency key. SDK defaults remain unknown.

PaymentIntent.capture is awaited synchronously. Its StripeException catch creates ApiClientException carrying provider status, user message and resolved error code; advice uses that dynamic status. Normal results map provider id to externalId, status through imported PspStatus.from and constant STRIPE into TransactionDto. The controller returns SuccessResponse.ok with its operation id; the exact inherited envelope and wire representation remain partial.

Private methods containing SDK calls are separate native implementations. Their formals, actual bindings, SDK results and exception exits belong to those methods, preserving invocation contexts rather than moving helper failure into the wrong caller frame. Other local mapper operations retain source expressions and helper evidence at their caller’s computation boundary.

## Refund flow

`POST /v1/refunds/` selects RefundOperation using payload.psp; STRIPE is the local implementation. Missing providers throw UnsupportedOperationException. Internal account id is resolved into request options before enrichment.

The source adds refundId, transactionId, paymentSessionId, customerId and countryCode attributes, then attempts to retrieve the payment intent using payload.pspTransactionId. The private retrieval helper catches StripeException, logs it and returns Optional.empty. **Refund creation continues after this retrieval failure.** On normal retrieval the code adds provider metadata. Imported addAttribute/addAttributes collision and replacement rules are unresolved, so the bundle retains the source ordering without inventing merge precedence.

RefundCreateParams maps pricing amount to Stripe amount (multiply by 100 for HUF; retain other currencies), pspTransactionId to paymentIntent, reverseTransfer to true only for AUTOMATIC, reason OTHER to null and other reasons through enum valueOf, and the enriched attributes into metadata. Null transferMode maps to false. Imported pricing, constants, enums and effective serialisation remain partial.

The private create helper calls Refund.create. Its StripeException becomes PaymentServiceException with the provider’s dynamic status. Normal refund results map provider id to externalId, the internal refund id from returned metadata, provider status through PspStatus.from and constant STRIPE. SuccessResponse.ok wraps the result. No database write, broker handoff or final settlement/delivery guarantee is inferred from either provider call.

## Schemas and source anchors

The bundle contains **192 partial schemas and 689 declared fields**: 90 source model declarations, their separate partial wire projections, route input parts and constructed provider parameter shapes. Local inheritance is expanded; imported AttributeBase, BaseResponse/SuccessResponse and related model inheritance remain gaps. The capture schema retains its declared countryCode pattern `[A-Z]{2}`, required PSP transaction id and inherited local PSP/account/session fields.

Wire projections include explicit JsonProperty names where source declares them. They do not promote Java private names or Swagger @Hidden annotations into a complete Jackson wire contract. Swagger hiding is not treated as proof that a field is absent from JSON. Shared event DTOs retain source/annotated wire schemas, but no listener, producer, topic or durable-message contract is invented merely because the classes are named events.

Field evidence cites the pinned declaration/annotation ranges; interface and implementation route anchors are both retained. Query responses derive GitHub links from those anchors. The source checker confirms pinned Git files and line bounds, not entailment, a separate range digest, deployment or runtime execution.

## Validation and remaining work

Generic native validation succeeded, including the selected closure and all pinned local sources. Eleven saved query checks cover capture trace/interactions, capture 200/404 slices, body-versus-path identifier lineage, metadata parameter lineage, refund branch/control, refund parameter mappings, refund response lineage, schema inspection and scoped effects. They assert native helper ownership, rebuilt request options, unresolved provider targets, no unproven cross-version linkage and the absence of a global no-write claim. All fit their budgets; feasibility remains unchecked and responses remain non-exhaustive.

```sh
npm run knowledge:validate -- reports/volvo-native-rescan/psp-integration/bundle.json --snapshot reports/volvo-native-rescan/psp-integration/snapshot.json --sources /Users/RNEL/.cache/groundwork/clones
node --import ./tools/register.ts --conditions=react-server reports/volvo-native-rescan/psp-integration/queries.mjs
```

Application tests were not read or run. No endpoint, Stripe API, database, registry, fetch or other external service was contacted. Application-wide lint/test/check/build is the parent batch’s responsibility; this task changes only its report directory and no app, schema, skill, workspace or source-repository files.

Next examination: trace the other 18 endpoints; resolve exact shared/web/Stripe artefacts and their imported schemas; inspect account lookup persistence, scheduled refresh and method-security internals; close attribute-merge and pricing/status transformations; and inspect applicable runtime configuration separately. ApiControllerAdvice has source annotation/return-status disagreements in unrelated Forbidden/Unprocessable handlers; this capture preserves their source evidence rather than claiming every annotation proves the actual selected response.

Final artefacts are `bundle.json`, `snapshot.json`, `discovered-entry-inventory.json`, `generation-summary.json`, `query-checks.json`, validation logs, `queries/*.request.json`, `queries/*.result.json` and local generator/harness scripts. Earlier initial/r2 bundles and manifests remain archived and must not be joined as extra facts. Original selected proof IDs were not edited.

## Per-entry reconciliation

| Method | Source application route                                                                          | Bounded local trace | Coverage           |
| ------ | ------------------------------------------------------------------------------------------------- | ------------------- | ------------------ |
| GET    | `/v1/configurations/swagger-config`                                                               | Opaque continuation | Partial end to end |
| POST   | `/v1/customers/`                                                                                  | Opaque continuation | Partial end to end |
| GET    | `/v1/customers/psp/{PSP}/{pspCustomerId}`                                                         | Opaque continuation | Partial end to end |
| GET    | `/v1/customers/psp/{PSP}/volvoId/{volvoId}`                                                       | Opaque continuation | Partial end to end |
| DELETE | `/v1/customers/psp/{PSP}/{pspCustomerId}`                                                         | Opaque continuation | Partial end to end |
| PATCH  | `/v1/customers/psp/{PSP}/{pspCustomerId}`                                                         | Opaque continuation | Partial end to end |
| POST   | `/v1/payment-instruments/setup`                                                                   | Opaque continuation | Partial end to end |
| POST   | `/v1/payment-instruments/detach`                                                                  | Opaque continuation | Partial end to end |
| GET    | `/v1/payment-instruments/{externalCustomerId}/accounts/{accountId}/psp/{psp}`                     | Opaque continuation | Partial end to end |
| GET    | `/v1/payment-instruments/psp/{psp}/accounts/{accountId}/payment-method/{externalPaymentMethodId}` | Opaque continuation | Partial end to end |
| POST   | `/v1/refunds/`                                                                                    | refund              | Partial end to end |
| POST   | `/v1/transactions/`                                                                               | Opaque continuation | Partial end to end |
| POST   | `/v1/transactions/{transactionId}/authorise`                                                      | Opaque continuation | Partial end to end |
| POST   | `/v1/transactions/{transactionId}/psp/{psp}/capture`                                              | capture             | Partial end to end |
| POST   | `/v1/transactions/{transactionId}/cancel`                                                         | Opaque continuation | Partial end to end |
| POST   | `/v1/transactions/{transactionId}/invalidate`                                                     | Opaque continuation | Partial end to end |
| POST   | `/v1/transfers/create`                                                                            | Opaque continuation | Partial end to end |
| POST   | `/v1/transfers/reverse`                                                                           | Opaque continuation | Partial end to end |
| PUT    | `/v1/transfers/update`                                                                            | Opaque continuation | Partial end to end |
| GET    | `/v1/version`                                                                                     | Opaque continuation | Partial end to end |
