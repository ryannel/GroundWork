# Customer service binding source review

The source checkout independently reports HEAD `09623ab3a1f39845d8fc02abc3d591b53a3b5fea`.
Only `volvo-cars/cds-ecom-customer-service` is in scope. Git reads use
`GIT_NO_LAZY_FETCH=1 GIT_TERMINAL_PROMPT=0`; no application build, application execution or network fetch
was used for this review.

The original 22 questions and their required-evidence column remain fixed in
[the original review](../customer-service-pipeline/answerability-review.md). The accepted Spring baseline
is three supported, eighteen partial and one unsupported question. The additional bindings address
specific missing relations; their presence alone cannot change an answer's status.

Q05's source path is controller `updateIndividual` → API service `updateIndividual` → core service
`updateIndividual`. The controller forwards its `id`, the API service forwards it into `individualId`,
and the core service tests `originalCustomer.individuals().stream().noneMatch(...)`, comparing each
individual ID with that argument. Its consequent throws `IndividualNotFoundException(individualId)`.
`CustomerServiceExceptionHandler.handleNotFoundException` explicitly handles that exception under
unscoped `@ControllerAdvice`, declares `@ResponseStatus(HttpStatus.NOT_FOUND)`, and returns
`createNonDetailResponse(HttpStatus.NOT_FOUND, e.getMessage())`. The inherited source helper builds a
non-detail error then invokes `createResponse`; that helper uses `ResponseEntity.status(...).body(...)`.
Helper callsites retain their owning method and source declaration support. Unavailable external
`HttpStatus` members and inherited `getMessage()` types leave generic helper invocation resolution
explicitly unresolved. External error wrapper definitions and effective serialisation are unavailable. The frozen question's
HTTP status can be established without inventing those definitions.

These facts were independently read at core `customer/CustomerService.java` 114–136, API
`api/customer/v1/impl/CustomerControllerImpl.java` 73–78 and `CustomerApiService.java` 75–80,
API `api/common/CustomerServiceExceptionHandler.java` 27–42 and `AbstractControllerAdvice.java` 25–35.
Native acceptance additionally requires typed guard/callback/throw/value relations, exact invocation
bindings, argument-to-parameter lineage, no intervening try scope and no source-local controller handler
candidate. Advice registration and deployed responses are outside this source claim.

Q14 independently names these source collection and repository pairs:

| Entity           | Collection         | Repository                |
| ---------------- | ------------------ | ------------------------- |
| Customer         | customers          | CustomerRepository        |
| CustomerArchive  | archived_customers | CustomerArchiveRepository |
| CustomerAuditLog | auditLogs          | AuditLogRepository        |

The collection annotations occur at core `customer/Customer.java` 22,
`customerarchive/CustomerArchive.java` 11 and `auditlog/CustomerAuditLog.java` 20.
Each repository declares its entity and `ObjectId` identifier through `MongoRepository`.
The archive repository adds `CustomerArchiveUpsertRepository`, implemented by
`CustomerArchiveUpsertRepositoryImpl`.

The independently frozen inventory has twenty source data-operation callsites:

| Source file, relative to core                            | Reads                                                                              | Writes                                  |
| -------------------------------------------------------- | ---------------------------------------------------------------------------------- | --------------------------------------- |
| customer/CustomerService.java                            | findByCustomerId; findByCustomerIdIn; findAllByArchivalDataArchivedTimestampBefore | deleteByCustomerId; save twice; saveAll |
| migrate/MigrationService.java                            | findByCustomerId                                                                   | insert; save; deleteByCustomerId        |
| customerarchive/CustomerArchiveService.java              | findByCustomerId                                                                   | upsertCustomerArchive; delete           |
| customerarchive/CustomerArchiveUpsertRepositoryImpl.java | —                                                                                  | MongoTemplate.upsert                    |
| auditlog/AuditLogService.java                            | findByCustomerIdAndVersion; findAllByCustomerIdOrderByVersionDesc                  | save                                    |
| migration/Change1RepublishCustomerAnalyticsEvents.java   | MongoTemplate.stream for customers and archived_customers                          | —                                       |

The template upsert selects `customerId`, sets `created` only on insertion, and sets `modified`,
`customerId` and `customer`. Index creation (`MongoConfiguration.indexOps`) and lock-provider database
access (`CustomerArchiveConfig.getDb`) are metadata/lock operations, outside this data-operation
inventory. The answer identifies source collections and code attempting reads/writes; it does not
assert deployed database names, durable success, transactions, effective query ordering or external
MongoDB configuration.
