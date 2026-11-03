# Volvo capture endpoint scan trial

Endpoint control and data flow are core scan requirements. This trial tests those requirements against one
real endpoint and records what the existing handler model loses. It is a static source inspection, not an
endpoint invocation, a Java test run or a production observation. The Volvo workspace has not been changed.

- Requirements: [endpoint-flow.md](../../.agents/skills/groundwork-explore/endpoint-flow.md).
- Structured evidence: [volvo-capture.endpoint-analysis.yaml](volvo-capture.endpoint-analysis.yaml).
- Control-flow drawing: [volvo-capture.svg](volvo-capture.svg).

## Scope

`POST /v1/payment-sessions/{paymentSessionId}/transaction-capture` in
`volvo-cars/cds-paymentservice-transaction` at `020d2fabb141b47b6d1e8173c02405795f71613a`, inspected on
23 October 2026. This is the application route. The committed configuration also declares `/payments` as a
virtual path; an effective public gateway URL was not established.

The trial follows registration, the controller, capture logic, local service/repository/mapping code,
transaction state predicates and HTTP exception handling. It reads existing controller and service tests as
assertions. It also inspects candidate shared-library and PSP-integration source at their separately pinned
revisions. Those candidate sources do not match the declared dependency versions, so the endpoint remains
**partial end to end**. No freshness comparison with remote branch tips was made.

The companion contains 37 source references, 16 control steps, 11 value bindings and nine explicit gaps.
Source references include full repository, file, line range and commit. Significant steps and data mappings
refer to those sources; candidate evidence is distinguished by repository role and gap references.

## What runs

1. The route declares `Cds.Payment.Transaction.Interaction` as its required role and validates the request
   body. Effective shared filter behaviour remains unresolved; the existing no-auth test asserts 401.
2. Load the session by the path's `paymentSessionId`. Shared repository implementation and the collection
   declaration are available only at a candidate library revision.
3. Map the session into an internal object. This mapper also computes `expireAt` from `created` and configured
   expiry, even though capture does not use that value. Mapping is therefore part of the failure analysis.
4. Load the transaction identified by `session.transactionId`, then map its stored entity into `Transaction`.
5. Check completion in the current stage **and stage history**. A completed transaction throws an exception
   that the controller catches to return 208, without invoking the capture client.
6. Reject `captureMethod == AUTOMATIC`, then reject a null external reference, then require the stage
   `PROCESS / REQUIRES_CAPTURE`. These checks occur in that order.
7. Construct a downstream capture payload from incoming attributes and stored transaction values.
8. Invoke `TransactionClient.capture` synchronously. Read its response data and discard it. The service returns
   the previously loaded transaction, which the controller also ignores.
9. Construct `SuccessResponse.accepted(null, operationId)` and return HTTP 202. No explicit local save or
   publication appears in the inspected capture path. Unresolved shared code and downstream completion prevent
   a global claim that no other side effects occur.

Primary evidence:
[route](https://github.com/volvo-cars/cds-paymentservice-transaction/blob/020d2fabb141b47b6d1e8173c02405795f71613a/cds-paymentservice-transaction-api/src/main/java/com/volvocars/ecom/paymentservice/transaction/api/paymentsession/v1/PaymentSessionController.java),
[controller](https://github.com/volvo-cars/cds-paymentservice-transaction/blob/020d2fabb141b47b6d1e8173c02405795f71613a/cds-paymentservice-transaction-api/src/main/java/com/volvocars/ecom/paymentservice/transaction/api/paymentsession/v1/impl/PaymentSessionControllerImpl.java),
[capture implementation](https://github.com/volvo-cars/cds-paymentservice-transaction/blob/020d2fabb141b47b6d1e8173c02405795f71613a/cds-paymentservice-transaction-core/src/main/java/com/volvocars/ecom/paymentservice/transaction/capture/CaptureTransactionService.java).

## Branches and outcomes

| Condition                                                               | Local result                                                                                      | Downstream capture    |
| ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- | --------------------- |
| Current or historical `COMPLETE / SUCCEEDED`                            | 208 from controller catch                                                                         | Not called            |
| Session capture method is `AUTOMATIC`                                   | Exception carrying 422, mapped by local advice                                                    | Not called            |
| Transaction external reference is null                                  | Exception carrying 422                                                                            | Not called            |
| Non-null stage is not `PROCESS / REQUIRES_CAPTURE`                      | Exception carrying 422                                                                            | Not called            |
| Stage is null                                                           | Stage predicate fails; rejection message dereferences null, allowing a generic 500 through advice | Not called            |
| Transaction repository result is empty                                  | Exception carrying 404                                                                            | Not called            |
| Capture client returns a non-null wrapper without an uncaught exception | 202; response data ignored                                                                        | Called                |
| Request decoding/Bean Validation exception reaches local advice         | 400                                                                                               | Handler not reached   |
| `PaymentServiceException` reaches local advice                          | Its status code, otherwise 500                                                                    | Depends on throw site |
| Other `Exception` reaches local advice                                  | 500                                                                                               | Depends on throw site |

Session-not-found behaviour in the imported library, effective security errors and client error decoding remain
partial. The table describes implemented source paths, not execution results. The source explicitly rejects
`AUTOMATIC`; it does not explicitly require equality to `MANUAL`. The external-reference check rejects null,
not blank strings. These differences matter when explaining boundary conditions.

**A real map error surfaced:** the current Volvo handler says an invalid stage returns 400. The local
`TransactionStageValidationException` carries 422, and local advice uses that status. For a null stage, even
that summary is insufficient because building the error message can throw a different exception. The trial
records both paths without changing the workspace.

Evidence:
[state predicates](https://github.com/volvo-cars/cds-paymentservice-transaction/blob/020d2fabb141b47b6d1e8173c02405795f71613a/cds-paymentservice-transaction-shared/src/main/java/com/volvocars/ecom/paymentservice/transaction/Transaction.java),
[stage exception](https://github.com/volvo-cars/cds-paymentservice-transaction/blob/020d2fabb141b47b6d1e8173c02405795f71613a/cds-paymentservice-transaction-shared/src/main/java/com/volvocars/ecom/paymentservice/transaction/exception/TransactionStageValidationException.java),
[HTTP advice](https://github.com/volvo-cars/cds-paymentservice-transaction/blob/020d2fabb141b47b6d1e8173c02405795f71613a/cds-paymentservice-transaction-api/src/main/java/com/volvocars/ecom/paymentservice/transaction/api/common/TransactionControllerAdvice.java).

## Data flow

| Source                                    | Destination                              | Meaning                                                                           |
| ----------------------------------------- | ---------------------------------------- | --------------------------------------------------------------------------------- |
| Request path `paymentSessionId`           | Session lookup                           | Candidate shared lookup by session identifier                                     |
| Loaded session `transactionId`            | Transaction lookup                       | Select the active transaction reference                                           |
| Request body `attributes`                 | Capture payload `attributes`             | Copy through inherited getter; exact imported type unresolved                     |
| Transaction `psp`                         | Client second argument and payload `psp` | Provider selection                                                                |
| Transaction `transactionId`               | Client first argument                    | Candidate client uses it in the downstream path                                   |
| Transaction `countryCode`                 | Payload `countryCode`                    | Stored transaction country, not a country supplied by this request                |
| Transaction `externalId`                  | Payload `pspTransactionId`               | Translate internal field name to provider reference field                         |
| Transaction `accountId`                   | Payload `accountId`                      | Internal account reference                                                        |
| Client response `.data`                   | Discarded                                | No field is used to construct this endpoint's response or an explicit local write |
| Constant null and controller operation ID | Success envelope                         | 202 response; full common envelope serialisation unresolved                       |

Candidate client source declares
`POST /v1/transactions/{transactionId}/psp/{psp}/capture`. Committed destination configuration is
`${PSP_INTEGRATION_URL:http://ps-psp-integration-api-service:8080}`. Neither establishes the effective production
destination. The caller's declared client version is `1.3.257`; candidate client source belongs to a repository
at `1.3.274-SNAPSHOT`. The wire route, additional inherited fields/defaults, interceptors and error policy must
be confirmed against the exact imported artefact.

The candidate payload base also declares an initial `paymentSessionType`, while the caller's builder never
sets it. The generated builder and exact imported version are needed before asserting its effective value.
Source initialisers, builder behaviour and serialisation are separate parts of the data-flow question.

## Data at rest

The committed database setting names `payment_services`, with a placeholder Mongo URI and external
`ps-config`. It does not establish a physical production location.

| Resource                                | Shape established by inspected source                                                                                                                                      | Remaining uncertainty                                                                                             |
| --------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `transactions` collection               | Local `TransactionEntity`: identifiers, country, stage, history, pricing, cart lines, customer/instrument references and other declared fields. Lookup by `transactionId`. | Inherited PSP/account/base fields depend on shared library version; nested types and converters not fully closed. |
| Candidate `payment_sessions` collection | Candidate shared `PaymentSessionEntity`: session ID, active transaction ID, capture method, status and other session fields.                                               | Collection, full shape and lookup implementation must be verified against imported shared `2.0.32`.               |

The local transaction entity declares a unique transaction-ID index. Configuration disables automatic index
creation, so the annotation establishes a declaration, not the existence of the index in a running database.
Inherited Mongo fields include candidate `_id`, audit timestamps and optimistic version data. They are not
automatically part of the API response. The structured companion records direct field names and identifies
the inherited/nested shape as partial rather than fabricating complete BSON examples.

## What is still missing

1. **Exact shared artefact:** caller declares `2.0.32`; cached shared source is `2.0.33-SNAPSHOT`. This affects
   session lookup, inherited request/storage fields, expiry configuration and client policy.
2. **Exact client artefact:** caller declares `1.3.257`; candidate source is `1.3.274-SNAPSHOT`. Route and wire
   representation remain candidate evidence until resolved.
3. **Security closure:** shared filters, effective role enforcement and complete rejection paths.
4. **Expiry mapping:** exact configuration implementation and effective duration/unit; the mapping can affect
   the request even though capture does not use its calculated expiry.
5. **Client policy:** exact timeout, retry, interceptors, serialisation and error decoding.
6. **Effective configuration:** Mongo location, destination overrides and deployed artefact versions.
7. **Response types:** local error construction is known, but imported success/error envelope serialisation
   and inherited controller behaviour are not closed.
8. **Completion:** downstream provider effect and correlated event/webhook continuation through a durable
   write. A 202 response alone does not establish this path.
9. **Stored type closure:** all nested schemas, inherited fields and relevant Mongo converters.

These are actionable boundaries, not missing prose to fill with guesses. Resolving artefact versions should
precede deeper claims about their implementation. This trial used cached sources and did not fetch artefacts,
connect to a database or call a payment endpoint.

## Acceptance result and model consequences

The ten requirement questions have record-level results in the companion. Local capture guards, explicit
outgoing value construction, ignored response data and controller outcomes can be explained. End-to-end
behaviour, complete wire/storage shape and effective security/client policy remain partial.

The existing handler tree can project the reads, branches, remote call and returns. It cannot faithfully hold:

- stable ids for execution steps and references from bindings to those steps;
- typed input/output bindings and transformations at each boundary;
- exception throw/catch/status paths distinct from normal branch order;
- ignored return values and acceptance versus completion semantics;
- unresolved call/type/version identities and per-endpoint coverage;
- evidence dependencies that invalidate an explanation when helpers, policies or libraries change.

The updated scan instructions require the companion to retain those facts and make the gap visible. They do
not claim that the current workspace schema or UI already supports them. A repository scan must account for
every endpoint at this depth or report the remaining analyses as partial/blocked.

Existing Java tests assert 202 with the expected builder payload, 208 without a client call for completed
transactions, and 401 without auth. Unit tests assert several validation exceptions and payload mapping.
They were **read, not executed**; they mock the downstream client and cannot establish provider completion.

For a repeat trial, validate source commits/paths/ranges, local record references and control/data consistency;
compare the ten acceptance answers with source and test assertions. A source citation check validates
attribution, not the semantic correctness or completeness of an explanation.
