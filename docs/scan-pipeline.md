# Question-led scans

The new pipeline captures reusable source facts for explicit questions. It is separate from the production
workspace reader and the earlier `knowledge/v3` execution proofs. The user explicitly resumed the complete
Volvo catalogue on 25 October 2026; the active pinned run is selected by
`reports/volvo-rescan-2026-10-25/control/selected-epoch.json`. Historical stopped-queue receipts remain
unchanged. The completed capture and discovery enrichment are canonical evidence and now live in the workspace
repo, under `volvo-groundwork/evidence/` (see its README); `evidence/evidence.yaml` selects them. Their old
`reports/` paths are symlinks, because the hash-bound records name absolute paths. Passing a benchmark does not itself authorise another run. A valid partial capture is distinct
from semantic acceptance or complete repository coverage.

For checkpointed whole-repository passes, automatic entry discovery, evidence on demand and required LLM
interpretation, use the [repository readiness workflow](scan-trials/scan-readiness/README.md). It keeps the
source phase's scripted work separate from explicitly inferred purpose, actor and journey claims.
A complete source capture and a valid five-area interpretation attempt do not establish complete discovery.
The [discovery coverage contract](../.agents/skills/groundwork-schema/interpretation.md#discovery-coverage)
requires a separate `scan-discovery/v1` assessment of an independently frozen runtime/app and entry/operation
inventory, with evidence-backed dispositions and independent challenge. Missing material behaviour stays
partial. Enrich from retained inputs first and extract only affected missing slices; a discovery gap does
not itself require another full native pass.

When a scan exposes a reusable tooling gap, follow the
[learning loop](../.agents/skills/groundwork-scan/learning.md): retain a reproducer, improve the shared
capability, verify the correction and refresh affected evidence under current fingerprints. In parallel
runs, integrate tool changes at checkpoints. See the [skill review](scan-trials/scan-readiness/skill-review.md)
for the current authoring guidance and independent fixture evaluation.

## Contracts

`schema/scan.schema.json` is authoritative. `npm run generate:scan` regenerates the domain types; the
generation test detects drift. `scanValidator` checks both the closed JSON schema and semantic references.
Typed semantic nodes and edges capture local control, assignment and reaching values, lexical bindings,
callbacks, error paths, SQL parameters and column bindings. Nodes retain parsed literal values and operators;
their display syntax is not evidence of those relationships. Validation checks record kinds, lexical scope,
ownership and pinned evidence containment. Existing rich `knowledge/v3` captures retain their own contracts
and replay rules; the production application has not migrated to this scan format.

| Record                                  | Purpose                                                                                                         |
| --------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Source                                  | Repository, commit, Git blob, path, lines, execution host and declared/observed authority                       |
| Local summary                           | Context-specific operations, branches, arguments, returns, waiting and unresolved frontiers                     |
| Semantic graph                          | Typed operands, guards, statement order, bindings, value origins, callbacks, SQL columns and uncertainty        |
| Framework binding                       | Spring routes, exact implementations, declared schemas, validation/view profiles and security evidence          |
| Call and value binding                  | Source call targets, receiver types, argument/formal joins, returns, references and record field projections    |
| Exception, storage and outbound binding | Source handlers and responses, Mongo collections and operations, logical clients and request/response paths     |
| Contract and effect                     | Structural shapes, source/wire/storage representation, boundary effects and acknowledgement                     |
| Actor, surface, control and action      | Who can act, where the action originates and its prerequisites                                                  |
| Outcome, execution and journey          | Visible results, timing, causal execution and explicitly composed paths                                         |
| Obligation and receipt                  | Each required concern and its supported, unresolved, not-examined, conflicting or justified inapplicable answer |
| Dependency and closure                  | Inputs on which a fact depends, including negative searches and incomplete analysis                             |
| Source baseline and freshness           | Accepted revision, analysis fingerprints, reference observation and rescan decision                             |

Supported answers contain kind-checked record references and evidence. Absence needs a bounded search
receipt, not an empty list. Inapplicability needs an allowed rule, not a convenient omission. Actor conditions
retain declared policy separately from proven enforcement. Source declarations do not prove live state,
effective serialisation, deployment or durable completion.

The source/index cache retains the full selected file once and bounded syntax nodes. Current extractors use
the installed TypeScript compiler and standard Java/Go parser adapters. Native adapters parse the supplied
bytes; they do not build, run or resolve application dependencies. Missing adapters remain explicit gaps.
Repository code is read from pinned Git objects, with implicit fetching and terminal prompting disabled.

### Java compiler runtime

```sh
npm run scan:java:setup
```

This installs a project-local Eclipse Temurin 25 JDK under `node_modules/.cache/groundwork/java25`.
The setup tool validates the official package metadata, archive size and SHA-256 before extraction, checks
the installed Java version and atomically selects its runtime manifest. It supports macOS/Linux on arm64/x64;
other platforms can supply their own compiler with `--java`. No global Java configuration changes.

The parser and its cache fingerprint resolve the same executable: explicit `--java` first, then the managed
runtime, then `java` on PATH if no managed manifest exists. An invalid managed manifest or missing executable
fails explicitly. An explicit older compiler remains usable for older source; unsupported syntax is still
quarantined. Actual compiler version and adapter content participate in parser cache keys, so upgrading them
reparses cached source without rereading unchanged Git blobs.

The Java adapter retains switch selectors, cases, guards and yields, record/deconstruction patterns, positive
pattern bindings and lambda captures. Unnamed patterns/catches introduce no named binding. Compiler operator
kinds preserve operators beside comments. General flow-sensitive scope through compound or negated predicates
and runtime pattern/component correspondence are not inferred from these local relations.

## Run a selected scope

A `scan-scope/v1` manifest names a workspace, repository, full commit, reference, selected files and questions.
Every question has a profile, source symbol and acceptance checks. The CLI accepts at most 100 selected
files and has no workspace-wide switch. Runtime environments in a manifest are scope assumptions; they do
not prove deployed component identity. Initial host records retain those scope identities until runtime
bindings are established.

```sh
npm run scan:run -- scope.json /path/to/clones /path/to/output --cache /path/to/cache
```

Use `--java /path/to/java` or `--go /path/to/go` where the runtime is not on `PATH`. The output contains
immutable generations with `document.json`, `scope.json`, `baseline.json` and `coverage.json`. A validated
generation is selected only after all its files have been written. This selection is a partial capture,
not semantic acceptance, an app migration or a production scan mark.

The expected question denominator comes from the manifest. Every expected question must appear exactly
once, and evidence cannot escape the pinned files. Framework observations remain candidates until their
bindings are established; a name such as `save`, `publish` or `onSelect` cannot establish an effect or intent.

## Test one complete repository

Only use this command when that repository is explicitly authorised. It never resumes a workspace queue.

```sh
npm run scan:repository -- organisation/repository /path/to/clones /path/to/NEW-output --java /path/to/java
```

The driver pins local HEAD once, inventories the complete tracked tree and partitions supported source into
deterministic shards of at most 40 files by default (maximum 100). Tests are classified separately; all hosts
remain unknown analysis placeholders. Every shard has its own validated immutable publication. The aggregate
`repository.json` selects them without creating one large combined graph. Filename classification is not
endpoint discovery, and per-file investigation receipts are not accepted endpoints.

Other regular files are read separately up to a 1 MiB limit. UTF-8 text is retained with pinned blob/path/byte
receipts and marked `retained_unparsed`; binaries and other exclusions have reasons. Retention does not
interpret Maven, YAML, GraphQL, OpenAPI or deployment declarations. Java tests are parsed, never executed.
No application is built or run. A file with parser diagnostics contributes only a pinned source anchor and
an explicit gap: recovered syntax cannot establish semantic declarations, calls, control or values. Cached
source/index data remains available for a later compatible parser.

The cold/first and warm phases record actual blob reads, parses, cache hits, diagnostics, public validation
and local HEAD freshness. Use `--commit <full-sha>` to select older source deliberately; freshness still
compares it with local HEAD. Supply `--cache <existing-cache>` for a new output using retained indexes. Such
an initial phase is labelled `first`, not cold. Rule changes can regenerate facts without parsing or reading
unchanged source. Java/Go child-process CPU is not included in Node's process CPU counter.

See the [customer-service trial](scan-trials/customer-service-pipeline/README.md) for repository-wide
coverage, independent question review and the gaps that the small depth benchmark did not expose.

### Bind Spring declarations

```sh
npm run scan:spring -- /path/to/repository-capture /path/to/clones /path/to/NEW-output --cache /path/to/cache
```

This separately publishes a validated `scan/v1` document with native `route_binding`, `schema_binding`
and `security_binding` records. It reads the capture's explicit shard manifests and accepts only one
repository and revision. Java declarations under `/src/main/` establish bindings; tests do not. Compiler
diagnostics exclude a declaration from binding. Other source layouts need an explicit selection change.
No repository queue is resumed, application built, or dependency code executed.

Routes retain complete declared paths, exact implementation signatures, parameters and defaults, response
types, and schema/security references. Schema profiles preserve DTO inheritance, generics, enum values,
Jackson declarations and validation/view inheritance. Missing external parents, mapper configuration and
generated accessors remain gaps; a `NotNull` constraint does not establish mandatory wire presence.
Method policies retain activation separately. Interceptor bindings retain registration, path scope,
header reads and navigable local callees without claiming token acceptance or deployment.

Framework records and every nested evidence reference are checked for existence, kind and repository/commit
consistency, then served by the same bounded record reader as local execution evidence. Full execution graphs
remain in the source shards; explicitly selected native method slices can accompany the binding document.
Its receipt records source baselines, analysis fingerprints, evidence selection and cache statistics.
Rule changes rebuild bindings from cached compiler indexes; parser changes reparse retained source.
Complete question acceptance still requires independent review against the frozen question clauses.
See the [Spring question review](scan-trials/customer-service-spring/answerability-review.md).

### Bind calls, values and boundaries

The same Spring command publishes nineteen closed record kinds in `bindings`: `java_call_binding`,
`java_value_binding`, `exception_binding`, `mongo_collection_binding`, `mongo_repository_binding`,
`mongo_operation_binding`, `outbound_binding`, `graphql_binding`, `library_binding`,
`java_constant_binding`, `java_collection_binding`, `graphql_document_binding`, `async_binding`,
`execution_binding`, `event_binding`, `configuration_binding`, `consumer_binding`, `enum_binding` and
`schedule_binding`. Framework adapters share the Java call and value model
rather than independently guessing relationships from method names. Calls retain exact or unresolved
resolution, receivers, signatures, arguments and guards. Value relations join actual arguments to formals,
helper returns to calls, declarations to references and record accessors to their declared fields.
Reference identity alone does not establish reaching values across arbitrary mutations.

Resolution uses source types, overloads, nominal inheritance and supported generic substitutions.
Abstract/interface declarations can establish static types without establishing an executable target.
Direct positive `instanceof` conditions expose their bindings within the `if` consequent. A declared
`java.util.List`, `Set` or `Collection` element type can establish the static upper bound of an implicit
`stream().map(...)`, direct `forEach(...)` or direct `stream().forEach(...)` lambda parameter. These rules do not infer general flow-sensitive scope, stream execution
or callback scheduling. Generated getters remain unresolved.
Dynamic injection, external implementations and unsupported generic inference remain unresolved.
Semantic validation checks source pin, kind and ownership, including cross-file helper relations.

Mongo bindings distinguish collections, repositories and source data-operation callsites. Custom fragments
can expose query criteria and update fields without claiming physical database identity or durable writes.
Exception bindings retain thrown operands, guards, applicable source advice and response construction.
Outbound bindings join a logical client to request construction, URI values, declared response type,
local helper lineage and error translations. External registry configuration, authentication headers,
codecs, effective wire serialisation and deployed addresses require separate evidence.

GraphQL client bindings retain typed Spring client calls, source document names, variable values, execution
calls, response field paths and declared result types. Library bindings currently recognise the declared
Spring `JwtDecoder.decode` API as an in-process boundary. They retain local failure paths without inferring
decoder implementation, discovery or JWK requests, network timing, caching or effective configuration.
Collection bindings retain ordered literal or locally referenced string constants from exact, static final
`java.util.List<String>` declarations using the nominal JDK `List.of` API. Qualifiers must not be shadowed
by a lexical variable, including a package-prefix variable. The source factory call and element references
remain explicit; unsupported expressions do not become evaluated values.

Literal constant bindings retain compiler values and declared types for supported `static final` fields;
expressions, mutable fields and values that cannot be represented safely remain unbound.

Unnamed catch declarations retain a direct typed catch relation without creating a lexical binding for
`_`. Catch types and catch bodies remain separate evidence.

Async bindings recognise the fully qualified Spring `Async` annotation, including fully qualified source
syntax, rather than accepting an unrelated annotation with the same short name. They retain declared
executor names, `EnableAsync` declarations and compatible executor bean candidates. These are source
candidates: `declared_runtime_unverified` does not establish effective configuration, bean selection or
proxy interception. Invocation dispatch distinguishes `direct_self` from `receiver_proxy_unverified`.
Neither state claims that a task was scheduled. Async records require an explicit array of class/method
conditional declarations, including an empty array when none are declared in that scope.

Schedule bindings retain exact Spring Scheduled and ShedLock annotations, raw attributes, lexical
conditions, scheduling/lock activation and nominal lock-provider candidates. They join calls owned by the
scheduled executable to existing async invocation records; deferred bodies are separate. Source cron,
lock durations and enablement join to typed configuration declarations without selecting an effective
environment. A method lock plus an ignored async call does not establish protection through asynchronous
completion; a single-worker executor declaration is not a global concurrency guarantee.

Execution bindings publish only explicitly selected method owners and methods with an async declaration;
they do not publish every method in the repository. They reuse the shared Java call and value records for
result rebinding, including assignments from repository returns. Source result use distinguishes `ignored`,
`returned`, `bound`, `joined` and `unknown`. An immediate `joined` use requires an exactly resolved source
method returning the JDK `CompletableFuture` type and an actual zero-argument `join()` invocation. Member
access named `join`, calls with arguments and unrelated result types do not establish waiting. Later joins
through mutable references require separate evidence. Returns, throws, catches and finally blocks belong to
their nearest execution owner, so deferred lambda or nested type bodies do not become enclosing method
paths. Transaction annotations remain declarations; source-only completion and failure states do not prove
commit, rollback or successful asynchronous completion.

Event bindings retain recognised Spring Kafka and external SDK source calls, their typed receivers and
arguments, payload constructors and constructor-argument-to-field bindings. Field declarations may live in
another pinned file. Builder calls and selectors retain their own source ownership and shared call links.
When an unknown actual type prevents an exact Java call join, explicit `candidate_helpers` may retain a
unique same-class private helper with matching arity and candidate-qualified actual/formal sources.
Ambiguous overloads and varargs remain unresolved. A source candidate does not upgrade the shared call
binding to an exact target. Conditions and comparisons retain source declarations and operand anchors;
they do not establish path feasibility, guard dominance or execution order. Independent question checkers
must also query the native control and value relations. External SDK implementation, effective wire
serialisation, acknowledgements and delivery remain unknown without separate evidence.

Configuration bindings retain exact Spring `ConfigurationProperties` declarations, declared property keys,
nominal record accessor selectors and source bean candidates. Exact declared property names or nominal
parameters link factory candidates; their class and method activation annotations remain declarations. Pinned `application*.yml` and
`application*.yaml` resources supply scalar mapping declarations with their original string, number,
boolean or null values. Placeholder and SpEL expressions remain unevaluated. Filename and document
profiles are source candidates; no profile is selected and no effective environment, external override,
Spring precedence or deployed topic is inferred. Sequences and aliases remain outside this scalar subset.

Consumer bindings recognise the fully qualified Spring Kafka `KafkaListener` annotation. They retain
listener selectors, declared activation conditions, payload parameters, factory name candidates,
deserialisation type references and bounded listener and decoder calls, returns, catches and throws.
Downstream operations remain in the shared graph for separate retrieval; consumer records do not copy
the complete application flow. Native control and value
relations remain necessary to establish branch behaviour and payload lineage. A matching source factory
name does not establish runtime bean selection. Listener activation, acknowledgement and retry remain
unobserved; a source handler call does not establish message delivery or successful processing.

Enum bindings preserve declared constants, explicit Jackson `JsonProperty` compiler string literals (including folded literal concatenations) and
`JsonValue` method sources. Names without a supported literal annotation retain a null declared JSON name.
These declarations do not establish an effective wire codec, mapper configuration or the result of a
`JsonValue` method.

The Spring stage separately inventories regular files under `src/main/resources/graphql-documents/*.graphql`
in the pinned Git tree. Each resource has a one MiB limit checked before its bytes are read. Verified retained
ancillary bytes can be reused; otherwise the stage reads the pinned Git blob. Resource statistics distinguish
size checks, blob reads and retained cache hits. This adds resource evidence without widening Java parsing.

The GraphQL source parser accepts one explicit query, mutation or subscription, with an optional operation
name, declared variables, named or list types with nullability, nested field selections and variable-valued
arguments. It retains operation, variable, selection and argument anchors. This is a closed subset: aliases,
fragments, directives, default or literal argument values, shorthand operations and multiple operations produce
an unsupported gap without a recovered binding. Bounds also limit token count and nesting. A document binding
establishes source text; it does not establish remote schema validity, the document loaded at runtime or the
effective request.

Select native slices needed for an independently reviewed question explicitly:

```sh
npm run scan:spring -- /path/to/repository-capture /path/to/clones /path/to/NEW-output \
  --cache /path/to/cache \
  --evidence-method 'updateIndividual,CustomerController#createResponse,FleetClient#getFleetAccount,ClientPaths#ENDPOINT'
```

The selection accepts at most 256 entries: bare method names, `Type#method` or `Type#FIELD`. A qualified
constructor selection uses `Type#Type`. Type names here are source declaration names. Method selections retain
their nested lambda owners; field selections retain their local value evidence. The selection is recorded in
the receipt; it does not claim whole-program execution closure. Source manifests are verified against
their pinned Git objects before repository source is read or parsed. Analysis fingerprints include the
binding rules, schema, semantic validators, resource selection and loading, Git inventory, evidence selection
and Spring command configuration, so those changes invalidate prior analysis independently of source/parser
caches. GraphQL parser changes participate in the analysis fingerprint. Parser adapter/runtime changes
separately invalidate source indexes.

The independent source audit verifies returned anchors against the pinned local Git tree and blob hashes,
requires UTF-8 regular files and checks positive integer line bounds. Multiple anchors in one file share one
blob verification. Worktree contents and a moved local HEAD do not replace the selected revision. This audit
establishes pinned local evidence; remote and deployed freshness remain unobserved.

The [customer-service binding trial](scan-trials/customer-service-bindings/README.md) closes Q05 and Q14
and proves one Fleet client source path. Its independent checker reconstructs evidence exclusively from
bounded record pages and rejects 56 destructive mutations. The full frozen review remains explicit about
the other questions that are partial or unsupported.

### Review asynchronous post-processing and event payloads

The explicit customer-service event review consumes a published binding document. It neither extracts
another repository nor resumes a scan queue:

```sh
node --import ./tools/register.ts --conditions=react-server tools/scan-events-review.ts \
  /path/to/document.json /path/to/clones /path/to/NEW-output
```

The checker accepts only the frozen customer-service repository revision. It reconstructs its evidence
from bounded record pages, audits the returned source pins against local Git objects, replays earlier
accepted checks and applies destructive mutations to the Q15/Q16 proof inputs. It writes `pages.json`,
`source-pins.json` and `receipt.json` to a new output directory. Acceptance requires complete evidence,
source-pin checks, the required question proofs and rejection of every destructive mutation.

This review explicitly permits at most 49,152 selected records and 32 MiB in total returned pages. Each
request still selects at most 32 IDs and returns at most four records and 64 KiB per page. The older review's
32,768-record cap is unchanged; the larger total is confined to this explicit event review. Bounds and
checker fingerprints are recorded in the receipt. Exceeding a bound fails the review rather than dropping
proof inputs.

Q15 and Q16 answer source questions about save-result rebinding, post-processing, publisher inputs and
payload construction. Passing them does not claim effective async interception, transaction outcome,
broker acknowledgement, delivery or deployed configuration. See the
[customer-service event trial](scan-trials/customer-service-events/README.md) for its frozen scope,
evidence and acceptance result. The wider scans remain stopped.

## Freshness

```sh
npm run scan:freshness -- /path/to/baseline.json /path/to/repo --ref refs/heads/main
npm run scan:freshness -- /path/to/baseline.json /path/to/repo --scope /path/to/scope.json
```

The normal check observes a **local** Git reference. Add `--remote origin` to explicitly observe its remote
revision without fetching blobs. If the remote revision is unavailable locally, the result requires a
rescan/update and cannot pretend that an empty diff means unchanged source. Local freshness says nothing
about an unobserved remote revision. Every result carries the reference, observation source and time.

With `--scope scope.json`, the check computes current analysis fingerprints from the actual scanner, schema
and installed parser toolchains without reading application source blobs. Supply the same `--java`/`--go`
executables used for extraction. Alternatively, `--provenance analysis-inputs.json` supplies explicit digests;
the two options are mutually exclusive. Without either option, the result establishes source status only. The optional file
supplies current environment, configuration, toolchain and rule digests; these are compared with the accepted
baseline before claiming unchanged analysis. A ref rewrite, missing baseline, unavailable observation or
incomplete provenance remains explicit. Deployment freshness is unknown without separate runtime evidence.

Changes are discovered from Git metadata. The cache keys source by actual blob and indexes by parser,
language and adapter/runtime fingerprints, within the workspace/repository/scope authority. A source change
reads and parses its new blob. A same-blob rename reuses syntax and refreshes evidence paths. A parser change
reparses cached source; a recogniser change reruns extraction from cached indexes. Neither requires another
Git source read. Corrupt cache entries are rebuilt rather than trusted.

`planFreshnessInvalidation` follows fact dependencies transitively. Added files invalidate relevant negative
searches; deletions retire facts; configuration, library, schema and rule changes can invalidate dependent
analyses. Incomplete dependency closure widens the affected analysis scope conservatively. Invalidating an
analysis does not require downloading or reparsing all its unchanged source. Current runs rebuild local facts
from cached indexes; persistent semantic-summary reuse is not yet implemented.

```sh
npm run scan:refresh -- /path/to/scope.json /path/to/baseline.json /path/to/clones /path/to/output
```

Refresh observes the current local ref and computes current analysis fingerprints. An unchanged, verified
selected publication skips extraction and index reads entirely. Otherwise it creates a new pinned scope
generation and reads/parses only changed selected blobs, reusing the output cache. Add `--cache` when the
original scan used another cache directory. Selected deletions or renames stop publication for an explicit
manifest update; added files never silently widen this fixed scope. Use the new generation's scope/baseline
pair for the next refresh. Semantic dependency invalidation and repository-wide discovery remain separate
from this selected-source refresh; its output remains partial.

## Bounded retrieval

`createScanRecordReader(document)` builds an immutable record index. A request selects explicit IDs and
record/byte limits, and returns records, continuation and limit diagnostics. Unknown IDs are rejected. Cursors bind the
document, selection and budgets. Support records are not recursively expanded; callers request the next
evidence slice deliberately. The byte budget covers the complete page envelope. An oversized record reports
the limit instead of looping forever.

## Benchmark and restart gate

```sh
npm run scan:benchmark -- /path/to/clones /path/to/NEW-output --java /path/to/java
```

The three checked-in manifests under `test/fixtures/scan/scopes/` fix the Spring write/async, Go
dispatch/queue and Next actor/endpoint scopes: **27 files, nine questions and 19 independent semantic checks**.
The oracle is `test/fixtures/scan/benchmark-reference.json`. Old accepted captures are not imported into
new extraction results. Structured IR must establish each semantic check; stored source text alone cannot.

Each check is evaluated from typed relations and parsed atoms by a checker authored independently of its
language extractor. All 19 also have a destructive semantic mutation: the baseline must pass and the changed
graph must fail that same check, even though its display syntax remains unchanged. Source-level regressions
add decoy callbacks, discarded JSON results, wrong HTTP methods and errors from unrelated calls.

The benchmark records cold/warm timings, CPU, Git blob reads, parses, model calls/tokens, parser diagnostics,
bounded retrieval, rule/parser invalidation and a one-file-change/rename trial. Every cold, warm and invalidated
document passes the public schema and semantic validator. Retrieval covers both operations and the actual
depth-check evidence with its direct source anchors, using the bounded record API. Incremental mutations happen
only in an isolated synthetic repository containing the selected cached files. Original clones are read-only.
Cold means an empty source/index cache; compiler and OS caches may already be warm. No timing or token
baseline for the previous agent workflow has been measured, so these results cannot establish a speedup
factor against that workflow. Scripted runtime model consumption is zero; implementation effort is separate.

Exit 0 requires depth, reuse, integrity and adversarial mutation gates to pass. Exit 2 writes the report but
leaves acceptance incomplete. Exit 1 means an operational failure. Never lower the denominator or reinterpret
unresolved checks as success. None of these exit statuses changes the wider queue's stopped state.

The fixed scopes establish local value rebinding, transaction/error ordering, SQL field lineage, callback
registration, awaited lookup results, derived payload fields and endpoint response paths. They also establish
explicit limits: an async annotation does not prove activation; send/commit does not prove delivery; an
archive catch does not prove rollback; mutable registry dispatch needs runtime context.

These are bounded source proofs. They do not solve arbitrary path feasibility, heap aliasing, whole-program
dependency injection, actor intent, live configuration or deployment identity. Broad question receipts remain
unresolved where their full obligations are not closed, even when a narrower benchmark check passes.
