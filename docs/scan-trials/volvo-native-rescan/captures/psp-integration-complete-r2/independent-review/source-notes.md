# PSP Integration source review

Root inspected the 14 complete pinned source files listed in source-review.json. This is a bounded independent review, not another whole-repository scan.

Capture first builds metadata plus latest_charge expansion, then retrieves the PaymentIntent before the capture try/catch. No amount is set. Capture returns the basic response DTO; create and authorise use the attribute-enriched response. Service capture selects PSP from its path argument, but the remote transaction identifier comes from payload.pspTransactionId, not the path transactionId. The path remains logging/context input.

Authorise validates invoice incompatibility before retrieval. RequestOptions overloads distinguish InternalAccountId from StripeAccountId and return RequestOptions, with source account lookup and API-key selection retained as library/configuration facts. Create idempotency uses nullable supplied idempotencyKey or transactionId. Create CardException invokes local cancel before throwing its PspTransactionException; cancellation itself can fail. SDK URL/wire serialization remain external.

Create amount has a source HUF x100 conversion; capture has no such amount argument. Automatic transfer gates destination-account mapping and transfer data/on-behalf-of construction. Receipt email and product-name description have separate market capability lookups. Preferred French-Canadian locale controls source description translation after an optional PSP customer lookup.

Customer search chooses minimum created time from returned filtered data. getOrCreate updates an existing found customer, otherwise calls create. An empty update params map skips the remote update; deletion retrieves first. These calls require actual SDK interactions and source construction values rather than treating local wrappers as network boundaries. Source configuration sets global network retries only when maxNetworkRetries is non-null; external retry implementation is not inspected.

Open review item sent to author: draft inferred SDK argument types labelled RequestOptions-returning helper expressions as StripeRequestOptionsBuilder. Await source-known type correction or an explicitly unresolved type before final acceptance. Native value/shape correspondence must be checked on the stable candidate.
