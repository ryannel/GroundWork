# Customer archival

Q19 and Q20 join order-event decisions and scheduled archival to typed source evidence.
The combined bounded review is accepted. The original 22-question review now has
**13 supported, 8 partial and 1 unsupported** answers.
Only `volvo-cars/cds-ecom-customer-service` at
`09623ab3a1f39845d8fc02abc3d591b53a3b5fea` is in scope. Other repository scans remain stopped.

- [Independent source review](source-review.md) fixes both questions before acceptance.
- [Order source review](order-source-review.md) details Q19's filters and effects.
- [Question review](answerability-review.md) preserves the original 22 questions.
- [Machine-readable review](answerability.json) records the results and evidence.
- [Pipeline guide](../../scan-pipeline.md) describes the reusable contracts.

## Order changes

A non-null CustomerUpdate event with a nonblank customer ID takes precedence over ordinary order handling.
It does not require BASIC, ORDERCHANGEEVENT or a terminal status. If the active customer is already clear of
archival data, handling returns without saving. Otherwise it clears archivalData and validates/saves the
updated customer. A missing active customer selects archive restoration with `markForArchival=false`.

Other categories can qualify through the ordinary order filters: non-null payload, COMPLETED, CANCELLED
or ABANDONED status, ORDERCHANGEEVENT, BASIC and a nonblank customer ID. These statuses select
ORDER_COMPLETED, ORDER_CANCELLED and ABANDONED respectively. An already marked customer is unchanged;
otherwise marking creates the reason and a timestamp ninety days ahead, then saves and postprocesses.

The proof follows decoded values, predicates, switch arms, reason application, typed catches and the
rebuilt customer into save. Restoration clears version and, for false, archivalData; it saves the active
customer before deleting the archive. This order exposes a failure window and does not establish atomicity
or durable completion. Source catches do not establish Kafka acknowledgement or redelivery.

## Scheduled archival

Base configuration declares enabled=true, cron `0 */30 * * * *`, minimum lock `PT15M` and maximum `PT29M`.
The application declares scheduling and a default maximum lock of `PT25S`. These are source declarations;
effective profiles, property precedence, timezone and deployment remain unobserved.

The scheduler calls the declared asynchronous job without waiting. The named executor declares core and
maximum pool size one, and a Mongo lock-provider bean is a source candidate. A lock around the scheduled
invocation does not prove protection through asynchronous completion. A single worker per executor does
not prove global full-job exclusivity. Effective Spring interception and bean selection remain unknown.

The job creates statistics and obtains archival candidates. Its collection callback passes each customer
and the shared statistics into the private helper. Each helper attempts archive upsert, active deletion,
success count and success log, in order. Its Exception catch increments failure count and warns, normally
allowing iteration to continue. Candidate lookup or iteration failure can reach the outer job catch.
Failures in statistics or logging can also escape. A failure after the success increment can increment
the failure counter too; these counters are not exclusive durable outcomes.

## Reusable contracts

Nineteen closed binding kinds now include `java_collection_binding` and `schedule_binding`. Collection
records preserve ordered string literals and local constant references for supported static final JDK
List.of declarations. Nominal factory resolution rejects lexical and package-prefix shadows.
Schedule records preserve exact annotation identity, source attributes, activation, conditions, provider
candidates and joins to shared async calls. Async records explicitly retain lexical conditions.

Shared Java bindings infer the declared element upper bound for supported Collection.forEach and direct
stream.forEach callbacks, preserving customer/statistics actual-formal links. They do not infer iterator
execution, scheduling or completion. Unnamed catches retain their exception type without inventing an
underscore variable. Unsupported collections and type bounds remain unresolved.

Consumer metadata remains bounded to listener helpers and immediate recognised decoders. Downstream
operations are retrieved from the shared graph instead of duplicating a complete flow per consumer.
Each page retains the existing four-record and 65,536-byte limits, with at most 32 requested IDs.

## Evidence

Paths below are relative to the workspace root. Publications are immutable; use a new output directory
for reproductions. Development captures are separate from accepted evidence.

| Artefact                | Path                                                                                            |
| ----------------------- | ----------------------------------------------------------------------------------------------- |
| Source capture          | `reports/customer-service-archival-002/repository.json`                                         |
| Canonical bindings      | `reports/customer-service-archival-001/accepted/{document,receipt}.json`                        |
| Combined bounded review | `reports/customer-service-archival-001/accepted-review-final/{receipt,pages,source-pins}.json`  |
| Earlier native replays  | `reports/customer-service-archival-001/independent-native-migrated/accepted-native-replay.json` |
| Record bounds           | `reports/customer-service-archival-001/record-sizes.json`                                       |

The native parser change also exposed sequence-based edge-ID drift in the earlier Q09 subset. The
original strict replay failure is retained in `independent-native/`, with its drift diagnostics. Six
other probes preserve every ID and payload. For Q09, 176 non-edge records remain exact and 200 edge IDs
are renumbered. An explicit opt-in migration proves a unique bijection with every other edge field
identical, then retrieves the current IDs through bounded pages and reruns the unchanged assertions.
All seven local probes and eight archival-default mutations pass. The default replay mode remains
strict; this is not permission to migrate a changed relation, source, owner, endpoint or position.
The independent negative audit is `independent-migration-audit.json`.

The accepted review returns all **45,616 records** in **11,409 pages** (21,241,684 bytes). Its independent
source audit verifies 10,987 anchors across 260 pinned files. All **225 destructive mutations** reject:
the prior 182, twenty-one for Q19 and twenty-two for Q20. Each must apply to a complete passing baseline.
Q19 passes all 29 clauses and Q20 all twelve. Bounded ID-sorted retrieval preserves both answers.

The source run inventories 386 tracked files and reuses all 340 Java indexes across nine shards in both
first and warm phases: zero Git blob reads and zero native parses. It takes 24.79 seconds; binding
extraction takes 37.59 seconds. The resource stage reuses all seven retained files. These are warm-cache
measurements under concurrent work, not a cold baseline or a measured speedup against agent scanning.
All 9,055 binding records pass the public contract and individual page limits. The largest record is
50,719 bytes (50,874 with its page envelope); schedule and collection records remain compact.

Changed-file lint, formatting, the full unit suite, repository checks and production build pass.

```sh
node --import ./tools/register.ts --conditions=react-server tools/scan-archival-review.ts \
  reports/customer-service-archival-001/accepted/document.json /path/to/clones /path/to/NEW-output
```

Reproduce the explicit, field-exact edge-ID migration and earlier native checks:

```sh
node --import ./tools/register.ts --conditions=react-server tools/scan-native-answerability-replay.ts \
  reports/customer-service-archival-002/repository.json \
  reports/customer-service-messaging-001/independent-native-current \
  reports/customer-service-pipeline-001/answerability /path/to/NEW-native-output \
  --semantic-edge-id-migration
```

Local source and analysis freshness is recorded in `reports/customer-service-archival-001/freshness.json`.
It reports unchanged local source and analysis with no rescan required; remote and deployment currency
remain unobserved.

The combined regression review keeps its explicit cap of 49,152 records and 32 MiB. It is larger than an
individual question query. Source verification, bounded retrieval and semantic acceptance are distinct.
The source/parser change refreshed indexes during development; accepted cache-reuse timings do not
measure that refresh or establish a cold-scan speedup. Scripted extraction makes zero model calls;
agent development and review consumption is separate. This work does not migrate the production reader.
