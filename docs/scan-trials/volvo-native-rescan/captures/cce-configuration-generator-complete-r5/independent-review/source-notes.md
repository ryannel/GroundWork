# Configuration generator independent source preparation

Root independently read queuedb/client.go, service/joborchestrator.go and service/jobcompletionnotifier.go
at c91f73a5a3b6cdb56168f7138352a0f409fa8300. Explorer draft is unsealed; native acceptance is pending.

JobOrchestrator defaults batch size64, overrides only for >0; iterates specifications and batches, returning
on the first error. Each Enqueue gets full typed job plus metadata Pno12/ModelYear/SpecMarket/StructureWeekInt.
Each batch insertion has its own Begin/deferred rollback/Marshal/InsertTx/Commit sequence. This is not one
atomic enqueue of all batches/specifications; a later batch can fail after earlier commits. Nil-error from
InsertTx and actual Commit return are different. Job args and metadata are separate source constructions.

Stop validates1..10000, lists Available/Running jobs for default queue/kind with First(limit), skips actual
ErrJobRunning delete errors, otherwise propagates and commits. A request to stopN jobs does not proveN
were deleted. Listing selection is not a write payload. Rollback logs unless exactly ErrTxClosed and does
not replace returned error. Imported River storage/retry/transaction policy remains explicit.

Subscribe registers Completed/Cancelled/Failed and selects context cancellation or subscription channel.
A nil event logs closed channel and returns nil; handler errors log and continue. Failed+Retryable returns
without notification. Failed+Discarded sends failure from last stored job error (or empty string), then checks
queue completion. Finished check lists same metadata string/default queue/kind with First1 across
Available/Running/Retryable/Pending; no jobs triggers completion. Metadata matches are not job ID matches.
No idempotency/once-only group notification claim is established in these functions.

NotifyJobCompletion builds a no-pagination query from spec market/model year/Pno12/week, reads actual stored
key count, then publishes that count. A count failure prevents finished publication. NotifyFailure delegates
error string without a count. Completion/failure events remain separate, and worker return is separate from
publisher/broker delivery. Queue readiness is queried before count, without a shared cross-store transaction.
The process config declares default queue workers, JobTimeout30min, MaxAttempts, retry policy and error handler;
imported actual scheduling/retention activation is separate from those declarations.

The full carconfigurations controller was also read. POST generation decodes body, rejects empty specs,
fetches wheel codes, maps specs and validates every selected colour/upholstery/option before launching work.
Validation fetches each car specification and includes selected wheels in the options validation list.
Failures before launch return a source error response. Actual go invocation precedes the attempted202
response; immediate callee error is not a response result. Child detaches caller cancellation, adds a60-minute
timeout, defers cancel and logs its own orchestration error. Interleaving with response remains unresolved;
202 does not establish queue insertion or completed generation.

GetConfigurations parses query, applies pagination, performs total and page reads separately, maps and writes
paginated response. No common snapshot/transaction consistency is established. parseNumberOfJobs empty returns
0,nil, then Stop rejects0; Atoi failure gets400 directly. Old Delete decodes/rejects empty list/maps attributes
then iterates deletes; new Delete builds a query from ModelYear/Week/Pno12s and delegates one delete operation.
Source204 attempts pass a message to respond.Do; effective net/http wire body/status policy requires the
response implementation and imported/runtime correspondence, not an assumption from Swagger comments.

Root read full publisher, request builder, HTTP wrapper/OAuth transport, Assortment, Filter and PUAN callers.
An early checkpoint invented a remote service for the local HTTP transport chain; this is a publication
finding to fix with a null destination at its generic Do or exact contextual targets. HTTPClient.Do proxies
local *http.Client.Do. NewHTTPClient sets80-second timeout despite its10-second comment. WithClient copies
only Timeout/CheckRedirect/Jar/Transport; round-trippers compose by reverse iteration so source FIFO wrapping
is retained, imported transport token/caching/concurrency policy stays a gap.

RequestBuilder has value receivers. Scalar field setters require their returned builder; header/query maps
share backing references. Filter's ignored WithHeader return can still mutate header map. Build calls
req.WithContext before testing NewRequest error; preserve that source ordering/possible invalid-request path.
Headers become req.Header and query values are q.Add then Encode, not a JSON body.

Assortment CarConfig GET appends /v1/cars/CarConfig/query with SpecMarket and Take10000000 plus JSON UTF-8
Content-Type/Accept and API key. MarketAuth GET appends /v1/cars/MarketAuth with SpecMarket/ModelYear/CarType
and API key; it reads bytes rather than using the generic JSON response decoder. Both test2xx, close body.
Filter GET /wheelComponents optionally sends context operation ID, requires exact200, decodes []string and
maps each code to true. Source API/config component targets differ from the local shared transport.

PUAN POST /v1/tools/search sends JSON-marshalled ToolsSearchPayload, Content-Type/Accept application/json,
onlyPrimitives=True. Its caller constructs model variables, objectives+/-1, And proposition and bounds1..1,
with week/available-variable filtering and feature-flag branches. Returned solution entries skip zero or
unknown variables; component type maps colour/upholstery/SMessage/options, unknown type errors, then require
nonempty colour/upholstery. Independent-option application indexes combinations by result position; do not
claim a validated matching length or sorted map iteration.

PUAN only500 gets ErrToolsSearchFailed500; timeout uses a particular error-string substring; other non2xx
errors are distinct. Error-body detail decoding can fail and replace the status sentinel before retry policy
sees it. Success with nil decode target skips decoding; actual JSON decoder target is &response. Source
provenance of intended DTO conversion is separate from imported reflection mutation semantics.

Finished event uses typed protobuf fields, safe signed32 conversion for model year/week, int64 count, UUID
Watermill message ID and x-type metadata. Failure event carries errorMessage. Publish returns error before
logging success. Broker durable delivery and consuming registration are not established by this call.

TokenSource.Token explicitly POSTs configured tokenURL with form encoding grant_type client_credentials,
client_id/client_secret/resource. It has no WithContext call and no HTTP status check. It decodes token,
parses expires_in as string with Atoi and sets Expiry only for positive seconds. Imported embedded oauth2.Token
fields remain a partial schema; locally observed Expiry is not a complete token payload declaration.
