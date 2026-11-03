# PSP Integration source capture

This v3 capture covers the available production source of `volvo-cars/cds-paymentservice-psp-integration` at
`dabd6c825499b706ff4ddbf15eaf354adbfb6794`. It selects actual source method graphs for all 20 REST registrations,
the process entry, the Stripe configuration startup callback and 18 advice callbacks. The workspace is
`volvo-cars`. The prior `psp-integration-reviewed` sealed input remains unchanged; old bounded implementation
graphs are excluded from this new revision namespace. The supersession ledger records route correspondence.

All 165 production Java files across the six production modules, application profiles, module dependencies
and imports have been reviewed. There are 448 explicit method declarations and 63 separate lambda frames.
Their declaration/body inventories and source ranges are retained, alongside meaningful source conditions,
actual calls, transformations, exceptions, response construction and boundary operations. The parser inventory
supports this review; counts and structural validation alone do not demonstrate semantic completion.
`source-file-completeness-ledger.json` and `entry-completeness-ledger.json` distinguish this local source scope
from unavailable generated/dependency implementations and mechanical analysis limits. Test fixtures are excluded
from production coverage. Container/delivery declarations were inspected without executing external workflows.

Every ordinary local invocation has actual formal bindings and an instance receiver where applicable. Java
lambda captures are separate copied variable values, including object references, rather than fabricated formal
parameters. Provider/interface calls expand a guarded available Stripe implementation and preserve the other
runtime receiver boundary. No compiler missing-dependency attribution or global short-name guess establishes a
binding. The symbol audit retains namespace/receiver/arity/overload candidates. Client-module bodies have no
established server execution host and create no additional server registrations.

The 23 manually reconciled Stripe SDK calls are native interactions at their actual source operations: five
Customer calls, three SetupIntent/PaymentMethod calls, three payment-method calls, five PaymentIntent calls,
two refund calls and five transfer/charge/reversal calls. The reversal collection's chained `create` is included.
Eight configuration/enrichment helper invocations are also exposed as unresolved library boundaries. Their
imports do not prove network access. All 31 interactions retain caller-owned values, whole immediate results,
exact call evidence, unknown destinations and explicit dependency/runtime gaps. No direct Stripe SDK URL,
transport, published component, retry implementation, JSON body or downstream response wire layout is invented.
Committed `stripe-client.endpoint` properties do not establish the destination of direct `com.stripe` SDK calls.

Caller contracts retain every actual argument through an explicitly labelled source call-signature projection.
Its `argument0`, `argument1`, etc. fields are analysis positions, not an object allocated/passed at runtime or a
wire body. Indexed interaction bindings retain the exact values and each available type/shape. Capture therefore
has both `PaymentIntentCaptureParams` and `RequestOptions`; the positive records query asserts both actual values
and shapes are discoverable. Whole SDK results, `getData`/member projections, DTO mapper results and whole
`BaseResponse`/`SuccessResponse`/`HttpEntity` containers remain separate. Imported wrapper fields stay partial.

`return-type-audit.json` checks 412 calls with source-known local return declarations, including unresolved
same-return declaration candidates. All 84 source-known void calls have null results and define no result value;
conditional void joins also have no result. Before sealing, the draft's generic Builder heuristic was corrected:
`StripeRequestOptionsBuilder.requestOptions` returns `RequestOptions`, rather than its helper receiver type.
The analogous Client heuristic no longer overwrites declared local client/mapper results. These corrections
are recorded with exact source signatures; no invalid draft is promoted as historical evidence.

Customer get-or-create filters deleted/nonmatching customers, selects the oldest remaining customer, then updates
or creates. An empty update parameter map skips SDK update. Search includes the three declared Volvo ID metadata
variants and escaping. Source metadata mutation/order, address/name comparisons and nonnull changes are retained;
generated getters and imported Map/SDK implementations remain separate. Customer PATCH rejects mismatched path/body
PSP or customer identifiers. Setup validates CARD/LINK; manual/null authorise creates a setup intent only, while
automatic requires details and creates a payment method before confirming setup. Payment-method list's missing
customer handling, usage merging, nullable usage and detach failures are separate paths.

Transaction creation applies guest-checkout guards, account mapping, PSP/session-type provider selection,
idempotency fallback and conditional automatic transfer. CardException handling calls cancel before constructing
the intended exception, so cancellation failure can replace it. Capture receives the body's PSP transaction ID;
the path transaction ID is principally logged. Capture params contain metadata and `latest_charge` expansion,
with no amount setter, and the response uses basic `toResponseDto`, without `withAttributes`. Authorise/create
retain their distinct attribute enrichment. Stripe invalidation always throws UnsupportedOperationException.
The create mapper retains source amount conversion, currency, confirmation/capture mode, method alias/automatic
selection, receipt gating, optional transfer, description/locale and metadata/enrichment order. HUF conversion
multiplies the source amount by 100. These are source caller intentions, not closed SDK wire schemas.

Refund retrieval failure becomes Optional.empty and creation continues; mapper branches preserve amount,
PSP transaction ID, transfer reversal and OTHER reason handling. Transfer creation and reversal preserve per-item
success/failure results and options/account failure boundaries. Quiet metadata StripeException logs while keeping
the created item successful. Metadata update orders transfer then destination-payment update without claiming
rollback or atomicity. Mutable attribute lists are source-traced without proving every cross-item alias.

Advice callbacks retain their actual selected parameters, source maps and wrappers. The Forbidden annotation
and body's UNAUTHORIZED status differ; the Unprocessable callback also passes UNAUTHORIZED. Neither discrepancy
is flattened into a single claimed effective HTTP status. Imported exception hierarchy, framework selection and
response-factory behaviour remain boundaries. Client contracts separately retain the unmatched payment-instrument
relationship create request and list/delete wrapper differences; route similarity does not establish compatibility.
The source artifact is 1.3.274-SNAPSHOT, distinct from Transaction's 1.3.257 caller dependency.

App enables scheduling but no local method declares @Scheduled. Reload/refresh cron properties are not fabricated
jobs. Actuator exposure, Swagger settings, Azure provider configuration, Mongo database properties and telemetry
are source configuration observations. No local Mongo operation, broker producer/consumer or message registration
was found; DTO names alone establish none. Imported Spring/configuration/library behaviour remains unresolved.

The query pack executes 106 requests: all 40 entries and representative interactions, effects, whole response
values, source mutation/branch facts, capture-body/signature values, failures and outcomes. Four first pages hit
the 5,000-record support budget; their saved continuation requests finish without a further limit. No maxNodes
limit occurred. All results remain explicitly non-exhaustive and feasibility unchecked. Local source review is
complete within the declared production scope; formal heap/alias state, callback-object correspondence across
arbitrary parameters, implicit exceptions, framework activation and dependency runtime/wire closure are separate
limits, not unexamined local source disguised as external code.

`validation.log` records native schema/reference/ownership validation and pinned local source-range checks.
Only report files were authored. No fetch, source application build/test, live endpoint, database or broker call
was run. The Java 17 parser was used only as a parse-only inventory aid on pinned blobs, without attribution;
compiler-input normalisation preserves offsets and raw evidence remains unchanged.

This immutable successor adds native immediate `returnKind` from 448 source method declarations: 55 void,
366 value and 27 unresolved constructor declarations. The 63 lambda frames remain unresolved where their contextual
return type was not established. Constructors retain source allocation values; they are not mechanically marked
void. Task/Promise-style handles would be immediate values regardless of eventual completion. New validation rejects
results on bound void targets and value-return exits in void methods. All ordinary void calls were already corrected
before the prior seal; this successor changes declarations without rewriting that sealed input. The extended positive
query pack proves all 23 reconciled Stripe SDK calls appear as unknown invocation placeholders from actual REST roots,
with null component identity and unknown edges. No inferred remote Stripe component is required for visibility.
