# Customer service Spring source review

The scope is only `volvo-cars/cds-ecom-customer-service` at
`09623ab3a1f39845d8fc02abc3d591b53a3b5fea`. The accepted native baseline is trial 005.
The 22 questions and required evidence remain those fixed in
[the original review](../customer-service-pipeline/answerability-review.md#questions-fixed-before-capture-review).
Git reads disable implicit fetching and prompting. No application build or other repository scan is
part of this review.

## Framework assumptions

The root POM pins the external `com.volvocars.ecom` parent and web dependency to `4.0.48`.
The API POM also declares `cds-volvocars-shared-web`. Exact Spring Boot, Spring Framework and Spring
Security versions are inherited from dependencies outside the pinned tree; this review cannot establish
their resolved versions. A dependency version must not be presented as the Spring version.

`api/App.java` excludes `SecurityAutoConfiguration` and imports the external
`EcomWebAppConfiguration`. No tracked Java or XML definition of `EnableMethodSecurity`,
`EnableGlobalMethodSecurity` or `SecurityFilterChain` was found at this pin. Consequently, local
`PreAuthorize` expressions describe declared policies; they do not prove method-security activation,
authority conversion or the configured HTTP filter chain. The external import is an explicit source
boundary, not evidence that security is disabled. Spring's
[method-security reference](https://docs.spring.io/spring-security/reference/servlet/authorization/method-security.html)
separates method-security activation from security dependencies. This rules out promoting Q02 solely
from role annotations or assuming Boot's default web security, which the application excludes.

`TrustedIssuerWebConfig.addInterceptors` registers the component interceptor for `/v1/customers/**`.
There is no explicit `excludePathPatterns` call in that configuration. Audit routes inherit the
`/v1/customers` prefix from their interface and are covered; `/v1/migrate` routes are outside the
registration. `TrustedIssuerHandlerInterceptor.preHandle` reads
`X-User-Access-Token`, invokes `TrustedIssuerValidator.validate` only when `StringUtils.hasText(token)`,
then returns true. This guard does not require the header to be present. It also does not prove the
external authentication filter accepts a request. Framework bindings must retain these distinctions.

## Request validation and views

`shared/common/Views.java` declares Create, Update and Patch as subinterfaces of Jakarta Validation's
Default group; UpdateCustomer extends Update and PatchCustomer extends Patch. A group resolver must
retain transitive inheritance, including Default. Merely comparing annotation spellings would miss
effective constraints.

`CustomerRequest.dataVersion` has `NotNull(UpdateCustomer)` and default-group `Min(0)`.
`customerType` and `market` have `NotNull(Create, Update)`. `IndividualRequest.roles` has
`NotEmpty(Create, Update)`. Thus patch has no such group-specific presence constraint, but default
constraints still apply. UpdateCustomer inherits the Update presence constraints; PatchCustomer does
not inherit them. `Valid` also occurs inside generic collection element types. Capturing only field
annotations would lose nested validation.

JsonView selection and validation-group selection are separate. A missing view annotation must not
be interpreted as universal inclusion without the mapper configuration. Imported external field types
such as `Market` and `Language` must remain explicit unresolved type boundaries when their definitions
are absent. A local schema reference establishes a declared type, not a complete serialised contract.

## Acceptance checks

The new capture must retain compiler-derived facts, source ownership and bounded reader pages. A
handwritten source audit cannot promote a pipeline answer. Required adversarial cases remove the
implementation-prefix/interface link, method policy, activation evidence, validation-group inheritance,
request-body binding, JsonView selection, schema-field constraint and interceptor registration while
leaving display text unchanged. A checker must reject the corresponding claim after each removal.

The frozen criteria are decisive. Q07 asks about the equality return and subsequent order in
`saveAndPostProcess`; Q08 asks about its boolean branch, called operation and default reason. Neither
question requires proof of a successful deployed write. Conversely Q15 explicitly includes failure and
completion guarantees, Q21 needs actor/action/outcome evidence, and Q22 includes remote and production
freshness. Their missing clauses must remain visible.

## Native replay

The existing generic native probe was rerun against the accepted trial 005 documents. Q07 retrieves
all 221 selected records in 56 bounded pages and passes the equality exit and subsequent call order.
Q08 retrieves all 231 records in 58 bounded pages and passes the mark-versus-immediate-archive
branch checks. Its default reason additionally passes the independent
`tools/scan-spring-review-native.ts` checker, using only records returned in those bounded pages:
the actual call argument reaches its binding, the binding reaches a conditional, and typed operand
relations select `archiveReason` when non-null or `ArchiveReason.NONE_SPECIFIED` otherwise.

Removing each of `reaching_value`, `assigned_value`, `condition`, `left`, `right`, `consequent`,
`otherwise` and `receiver` rejects this default proof while retaining display syntax. Two focused tests
also reject a changed default enum value. Owned-file ESLint passes. The retained replay receipts are
under [native-review](../../../reports/customer-service-spring-001/native-review/). These results
support the complete frozen Q07 and Q08 questions; they make no claim of deployed write completion.

After the new Spring capture was published, retained 005 records were compared with its matching
shards. Source and function identities remain pinned, but annotation metadata changes some edge IDs.
Both probes were therefore replayed against the new capture itself, with the same complete record and
page counts. The default-reason checker and all eight relation-removal mutations pass again using
only the new Q08 reader pages. Current receipts live under `native-review/current/`.

The final framework aggregate uses source capture `customer-service-spring-002`. Its bounded review
returns all 1,636 records in 409 pages. The accepted 19 routes link their local schema profiles; the token
interceptor binds 17 customer/audit routes and excludes migration by non-match. All 19 method policies
retain unresolved activation. The false nested-group aliases were removed. Every current Q07/Q08
reader record was compared with trial 002's matching shard by exact ID and full JSON content: all
221 and 231 records match. `native-review/final-equivalence.json` retains that independent comparison.
