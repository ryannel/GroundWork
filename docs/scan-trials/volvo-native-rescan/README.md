# Volvo canonical rescan

Twenty-three repositories have completed their pinned local-source pass and independent acceptance review.
All active code scans are stopped at the user’s explicit request. No further source reading, extraction or scan acceptance will run until the schema and process have been discussed. Conditional Order remains an unsealed partial draft; CDLS retains its reviewed bounded units and incomplete wider scope. Neither counts as a completed repository.
**76 of the 101 previously scanned repositories have not yet started this enrichment pass.**
[Pipeline observations](pipeline-observations.md) preserve the measured costs and questions for the discussion before resuming.
Seven imported-discovery checkpoints are tracked separately. [Scan state](scan-state.json) records exact
commits, selected revisions and remaining work. An [earlier offline availability preflight](availability/summary.json) checked 78 repositories that were then unstarted and found their pinned parent trees and blob objects locally available. This checks availability only; it does not count as source review, and child gitlinks/dependencies still need separate checks.

A completed local-source pass means all available source and registrations have been reconciled with the
capture, exclusions and gaps. It does not mean every query proves runtime behaviour, path feasibility,
heap state, imported implementation policy or deployment. Node limits and unresolved dispatch remain explicit.

## Reviewed repository selections

| Repository                                                                                     | Records | Checked pinned ranges | Main acceptance limits                                                                                                                           |
| ---------------------------------------------------------------------------------------------- | ------: | --------------------: | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| [Transaction](captures/payment-transaction-complete-r6/README.md)                              |  56,113 |                 4,417 | Largest create-route views retain node limits; actual conditional repository method references checked                                           |
| [Assortment](captures/assortment-api-complete-r5/README.md)                                    |  54,223 |                 7,127 | No node limits; internal processor views use implementation queries; imported delegate dispatch remains unresolved                               |
| [Manage and Segment](captures/manage-and-segment-complete-r3/README.md)                        | 126,768 |                 6,638 | Database/auth/topic edges and staging/save contexts checked; full startup view retains a node limit                                              |
| [PSP Inbound](captures/psp-inbound-complete-r3/README.md)                                      |  10,713 |                   636 | No node limits; POST publication and actual topic/key/message lineage checked                                                                    |
| [Customer](captures/payment-customer-complete-r8/README.md)                                    |  15,577 |                 1,564 | No node limits; Mongo/PSP boundaries and original/anonymised PII lineage checked                                                                 |
| [Account Profile](captures/account-profile-api-complete-r2/README.md)                          |   6,996 |                   854 | No node limits; source SDK arguments, configuration and return contracts checked                                                                 |
| [PSP Integration](captures/psp-integration-complete-r2/README.md)                              |  31,278 |                 3,868 | Source SDK invocation and argument schemas retained; imported Stripe wire behaviour unresolved                                                   |
| [Scheduler](captures/payment-scheduler-complete-r1/README.md)                                  |  27,184 |                 1,447 | Broad polling views retain node limits; smaller notification query positively reaches Kafka                                                      |
| [CaaS Car Configurator](captures/caas-car-configurator-complete-r2/README.md)                  |  96,266 |                12,479 | gRPC/SQL/solver boundaries checked; CreateRuleset whole-entry and two owner traversals retain cutoffs                                            |
| [CCE configuration generator](captures/cce-configuration-generator-complete-r6/README.md)      | 137,812 |                 8,904 | All9 REST roots positive; broad sync/generate/project-cars queries remain bounded; conditional Kafka and commit semantics checked                |
| [CCE Admin UI](captures/cce-admin-ui-complete-r4/README.md)                                    | 285,492 |                27,855 | Browser/server/store separated; all291 generated callers match stored contracts; seven broad policy/value roots bounded                          |
| [CCE car-spec adapter](captures/cce-car-spec-adapter-complete-r2/README.md)                    | 118,415 |                14,282 | All7 REST roots positive; broad views bounded; four shared Sentry projections remain host-ambiguous                                              |
| [CCE CPAM ingress](captures/cce-cpam-ingress-complete-r5/README.md)                            | 160,947 |                18,713 | All5 businessREST roots positive; HTTP/Azure and local/filesystem hosts separated; broad views bounded                                           |
| [CCE Filter Service](captures/cce-filter-service-complete-r3/README.md)                        |  60,208 |                 3,633 | NativeSQLcolumns/selection mapped; coroutine/worker execution separated; broad views bounded                                                     |
| [CCE protobuf contracts](captures/cce-pb-contracts-complete-r1/README.md)                      |     961 |                   515 | Pure declaration catalogue; nested types/tags/optional/deprecation retained; Timestamp source external                                           |
| [CCE optimisation API](captures/cce-optimization-api-complete-r3/README.md)                    | 115,349 |                11,428 | GraphQL fields/composition callbacks separated; Singleton cache guard retained; imported scheduling and missing child sources explicit           |
| [PRINS configuration validator](captures/cce-prins-validator-complete-r1/README.md)            |  10,680 |                 1,302 | All3 actual startup-rooted external requests positive and unbounded; broad component views bounded; imported wire and scheduling limits retained |
| [CCE Policy Admin](captures/cce-policy-admin-complete-r2/README.md)                            |  34,109 |                 4,532 | 181independent queries unbounded; same-host command/map/file resources; default Fx activation and imported delivery remain unresolved            |
| [CCE Retail Ingress](captures/cce-retail-ingress-complete-r1/README.md)                        |  25,378 |                 3,202 | Both authenticated roots positive;70independent queries unbounded; local/Kafka alternatives separate;25childblobs missing                        |
| [Cart Service](captures/cds-ecom-cart-service-complete-r1/README.md)                           |  12,329 |                 1,490 | 178independent queries unbounded; actual GraphQL/scheduler/migration paths; declared auth policy callbacks separate                              |
| [Customer CRM Synchronizer](captures/cds-ecom-customer-crm-synchronizer-complete-r1/README.md) |  12,206 |                 1,422 | 85independent queries,6broadlimits; actualREST/threeindependent consumer groups and I/O/value positives                                          |
| [CCE optimisation facade](captures/cce-optimization-facade-complete-r1/README.md)              | 338,292 |                40,525 | 43independent queries/81pages;8broadbounds;11HandleSQLcontrol proofs separate from unresolved generic endpoint dispatch                          |
| [Customer Service](captures/cds-ecom-customer-service-complete-r1/README.md)                   |  53,496 |                 5,880 | 51independent queries/54pages,10broadbounds;19REST/2subscriptionsMongo positives;separateAsync/client/publisher boundaries                       |

The twenty-selection checkpoint passes a [fresh schema, hash and pinned-source replay](validation/reviewed-twenty.json): 1,386,798 records and 134,886 checked ranges. The [nineteen-selection checkpoint](validation/reviewed-nineteen.json) remains available. The [latest application checks](validation/application-checks-caller-provider.json) pass after caller/provider-link hardening: 2,401 tests, 100% type coverage and a 391-page build. The [earlier application checkpoint](validation/application-checks.json) remains available. These remain separate repository selections.

Each link retains its bundle, immutable snapshot selection, source/depth reports, ledgers and compressed
query evidence. Replacements correct source-known void results while preserving real Task handles and
separate object allocations. Original sealed inputs and earlier reviewed selections remain available.

## Work in progress

The CDLS monorepo has a separately reviewed [EV Subsidy API unit](staged/cdls/ev-subsidy-api-001/README.md): four endpoints, 670 records and 31 independent queries without truncation. Its wider UI, SSR, shared code and other applications remain in progress. This checkpoint does not advance the completed repository count. The [browser callback successor unit](staged/cdls/ev-subsidy-wizard-002/README.md) links actual address/income callbacks to that same API, retaining both schemas. Its combined selection contains 1,014 records and passes 27 independent queries over 44 pages without traversal cutoffs; the rest of the UI remains pending. The separate [Site Navigation Functions unit](staged/cdls/site-navigation-functions-002/README.md) adds a Service Bus batch handler and its two guarded workflow-launch contexts: 379 records and 44 independent queries without truncation. The final [direct HTML fetch-helper checkpoint](staged/cdls/ev-subsidy-embed-fetch-003/README.md) reuses the EV server:656new records plus670unchangedAPIrecords,250combined ranges and20independent queries without truncation. CDLS is stopped here; actual SSR wrappers and the wider monorepo remain unfinished.

## What the data answers

| Question                                                            | Source and query evidence                                                                                                                                            |
| ------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Which component runs an endpoint and which components can it reach? | Explicit entry/execution bindings, actual I/O interactions, configured targets and source contracts; unresolved SDK effects stay visible without invented components |
| What branches, fails or returns beneath an endpoint?                | Source-owned method bodies, guards, exception/finally paths, invocation contexts and exact response construction                                                     |
| What information reaches another system?                            | Actual source argument values, source signatures and DTO/envelope schemas; declared source types remain separate from effective wire payloads                        |
| Where is data held, and can a request fail after writing?           | Actual store interactions, staged fields, save invocation contexts and acknowledgement boundaries; Customer and Transaction retain later failures after writes       |
| What happens after a request returns?                               | Non-awaited work, handles, lexical captures, callback registration and separate continuations; publication acknowledgement does not imply durability                 |
| Where does a cache read come from?                                  | Assortment Classification reaches Blob; deserialisation failure differs from cache-provider failure; Redis callbacks are separately captured                         |
| How do retry jobs become notifications?                             | Scheduler polling, attempt results, state saves and notification construction; stored event key is distinct from response-derived payload IDs                        |
| Which state stays inside a process?                                 | Policy Admin maps, car-specification file and command channel have explicit local resource bindings; volatile state and later Azure writes remain separate           |
| Where did a fact come from?                                         | Repository, pinned commit, file, symbol and exact source lines; source links resolve to commit-pinned GitHub anchors                                                 |

The [component-first capture explorer](views/capture/runtime/index.html) is the earlier bounded visual proof.
Its [screenshot checks](views/capture/runtime/visual-check.json) found no page, box or label overflow. It has not
been replaced by the full repository captures and should not be presented as their full topology.

## Hardening from review

[Schema hardening](../schema-hardening.md) and [runtime/query contracts](../runtime-components.md) record the
changes. Native v3 now represents source-known return kinds, ordinary receivers, lexical captures, non-awaited
local work, non-REST source entries including unary gRPC, conditional write intent and cross-method staging/save.
An unknown save policy retains its typed write association and an explicit gap rather than guessing upsert.

Independent acceptance checks actual positive database, remote and publication paths, plus negative local-call
cases. Schema validity and valid file ranges alone cannot establish semantic accuracy. Review previously found
truncated method bodies, inner DTOs substituted for whole responses, local source mistaken for unavailable
libraries, false store edges on helpers, and invented void-call values. Corrected immutable revisions retain
the findings and their replacements.

## Combined selection and remaining work

The earlier [reviewed seven-repository snapshot](batches/reviewed-seven/README.md) remains the selected bounded
baseline, with 15,736 records and 4,318 checked ranges. The larger repository selections above are independent;
a [combined candidate](batches/full-source-eight/README.md) reconciles their shared records and passes 61
independent query replays, but historical supporting graphs and current
registrations still require deliberate catalogue handling before application adoption. An internal processor
view is not a second broker registration. A generic publisher is never joined to a consumer just by name.

The wider [inventory](inventory.json) and [repository list](repositories.tsv) retain all source selections.
Old endpoint counts describe the earlier model, not an exhaustive route census: the new CaaS review finds
nine actual gRPC methods, while the admin UI review finds 48 actual route exports in 38 files. The Admin UI and CaaS have passed independent acceptance; broad queries retain explicit limits.

The pass reads the previous pinned revisions without fetching newer code or advancing production scan marks.
No production application/workspace migration, source application build/test, live endpoint/store/broker call,
commit or pull request has been made. Source-local completion, independent query acceptance and runtime
certainty are tracked separately throughout the remaining repositories.
