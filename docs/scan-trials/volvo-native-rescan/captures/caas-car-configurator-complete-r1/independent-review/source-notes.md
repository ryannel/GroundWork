# CaaS independent source preparation

Root independently read the nine complete pinned files in source-review.json. This is preparation, not
acceptance of the explorer's unsealed working capture.

The service declares nine unary gRPC methods. HealthCheck constructs HEALTHY without querying a database
or solver. NewServer chains operation ID, panic, error conversion, metrics, failure logging, auth and request
logging interceptors in that source order; the imported chain invocation semantics must remain distinct
from available middleware bodies. Reflection is registered separately. Source DI interfaces should bind
actual implementations using construction evidence rather than type-name proximity.

Operation ID fails with InvalidArgument when incoming metadata is absent, but generates a UUID when the
header is absent or its first value empty. Auth reads the first authorization value, tests a case-insensitive
bearer prefix, trims its remainder, parses token, obtains clientID and enriches context before handler.
Error conversion maps domain InvalidOperation and Puan invalid argument/operation to InvalidArgument;
Unauthorized to Unauthenticated; domain/Puan NotFound to NotFound; context.Canceled to Canceled; solver and
other non-null failures to Internal with distinct logging/messages. Go returned errors are values, not
implicit Java-style thrown exceptions. A null error returns the handler response.

Create converts/validates specification, cleans redundant forbids, creates ruleset and calls repository
before returning its ID. The repository Begins, registers deferred rollback, inserts ruleset plus clientID,
inserts original specification for audit, then returns Commit's error. Early insert failures return through
rollback. Rollback failure logs unless exactly ErrTxClosed; it does not replace the returned error. Exec
success is separate from commit acknowledgement or durable state. Actual stored conversions and SQL field
schemas still need independent reading.

Delete parses ID, calls repository, logs and returns Empty only after no returned error. SQL deletes from
car_rulesets only, then RowsAffected()==0 becomes NotFound; the later independent migration read establishes specification deletion by ON DELETE CASCADE when that
migration has been applied. Source DDL is separate from observed live schema. Reads QueryRow then Scan, map ErrNoRows separately and convert stored values. Scan mutates
out-pointers; its returned error must not be substituted for the loaded row.

All calculator methods retain early conversion/errors, enriched ruleset context and exact returned shapes.
CalculateNextCarKeys reserves tag3 implicitly by leaving a gap, but does not declare reserved3: do not invent
a formal reservation. Nullable/optional from/to weeks and selection groups remain separate source contracts.

The complete stored-to-entity conversion, stored models, migrator and all three up migrations were read.
car_rulesets uses UUID primary key, JSONB ruleset, created_at TIMESTAMP default NOW(), later ruleset LZ4
compression and non-null UUID client_id default zero UUID. car_specifications has ruleset_id as primary and
foreign key with ON DELETE CASCADE plus non-null specification JSONB. These are intended migration definitions,
not runtime schema observation. Migrator embeds migrations/*.sql and applies Up, treating ErrNoChange as success;
deferred migration.Close return values are discarded.

StoredCarRuleset.Components serialises as components2, not components. JSON local_edition_code, standard_wheel
and default_code use omitempty where declared. StoredPolyhedron is a_matrix [][]int and b_vector []int; time-bound
variables carry Period From/To time.Time. Stored packages carry optional permanent exactly-one requirements and
nested variants. Those source tags must not be replaced with gRPC/protobuf field names. The stored-to-domain
converter preserves explicit nil pointer branches, collection iteration and constructor errors; imported Puan
hydration/construction policy remains unresolved even though actual arguments and returned tuple positions are known.
