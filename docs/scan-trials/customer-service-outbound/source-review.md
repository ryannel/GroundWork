# Customer profile and corporate entity source review

The acceptance questions remain Q12 and Q13 of the original 22-question
[review](../customer-service-pipeline/answerability-review.md). This inventory was fixed from pinned
source before reviewing the new extraction. A passing helper check does not answer either whole question.
Only `volvo-cars/cds-ecom-customer-service` at
`09623ab3a1f39845d8fc02abc3d591b53a3b5fea` is in scope. Other scans remain stopped.
All paths below start at `customer-service-core/src/main/` unless stated otherwise.

## Q12: individual profiles

Required source clauses:

- Volvo ID has two source clients. `java/com/volvocars/ecom/customerservice/volvoid/VolvoIdClient.java`
  24–44 pairs `volvo-id-keycloak` with `/protocol/openid-connect/userinfo` when the trusted issuer
  helper selects Keycloak; the other branch pairs `volvo-id` with `/idp/userinfo.openid`. The overload
  at 47–66 sends GET, `Authorization: Bearer ` plus the supplied token, accepts JSON, reads
  `VolvoIdUser`, rejects a null body and translates bad requests and other REST failures separately.
  The caller at `volvoid/VolvoIdService.java` 20–54 skips blank tokens, sanitises names and addresses,
  and converts caught exceptions to an empty optional.
- `connecttoken/ConnectTokenService.java` 22–41 decodes the supplied token with the configured Connect
  issuer, converts claims to `ConnectToken` and rejects a profile with no email, name or accesses.
  `ConnectTokenIndividualFactory.java` 21–59 derives names and contact/invoice email from that token.
  This is a claims path; it is not an invented Connect profile REST request.
- `entraid/EntraIdTokenService.java` 34–69 decodes with the two configured Entra issuers, requires `oid`
  and delegated `scp` and rejects `idtyp=app`. Its profile uses `oid`, given/family names and the first
  nonblank `upn`/`preferred_username`. `individual/IndividualFactory.java` 295–311 maps the resulting
  user into an individual. OIDC discovery/verification is an external library boundary:
  `security/OidcTokenDecoder.java` 33–66 supplies `JwtDecoders::fromIssuerLocation` and caches decoders
  per issuer. It does not implement discovery HTTP or JWT validation itself.
- `consumer/CdbClient.java` 15–59 constructs GraphQL client `cdb`, selects document `getConsumer`,
  passes variable `cdbId`, executes synchronously, reads field `consumerCdb` and converts it to
  `CdbConsumer`. `resources/graphql-documents/getConsumer.graphql` 1–27 binds that variable to
  `consumerId` and selects consumer ID, language, market, person, emails, telephones and addresses.
  Invalid responses, a null field value and REST exceptions return null; partial field errors are logged
  and still converted. `ConsumerService.java` 25–29 skips blank IDs and wraps a nullable result;
  61–73 skips missing/unchanged IDs and throws `ConsumerNotFoundException` for an empty context result.
- `customer/FactoryContext.java` distinguishes verified Volvo ID, Connect and Entra identity kinds;
  only the Volvo ID branch constructs the user-loader callback. Volvo and CDB future joins return an
  empty optional on caught exceptions. Blank CDB IDs return empty before lookup; `computeIfAbsent`
  uses the CDB ID as its cache key and constructs the loader callback from that key.
  `individual/IndividualFactory.java` supplies the actual merge. Its ordered, typed constructor
  arguments and local mapper origins are required: create/update use request, then Volvo ID for
  signatories, then CDB for emails, phones, addresses, language, first/last name, gender and birth date.
  Patch inserts current values before the Volvo/CDB fallbacks; patch language uses request, current
  and CDB with no Volvo fallback. Middle name, title and initials use CDB without Volvo; Volvo ID
  itself prefers the Volvo profile before the requested ID (then current on patch). Gender ends with
  `Gender.U`; organisation-address preference defaults to false on create/update and current on patch.
  Roles, CDB identifiers, external-user IDs, Entra ID, spin person number, contact preferences, consent
  date and consent information retain their own constructor positions and factory/mapper calls;
  update preserves current consent information when its mapped replacement is null. The source bodies
  of `EntityFactory.nullable` and both `nullableOrEmpty` overloads establish their ordered first-present
  rules. Unresolved inherited helper targets and generated accessors remain named source boundaries;
  their method names alone do not supply missing implementations. JDK calls and callback invocation
  construction establish source construction; external library scheduling, codecs and effective
  serialisation remain outside that source implementation.

Request/response declarations and their nested fields must remain navigable. An endpoint string without
its argument lineage, a class name without its response shape, or retained GraphQL text without a typed
document/variable/selection binding does not satisfy the corresponding boundary clause.

## Q13: Fleet and Partner corporate entities

Required source clauses:

- `company/ICorporateEntityFactory.java` 20–34 dispatches the three request variants to normal, Fleet
  and Partner factories. Update/patch at 42–59 support only ordinary corporate requests.
- `fleet/FleetClient.java` 27–68 sends account ID in both GET URIs: `/v1/fleetaccounts/{fleetAccountId}`
  and `/v1/fleetaccounts/{fleetAccountId}/organizational-units`, accepts JSON, reads the corresponding
  response envelope and returns `.data()` after a null-envelope guard. Account lookup translates
  NotFound, BadRequest and REST errors separately; organisational-unit lookup translates REST errors.
- `fleet/FleetService.java` 16–31 rejects CANCELED, REJECTED and DISABLED; a non-FLEET account also
  requires APPROVED. `FleetCorporateEntityFactory.java` 28–85 obtains account and units via two
  futures, joins both, validates an explicitly supplied unit ID or chooses the first MAIN unit,
  then passes account, chosen unit ID, generated ID and requested roles to its mapper.
- `FleetCorporateEntityMapper.java` 22–119 constructs the corporate entity from account/company fields,
  including CDB/Fleet IDs, names, registration/tax identifiers, contacts and addresses. Missing invoice
  address shares mailing/billing; otherwise the addresses differ. The source mapping is part of the
  answer; no MapStruct implementation is required because this mapper has ordinary Java method bodies.
- `partner/PartnerCorporateEntityFactory.java` 26–63 checks Partner ID membership in Connect token
  partner IDs unless an Entra user is present. It invokes the Partner lookup, skips null results,
  generates an ID and passes partner, ID, roles and market default language to its mapper.
- `partner/client/CommercialPartnerClient.java` 17–56 uses client `commercial-partner`, document
  `getPartnerById`, variable `id`, result field `partnerOrganizationalUnit` and declared result
  `PartnerOrganizationalUnit`. The document at `resources/graphql-documents/getPartnerById.graphql`
  1–23 binds `id` to `partnerId` and selects names, facilities, contacts and addresses. REST errors
  become `CommercialPartnerException`; field-access errors and null entities return null. The method
  name alone does not prove a server-side active filter: the query contains no such filter.
- `partner/PartnerCorporateEntityMapper.java` 28–142 chooses the first active MAIN facility or first
  active facility, chooses preferred-language names/addresses or the first available, and builds
  corporate fields including Partner ID, names, contacts and addresses. Its null/empty fallbacks and
  country-code conversion remain visible. This also has ordinary Java bodies, not generated mapping.
- `company/ICorporateEntityListFactory.java` 17–25 maps requests and filters null results;
  `customer/CustomerFactory.java` 26–44 puts the resulting list in the returned Customer. Answering
  only a client or factory method leaves the combination-with-customer clause unanswered.

These are source questions. Unobserved deployed hosts, runtime registry configuration and production
freshness do not become extra acceptance requirements. Equally, declarations do not establish effective
wire behaviour or successful remote completion. Each unresolved source relation must be reported by name.
