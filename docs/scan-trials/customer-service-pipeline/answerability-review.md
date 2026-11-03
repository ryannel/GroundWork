# Customer service question review

Final provenance refresh: trial 003 has byte-identical documents to the reviewed corrected trial 002.
Source pins, native IDs and query-page snapshots are unchanged; the latest scanner fingerprints are in
[trial.json](trial.json). Other repository scans remain stopped.

This review tests useful newcomer questions against the new scan capture, independently of extraction
coverage. The only repository in scope is `volvo-cars/cds-ecom-customer-service`, pinned at
`09623ab3a1f39845d8fc02abc3d591b53a3b5fea`. Earlier execution proofs are not evidence for these answers.
No remote or deployment freshness is inferred from a local source capture.

## Acceptance

The denominator is **22 questions**, chosen before inspecting the new capture. A supported answer must
answer every clause using typed capture records and direct pinned source anchors, retrieved through the
bounded record API. A partial answer establishes a useful narrower fact while identifying missing clauses.
An unsupported answer lacks the required capture relationship. Reading raw Git source helps design the
questions and check the result, but does not turn an unsupported pipeline answer into a supported one.
Framework annotations are declarations until their effective bindings are established. Local execution
structure does not establish successful publication, delivery, transactions, actor intent or live state.

The independent pinned inventory is 340 Java files: 256 under `src/main` and 84 under `src/test`.
The three controller interfaces declare 19 HTTP mappings: CustomerController 15, AuditLogController 2 and
MigrationController 2. These counts describe source declarations, not deployed routes.

## Questions fixed before capture review

All paths below are relative to the pinned repository. API means
`customer-service-api/src/main/java/com/volvocars/ecom/customerservice`; core means
`customer-service-core/src/main/java/com/volvocars/ecom/customerservice`; shared means
`customer-service-shared/src/main/java/com/volvocars/ecom/customerservice`.

| ID  | Newcomer question                                                                                                                               | Required evidence and likely source                                                                                                                                                |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Q01 | Which HTTP operations does customer service expose, with their complete paths and request/response types?                                       | Interface annotations joined to implementation prefixes and schema references; API `api/customer/v1/*Controller.java` and `impl/*ControllerImpl.java`.                             |
| Q02 | Which roles may read, change, duplicate, archive and migrate customers, and where are they enforced?                                            | Policy declarations plus effective enforcement bindings; the three controller interfaces and security configuration.                                                               |
| Q03 | Which customer and individual request fields are mandatory, and how do create, update and patch validation differ?                              | Field shapes, validation groups and wire binding; shared `customer/CustomerRequest.java`, `individual/IndividualRequest.java`, API controller annotations.                         |
| Q04 | How do PUT and PATCH change an existing customer, including omitted fields?                                                                     | Request-to-factory value lineage, update/patch branches and persistence; core `customer/CustomerService.java` and `CustomerFactory.java`.                                          |
| Q05 | What happens when an individual update names an individual that the customer does not contain?                                                  | Membership guard, thrown exception, handler binding and HTTP outcome; core `CustomerService.java`, API exception handlers.                                                         |
| Q06 | What does duplication preserve, which identifiers are replaced, and does the result include the original customer?                              | Duplication loop, factory field lineage, saves and result construction; core `CustomerService.java`, `CustomerFactory.java`.                                                       |
| Q07 | Does an unchanged customer write reach validation, MongoDB or publication?                                                                      | Equality guard and return, ordered subsequent statements; core `CustomerService.saveAndPostProcess`.                                                                               |
| Q08 | Does `forceArchive=true` archive immediately or mark the customer for later, and what is the default reason?                                    | Parsed boolean branch, calls and resolved argument; API `impl/CustomerApiService.java` 117–127.                                                                                    |
| Q09 | When restoring an archived customer, what happens to its version, archival timestamp and the archived record?                                   | Field lineage, save-before-delete order and failure boundaries; core `customerarchive/CustomerArchiveService.java` 55–82.                                                          |
| Q10 | How can a caller fetch a customer's audit history or a particular version, and how are results ordered and paginated?                           | Route/request binding through service to repository query and response; API AuditLogController and core `auditlog`.                                                                |
| Q11 | How is `X-User-Access-Token` checked and resolved across Volvo ID, Connect and Entra ID tokens?                                                 | Header/interceptor binding, issuer guards and token-specific dispatch; API `security`, core `security/UserIdentityResolver.java`.                                                  |
| Q12 | Which external systems supply an individual's profile, and what is sent and returned at each boundary?                                          | Boundary bindings, request/response contracts and failure handling; core `volvoid`, `connecttoken`, `entraid`, `consumer`.                                                         |
| Q13 | How are Fleet and Partner corporate entities looked up and combined with a customer?                                                            | Factory dispatch, outbound boundary and result lineage; core `company`, `fleet`, `partner`.                                                                                        |
| Q14 | Which MongoDB collections hold active customers, archives and audit history, and which code reads or writes them?                               | Store and collection identities, repository binding and read/write effects; core `customer`, `customerarchive`, `auditlog`, Mongo configuration.                                   |
| Q15 | After saving a changed customer, what publications and audit writes are attempted, in which order and with which failure/completion guarantees? | Saved-value rebinding, ordered post-processing, effect acknowledgement and async boundaries; core `CustomerService`, `CustomerSavePostProcessor`, event/audit services.            |
| Q16 | When is a marketing consent event skipped, and which changed consent fields reach the event?                                                    | All skip guards, previous/current comparison and event-field lineage; core `consent/MarketingConsentEventService.java`.                                                            |
| Q17 | How are customer and analytics event types chosen for new, updated and archived customers, and where are they published?                        | Event-type branch values, payload contract and configured topic bindings; core `messaging/CustomerEventService.java`, `analytics/AnalyticsEventService.java`, event configuration. |
| Q18 | Which incoming event deletes a customer, and what are the subscription, payload and resulting effects?                                          | Kafka subscription, deserialisation, customer-id lineage, deletion and failure policy; core `messaging/consumer/DeleteCustomerEventConsumer.java` and configuration.               |
| Q19 | Which order changes mark or restore a customer, and which order categories and statuses are ignored?                                            | Complete event filters, branches, reason mapping and restore/save effects; core `messaging/consumer/OrderUpdateEventConsumer.java`.                                                |
| Q20 | What schedules archival, when is it enabled, how is concurrent execution limited, and what happens after one customer fails?                    | Scheduled/conditional/lock declarations joined to configuration, async activation and per-customer catch; core `customerarchive` and API resource configuration.                   |
| Q21 | Which people or callers can perform which customer actions, and what visible outcome follows each action?                                       | Actor, surface, control, action, execution and outcome records; technical role annotations alone are insufficient.                                                                 |
| Q22 | Which source revision and analysis versions does the answer reflect, and is it current remotely and in production?                              | Source baseline, analysis fingerprints and reference observations; explicit limits for unobserved remote/deployment state.                                                         |

## Independent raw-source check

The archive question is deliberately consequential: CustomerController's `forceArchive` description says
true marks the customer for later. The implementation does the reverse: `!forceArchive` calls
`markForArchival`, defaulting the reason to `NONE_SPECIFIED`; true calls `moveCustomerToArchive` immediately
(CustomerApiService 119–127). A faithful pipeline answer must follow executable structure and report the
conflicting declaration. This manual observation is not a pipeline answer.

## Capture review

The final selection is `reports/customer-service-pipeline-002/repository.json`. Trial 001 remains the
original cold/warm measurement; 002 reuses its source/index cache and quarantines recovered ASTs from six
files that the installed Java 17 parser cannot parse faithfully. There are 21 diagnostics across those six
files. The other 334 Java files retain native facts. Quarantine retains pinned source and a gap, rather than
presenting recovered syntax as an accepted semantic graph. Neither trial updates the production map.

**None of the 22 questions is supported in full; 20 are partial and two are unsupported.** Partial
means the capture gives a useful narrower source fact, not that the requested end-to-end answer is proven.
All 340 broad scanner questions remain unresolved. The independent review below does not rewrite those
receipts. Empty contract/effect/actor arrays establish missing capture support, not absence in the system.

The capture does answer narrower useful questions:

- **What does equal input do inside `saveAndPostProcess`?** It returns before validate/save/post-process.
- **Which calls follow the boolean branch inside `CustomerApiService.archiveCustomer`?** False calls
  `markForArchival`; true reaches `moveCustomerToArchive`. Missing reason resolves to `NONE_SPECIFIED`.
- **In what order does `CustomerSavePostProcessor.postProcess` invoke its collaborators?** Customer event,
  analytics event, audit save, then consent event, on normal local completion.
- **Which local consent checks exit before `sendSafely`?** Missing/disabled Kafka, missing individual/CDB ID,
  missing consent, and unchanged consent.

These answers come from the new native graph and bounded evidence pages. They are useful source facts;
they do not discharge the broader frozen questions about complete writes, effects and execution.

The bounded evidence exports are in
[`answerability/`](../../../reports/customer-service-pipeline-002/answerability/), with a concise
[`evidence-summary.json`](../../../reports/customer-service-pipeline-002/answerability/evidence-summary.json).
Each probe file contains the actual reader page envelopes, snapshot hashes, native records and pinned
sources. There are 21 probes, including two for Q04 and none for actor/freshness claims. Twenty deliver
6,503 records in 1,632 pages (2,811,518 page-envelope bytes); Q19 selects no native evidence after quarantine.
Budgets are 32 selected IDs per chunk, four records and 65,536 bytes per page, with an explicit total cap
of 2,048 records and 512 pages per probe. Missing, ambiguous or incomplete evidence cannot produce a
supported receipt. These exports include declarations and unresolved candidates as well as narrow proofs;
exporting a record does not make its interpretation supported.

| ID  | Result      | Actual answer available from the capture, and what is missing                                                                                                                                                                                                                                                                                                                                                                                                                    |
| --- | ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Q01 | Partial     | The `getCustomer` declaration retains the `{customerId}` literal, request parameter, response type and mapping annotation candidate. There is no typed HTTP contract binding all 19 declarations to their implementation prefixes, effective routes and wire schemas. The capture does not answer the complete route inventory.                                                                                                                                                  |
| Q02 | Partial     | The archive declaration retains the `hasAnyRole('Cds.Ecom.Customer.Admin', 'Cds.Ecom.Customer.Archive')` policy literal. This is a declared condition; no control/action or enforcement binding establishes which effective callers can execute it.                                                                                                                                                                                                                              |
| Q03 | Partial     | CustomerRequest has typed declarations for `dataVersion`, `corporateEntities`, `individuals`, `customerType`, `market`, `hasAcceptedTerms` and `featureFlagDeterminants`, with annotation candidates. There are no wire contracts or effective validation-group bindings proving mandatory create/update/patch fields.                                                                                                                                                           |
| Q04 | Partial     | `updateCustomer` calls `customerFactory.update`; `patchCustomer` calls `customerFactory.patch`; both pass their result to `saveAndPostProcess`. Cross-call factory/omitted-field semantics and serialised request binding remain unclosed.                                                                                                                                                                                                                                       |
| Q05 | Partial     | The local update method retains a membership guard and typed `throw` constructing `IndividualNotFoundException(individualId)`. The capture lacks the end-to-end exception-handler/HTTP outcome binding, so it cannot establish the response a caller sees.                                                                                                                                                                                                                       |
| Q06 | Partial     | The local code generates `numberOfDuplicates - 1` copies, calls `saveAllAndPostProcess`, and constructs a list beginning with the original customer ID. Identifier replacement and preserved fields need factory lineage and stream callback bindings; durable saves are not established.                                                                                                                                                                                        |
| Q07 | Partial     | Inside `saveAndPostProcess`, equality exits before validation, repository save and post-processing; otherwise those calls occur in that local order. The frozen question covers an unchanged customer write as a whole. Factories/callers may validate or perform effects before reaching this helper, and all endpoint entry paths are not proven.                                                                                                                              |
| Q08 | Partial     | Inside CustomerApiService, `forceArchive=false` marks for later and returns; true reaches the immediate `moveCustomerToArchive` call. A missing reason becomes `ArchiveReason.NONE_SPECIFIED`. The retained controller description conflicts with that branch. The missing clause is the actual archival effect: calling `moveCustomerToArchive` does not prove that the customer was moved successfully. The helper catches failures; effect/acknowledgement closure is absent. |
| Q09 | Partial     | Restore builds a version-reset customer, computes conditional archival data, invokes `saveCustomer`, then deletes the archived record. Local order is supported. Effective stored shape, atomicity and what remains after failure are not established by effect/acknowledgement records.                                                                                                                                                                                         |
| Q10 | Partial     | Audit pagination constructs `PageRequest.of(page, limit)`, invokes `findAllByCustomerIdOrderByVersionDesc` and builds pagination from the returned page. The repository method name and local call are retained; effective Mongo ordering, complete route/request bounds and wire output are not bound.                                                                                                                                                                          |
| Q11 | Partial     | The resolver has a token-present guard and local dispatch to Volvo ID, Connect and Entra ID identity handling. TrustedIssuerValidator and OidcTokenDecoder are quarantined, so the capture cannot prove issuer checks or complete authentication/enforcement.                                                                                                                                                                                                                    |
| Q12 | Partial     | VolvoIdService calls `volvoIdClient.getUserInfo(userAccessToken)` and sanitises its result; its failure path returns an empty optional. This locates one profile lookup. Typed outbound HTTP contracts, all profile sources and effective serialisation remain missing.                                                                                                                                                                                                          |
| Q13 | Partial     | Corporate creation generates an ID, validates registration/Fleet inputs and calls address/email/phone mappers. This is useful local structure. Fleet/Partner boundary identities, requests, responses and their complete customer lineage are unbound.                                                                                                                                                                                                                           |
| Q14 | Partial     | The customer declaration retains the `customers` collection annotation candidate and typed fields, and repository declarations are captured. No store identities or read/write effects bind all active/archive/audit collections to effective Mongo operations.                                                                                                                                                                                                                  |
| Q15 | Partial     | The post-processor locally calls customer publication, analytics publication, audit save and consent publication in that order. Q07 also establishes save-before-post-processing. No effect acknowledgements, delivery proof or failure/transaction closure establish the requested completion guarantees.                                                                                                                                                                       |
| Q16 | Partial     | Four local guards exit before `sendSafely`: missing/disabled Kafka, missing individual/CDB ID, missing consent and unchanged consent. Changed-consent payload fields and effective wire publication remain unclosed.                                                                                                                                                                                                                                                             |
| Q17 | Partial     | Customer event selection branches to `CUSTOMER_CREATED` for no previous value, `CUSTOMER_ARCHIVED` for archival data and `CUSTOMER_UPDATED` otherwise. This is local event-type selection; analytics payload contracts and configured topic/publication bindings remain missing.                                                                                                                                                                                                 |
| Q18 | Partial     | The delete consumer passes `event.getPayload().customerId()` to `customerService.deleteCustomer`. Kafka listener/topic annotations are candidates. Subscription, payload contract, deserialiser guarantees and broker failure/delivery semantics remain unbound.                                                                                                                                                                                                                 |
| Q19 | Unsupported | OrderUpdateEventConsumer is quarantined after a parser diagnostic. The final capture retains source and an explicit gap, with no accepted local/native graph for its order-status filters or archive/restore behaviour. Raw source could answer this manually; it is not a pipeline answer.                                                                                                                                                                                      |
| Q20 | Partial     | The scheduler's local `run` calls `customerArchiveJob.start`; scheduled/conditional/locking annotations survive as declarations. Resource configuration is retained as unparsed text. Effective cron, lock, enablement, asynchronous activation and per-customer continuation are not joined into an execution answer.                                                                                                                                                           |
| Q21 | Unsupported | No actor, surface, control, action, outcome, execution or journey records close this question. Role strings cannot establish people, intent, visible results or actor-to-action journeys.                                                                                                                                                                                                                                                                                        |
| Q22 | Partial     | Source anchors identify the full pinned commit, and shard baselines record analysis fingerprints. The run observes local HEAD. There is no remote observation or deployment evidence, so remote and production freshness are unknown.                                                                                                                                                                                                                                            |

## Representative native evidence

Q07's function is `semantic:f20f505924c7296deafee169`, with direct source
`source:f20f505924c7296deafee169` at CustomerService 251–263. Its equality guard is
`semantic:1f43495bf30d3ea7fda95b0f`; edge `semantic-edge:3167:semantic:1f43495bf30d3ea7fda95b0f`
links its typed condition, and `semantic-edge:3168:semantic:1f43495bf30d3ea7fda95b0f` links the
consequent. Typed ordered statements and a direct terminal return establish the exit before the three
calls. The Q07 probe retrieves all 221 selected records in 56 pages. Removing the condition relation while
keeping display syntax unchanged makes the independent checker reject the same claim.

Q08's function/source pair is `semantic:5f723b73984388f0022000e1` /
`source:5f723b73984388f0022000e1` at CustomerApiService 117–128. Its conditional reason expression is
`semantic:9454f0cfb43b61eb7b980648`; edges `semantic-edge:1415:semantic:9454f0cfb43b61eb7b980648`,
`semantic-edge:1416:semantic:9454f0cfb43b61eb7b980648` and
`semantic-edge:1417:semantic:9454f0cfb43b61eb7b980648` give the condition, consequent and otherwise
values. `semantic-edge:1583:semantic:3389dbd2e4956e24220f3532:binding` binds that expression to the
resolved reason. The Q08 probe retrieves 231 records in 58 pages, including these relations and their sources.
The branch/call checks are automated; reading the typed conditional and binding records supplies the
reason-default clause. No declaration display string supplies executable branch semantics.

The Q15 post-processing proof retrieves 133 records in 34 pages; Q16's guard proof retrieves 766 in 192;
Q18's customer-ID argument proof retrieves 270 in 68. These useful proofs remain partial answers to their
broader questions because their missing effect/contract/runtime clauses have not been discharged.

The generic query tool is `tools/scan-answerability.ts`, using exact source paths and parsed function names
(or a source module), refusing ambiguous selections. It never reads application source or imports old
proofs. Run it with `node --import ./tools/register.ts --conditions=react-server tools/scan-answerability.ts
<document.json> <probes.json> <output-directory>`. Probe JSON and output pages are retained beside the
final capture. The small adversarial tests cover erased condition relations with unchanged display syntax,
nested conditional returns, a guarded side effect, ambiguous functions and invalid output identifiers.

The remaining work is therefore semantic binding and question closure, rather than another claim of source
coverage: route and wire contracts; validation/enforcement; store and publication effects; framework/runtime
activation; actor-visible outcomes; and a parser that accepts the six quarantined source files faithfully.
