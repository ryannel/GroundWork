# Endpoint control and data flow

A REST scan must explain the implementation beneath each discovered endpoint: what runs, how it branches,
which systems it calls, the information they receive, and where information is stored and in what shape.
An endpoint list, component dependency graph or happy-path summary does not meet this requirement.

These requirements apply to both output modes. Canonical scans follow
[canonical-scan.md](canonical-scan.md), using native v3 records and validation. The companion convention below
applies only to the legacy workspace reader; it does not replace a canonical bundle.

## Completion and scope

Account for every discovered endpoint. Trace the registered implementation, relevant middleware and delegated
code, including libraries. Follow downstream calls into available code at an explicitly recorded revision.
Do not silently stop at a repository or team boundary. Stop at an unavailable, unresolved or deliberately
bounded continuation and record what examination would resolve it. Every finding is source behaviour at a
revision, not evidence that the code is deployed or that a path ran in production.

Maintain an explicit inventory of discovered registrations, including unexamined and excluded scope. For legacy
companions, record each endpoint as `traced`, `partial` or `blocked`, with examined scope and open continuations.
Canonical `coverage.status` is `examined`, `partial` or `not_examined`, per stated obligation; do not put legacy
status names into native records. An examined registration is not an examined implementation or wire contract.
`traced` means the acceptance questions below are answered for that stated scope, with downstream boundaries
identified. It does not mean all runtime inputs have been explored. An untraced registration is `blocked` or
`partial`; it must not imply an empty implementation. An explicitly bounded investigation may pass its local
questions while the endpoint remains partial end to end. Do not claim the whole scan complete while endpoints
remain partial or blocked; report the outstanding work.

## Required information

| Concern                | Capture                                                                                                                                                                                                                                                                                                 |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Registration           | Method, effective application path, route prefixes, handler symbol, request/path/query/header inputs, response contracts and content types. Keep public gateway rewrites distinct from application routes.                                                                                              |
| Before the handler     | Authentication, authorisation, middleware and request validation. Distinguish declared annotations, resolved enforcement, test assertions and unknown shared configuration.                                                                                                                             |
| Control                | Ordered steps, calls within the process, guards and the values they inspect, mutually exclusive branches, early returns, loops, parallel work and waits. Preserve source expressions alongside plain-language explanations where needed.                                                                |
| Exceptions             | Throw sites, catch sites, exception inheritance, status selection and response construction. Include failures before the handler and errors from delegated code; never infer an HTTP status from an exception's name.                                                                                   |
| Data                   | Values read or created at each significant step; sources and destinations for each binding; copy, rename, default, lookup, calculation, filter, merge, mutation, discarded result or unresolved transformation.                                                                                         |
| Calls                  | Call site, target operation or unresolved target, protocol and execution mode; path/query/header/body bindings; result use; destination configuration and overrides. Trace client wrappers and relevant interceptors.                                                                                   |
| Storage                | Store and namespace binding, engine, collection/table/key, selection predicate, read/write mode, persisted schema and keys. Include inherited and nested fields, serialisation names and relevant converters; mark unresolved fields. Keep persisted entities, internal objects and wire DTOs distinct. |
| Effects and completion | Writes, publications and external effects; ordering and transaction/durability boundaries; retries, timeouts, fallback, acknowledgement and deduplication. Distinguish successful return, request accepted and later completion.                                                                        |
| Applicability          | Feature, market, tenant, build and environment conditions; configuration provenance and defaults; what effective values are unknown. Never copy secrets or live payloads.                                                                                                                               |
| Evidence and validity  | Commit-pinned sources per significant step, guard, binding, schema and outcome; invalidation inputs; test assertions and execution results separately; unresolved edges and conflicting evidence.                                                                                                       |

Follow helper functions far enough to explain these effects. Collapse boilerplate, not meaningful control or
data. Expand type inheritance and relevant generated code rather than concluding that an empty subclass has
no fields. A field annotation can establish an explicit constraint; it does not establish every framework
default or effective serialisation rule.

A schema reference alone does not explain a call. Bind the actual outgoing values to request inputs, stored
records, configuration, prior responses or calculations. Do the same for writes and endpoint responses. If a
whole object passes through unchanged, record the object-level copy and its schema rather than fabricating
per-field mappings. For conditional omission, defaults, merge precedence or mutation, retain the condition
and the value before and after. Reference the same binding from both the control step and data-flow view.

Libraries execute in the caller's process. Record the imported artefact, declared version and resolved version
or digest when available, then bind implementation sources to that artefact. A clone's latest source may be
useful candidate evidence but is not proof of the imported version. Record the mismatch and avoid upgrading
candidate library fields or behaviour into established facts. Treat a server implementation and its generated
client as separately versioned artefacts.

For a call, distinguish its return being awaited from completion of the wider operation. For messaging,
record acceptance/persistence and consumer execution separately. Trace asynchronous continuation only when
the producer, channel, consumer and relevant correlation are established. Unknown completion paths remain
explicit; do not invent a webhook or consumer merely because an endpoint returns 202.

For writes, distinguish staging from the acknowledged store operation. Capture the acknowledgement condition:
normal return, successful Result, ignored Result or unknown. An awaited Task can return a failed Result;
ignored failure is meaningful control flow. Trace cache hydration as well as the main write. Record whole-list
read-modify-write separately from entity upsert, and retain failure windows between database/publish or
cold/hot writes. Sequential replacement by entity Id is not message deduplication or a delivery guarantee.

For asynchronous joins, establish broker namespace and channel, source configuration profiles, message type
header/filter, encoding and wire schema. Keep committed profiles distinct from effective deployment. Preserve
numeric protobuf tags and reserved fields. Treat a correlation header as correlation unless message identity
or deduplication use is demonstrated. Consumer invocation has its own completion and exception context; its
failure cannot unwind into the producer's HTTP request. Unknown offsets, retries and ordering stay unknown.

## Runtime boundaries and contracts

Establish each running component from entrypoints or deployment declarations. Bind the executing implementation
to that component; a repository, package import or team is not a runtime boundary. Libraries execute in their
caller's host. Bind each outbound call, read/write, publication and consumption to its call site, runtime target
or explicit unresolved target, protocol and interface contract. Keep waiting for a response, producer result,
store result and handler result distinct. Never turn a newer candidate client into a confirmed runtime target.

Capture REST path/query/header/body schemas and response cases, message envelope/payload/key/header schemas,
and stored representations, including nesting, array item shapes, constraints and uncertainty. Retain the
source DTO/construction separately when effective wire serialisation is unresolved. Explicit absence differs
from an unknown schema. Every contract, schema and meaningful field binding retains its actual repository,
commit, file and line range; derive GitHub permalinks from those anchors rather than citing moving branches.

Canonical proof records and component-first walkthroughs are described in
`docs/scan-trials/runtime-components.md`. These JSON records are separate from production workspace YAML;
do not insert their keys into contracts or handlers before the app migration.

## Legacy companion artefact

Return `<fragment-stem>.endpoint-analysis.yaml` beside the normal fragment. This is an extraction artefact,
not a new workspace file or an extension silently accepted by `plan.schema.json`. It retains information the
current handler schema cannot represent. The current app does not read it. The production reader has not migrated to v3.
Review the companion explicitly and report which information was projected into the normal legacy model.

Use a versioned root, a source table and endpoint-local records:

```yaml
format: groundwork-endpoint-analysis/v1
repositories:
  - repo: acme/example
    commit: <full sha>
sources:
  route:
    repo: acme/example
    commit: <full sha>
    path: src/routes.ts
    lines: [10, 35]
endpoints:
  - id: api:existing-id
    method: POST
    path: /example
    coverage:
      state: partial
      examined: Registration, local handler and its delegated mapper
      unresolved: [client-policy]
    contracts: []
    steps: []
    bindings: []
    storage: []
    outcomes: []
    gaps: []
    invalidation_inputs: []
```

This is a documented interchange convention, not a JSON-schema-validated format. Records use these fields:

- `contracts`: local `id`, `role`, `type`, `fields` or definition reference, and `sources`. Distinguish input,
  internal, outgoing, persisted and response roles. Mark partial type closure rather than guessing fields.
- `steps`: local stable `id`, `kind`, `does`, `sources`, and the relevant `guard`, `next`, `otherwise`,
  `on_error`, `target`, `bindings` or `result`. Targets may be unresolved. Guards name their input bindings.
  Exception edges are separate from ordinary branch edges; return steps have no normal successor.
- `bindings`: local `id`, `step`, `from`, `to`, `transformation`, `sources`, and `when` if conditional. Value
  paths use `request`, `session`, `transaction`, `outgoing`, `downstream`, `response` or other declared local
  names; state the defining contract or step. Use `unresolved` plus a gap reference for unknown lineage.
- `storage`: local `id`, `engine`, `binding`, `resource`, `schema`, `access`, `sources` and `gaps` where needed.
  Bind logical database names separately from environment-specific physical locations.
- `outcomes`: local `id`, `when`, `status` or other termination, `body`, `sources`, and completion meaning.
- `gaps`: local `id`, `at`, `question`, `reason`, `resolve_by`, `sources` when available, and the claims it
  prevents. A missing source, version mismatch and unsupported dynamic dispatch are different reasons.
- `invalidation_inputs`: repository, path, package/version, configuration binding or upstream analysis,
  with the affected step/binding/outcome. Evidence citations and invalidation inputs serve different purposes.

Local ids are scoped to the endpoint and do not create new workspace levels. Preserve an id when its meaning
survives a refactor. For every reference, check that its target exists or is explicitly unresolved. Record
source-specific evidence roles on findings when implementation, declaration, test assertion or candidate
dependency code differ. A source-table reference resolves to a full repo/path/lines/commit source.

## Acceptance questions

For each endpoint, answer these from the artefacts without rereading the code:

1. Where is it registered, what inputs can it receive, and what runs before its handler?
2. What logic runs beneath it, including delegated library code, and where does each branch lead?
3. Which conditions permit each outgoing call, publication or write? Which branches avoid them?
4. For every transmitted, persisted or returned value, where did it come from and how was it changed?
5. Which data is at rest, how is it selected, and what does its stored representation look like?
6. What does each downstream response contribute, including results that are discarded?
7. What errors reach the caller, through which throws/catches/middleware, and after which possible effects?
8. What constitutes acceptance, durable progress and completion? What remains unknown about later work?
9. Which environment, configuration and dependency versions make the answer applicable?
10. What evidence proves it, what could invalidate it, and exactly where does knowledge stop?

Mark each answer established, partial, unknown or not applicable, with supporting record references. Reading a
test supports an assertion; it is not a test run. Do not call the endpoint or connect to a store merely to
test the extraction requirements. Static inspection with a known-answer scenario is sufficient for a trial;
any executed test or runtime observation must say what was executed and in which isolated environment.

## Legacy model gaps

The production YAML handler trees already support decisions, calls, publications, reads/writes, concurrency and failures. They do
not yet support stable execution-step ids, typed value bindings, explicit exception-flow edges, unresolved
call identities, per-endpoint analysis coverage or semantic invalidation inputs. Persisted schema inheritance
and client/server artefact bindings also need explicit treatment. Keep these in the companion and report them;
do not claim a passing workspace validator proves that endpoint control and data flow are fully represented.

The [Volvo capture trial](../../../docs/scan-trials/volvo-capture.md) exercises this requirement against pinned
source, with its companion artefact and remaining questions.
