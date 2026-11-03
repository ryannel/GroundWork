# Customer service pipeline adversarial review

Final provenance refresh: trial 003 has byte-identical documents to the reviewed corrected trial 002.
Source pins, native IDs and query-page snapshots are unchanged; the latest scanner fingerprints are in
[trial.json](trial.json). Other repository scans remain stopped.

## Final corrected selection

`reports/customer-service-pipeline-002/repository.json` is the corrected selection reviewed here.
All nine documents use a consistent placeholder host component. All six diagnostic files retain
a pinned full-file source and parser gap, with no semantic nodes, summaries or candidate facts.
The malformed recovery trees observed in trial 001 therefore cannot answer canonical queries.
Independent quarantine and cross-shard identity regressions pass: three tests, with ESLint passing.

Acceptance remains a reusable partial capture: 340 Java parse attempts, 334 diagnostic-free files,
45 retained ancillary texts, one excluded binary, and 2,720 unresolved broad obligations.
Trial 001 findings below are historical evidence for defects corrected in trial 002, except where
explicitly retained as limitations. No wider repository scan is authorised by either trial.

This review covers only `volvo-cars/cds-ecom-customer-service` at
`09623ab3a1f39845d8fc02abc3d591b53a3b5fea`. The wider scan queue remains stopped.
It distinguishes a complete tracked-file inventory, parsing all supported source files,
and answering questions about the running system. Those are separate achievements.

## Defects found before the trial

Two extractor defects were corrected before repository extraction:

- `backend-semantics.ts` previously emitted no semantic graph at all for a file without an
  explicit method. Lombok DTOs and simple enums therefore lost structured declarations,
  annotations and fields despite successful parsing. Every parsed node now enters the graph;
  nodes outside functions belong to the module summary. Java class, interface, enum, record
  and annotation-type declarations have the `declaration` node kind. This establishes source
  declarations, not effective wire contracts or generated Lombok methods.
- Java `THROW` previously fell through to `expression`. A catch rethrow could therefore escape
  the Spring check's test for a typed throw. It now has the `throw` node kind.

The explicit native Java suite passed seven tests, including new regressions for a Lombok
class without methods, enum declarations/constants and a catch rethrow. These tests exercise
public semantic reference validation as well as extraction.

## What a new reader can query

The selected captures can answer bounded structural questions: which source-declared methods,
fields, types, annotations and calls occur in a selected file; the operands and arguments of
supported expressions; local return values; statement order conditional on normal completion;
and the explicit uncertainty nodes emitted for recognised asynchronous/send/try constructs.
Source anchors retain the exact repository revision. Distinct source spans have distinct IDs,
so overloaded methods and interface/implementation declarations need not collide.

This is a reusable local source graph. The record reader retrieves explicit IDs with byte and
record budgets; it does not provide discovery, recursive dependency expansion or a general
question-answering engine. Existing `namedFunction` queries select the first matching method
name and must not be treated as overload-aware or cross-file symbol resolution.

The seven Spring benchmark checks remain narrow oracles over selected local relations. Passing
them does not establish all endpoint behaviour, arbitrary path feasibility, polymorphic dispatch,
dependency injection, repository transaction semantics or actor outcomes. Broad investigation
receipts must remain unresolved. Empty contracts/effects/actors arrays mean no captured records
of those kinds; they do not prove the absence of contracts, effects or actors in this service.

## Questions that still require inference or more capture

- **Effective routes and defaults.** `CustomerController` declares relative mappings, policy
  annotations, JSON views and request defaults; `CustomerControllerImpl` supplies the
  `/v1/customers` class mapping and implements the methods. A correct route catalogue needs
  inheritance/implementation binding and Spring mapping rules. For example, the archive
  `forceArchive` default is declared as `false`; the create method has a `PostMapping` without
  an explicit path. Annotation syntax alone does not compose those into effective interfaces.
- **Schemas and serialisation.** `CustomerRequest` uses Lombok, validation groups and JSON
  views. `ICorporateEntityRequest` declares Jackson subtype names and a default implementation.
  Preserving these declarations does not resolve effective create/update wire fields, generated
  accessors, inherited shapes, external `BaseResponse` or library types such as `Market`.
- **Authorisation.** Interface `PreAuthorize` annotations retain declared policy. Establishing
  enforcement requires binding the implementation, security activation, interceptors, token
  handling and configuration. No actor or authorised journey follows from the annotation name.
- **Asynchronous work.** `AsyncConfiguration` declares `EnableAsync` and a context-aware executor,
  but neither that declaration nor `Async` alone proves which invocation crosses a proxy,
  which executor runs it, successful delivery or durable completion. Source-local uncertainty
  must remain explicit even where the seven-check Spring oracle passes.
- **Runtime boundaries.** All repository scope files use environment `unknown`. Tests,
  adapter libraries, shared models, core code and the API are not thereby proven to run in
  the same host. The scope host is an analysis placeholder, not a deployable component.
- **Unsupported constructs.** Unknown operators/literals remain `unknown`, while other compiler
  constructs can fall back to `expression` with AST children. A valid graph does not imply
  every construct has typed control/value semantics. Parser diagnostics and unsupported
  frontiers are distinct from semantic completeness.

These observations were checked against bounded pinned Git reads of `CustomerController.java`,
`CustomerControllerImpl.java`, `CustomerRequest.java`, `CustomerType.java`,
`CorporateEntityRequest.java`, `ICorporateEntityRequest.java` and `AsyncConfiguration.java`.
The clone was read only, with implicit fetching and terminal prompting disabled on every Git call.

## Coverage boundary

The repository driver inventories all 386 tracked entries and selects all 340 Java files,
including 84 test files and 256 other source files. Filename classification is explicit.
Ancillary handling now reads the other 46 blobs: 45 UTF-8 text files are retained under
`ancillary/` with path/blob/byte receipts; the Maven wrapper JAR is explicitly excluded as binary.
This repo also contains Maven POMs, application YAML, GraphQL documents, OpenAPI/APIM JSON,
workflows and documentation. Their retained content can support a subsequent review without
reading the original clone. Retention does not parse or interpret those documents, connect
configuration to source declarations, or establish semantic support.
Independent inspection found all 340 selected paths exactly once, with no missing or unexpected
paths against the inventory. Every retained ancillary file matches its declared byte length and
Git blob hash. This is a complete tracked inventory and supported-source parse attempt capture,
with retained ancillary text; it is not a complete repository semantic scan. The driver's `partial` status and unresolved
investigation receipts correctly express that limit.

## Trial 001 findings

**Parser recovery is a semantic trust boundary.** The full cold trial retains 21 diagnostics
across six files. The JDK 17 parser cannot parse the repository's record/unnamed patterns:
`FactoryContext`, `IIndividualFactory`, `OrderUpdateEventConsumer`, `OidcTokenDecoder` and
`TrustedIssuerValidator` are affected, as is the unnamed catch in `PhoneNumberValidator`.
There are 334 diagnostic-free files and six files with recovery diagnostics. This does not
establish invalid application source.
The captures contain recovery trees which pass public reference validation. In particular,
`FactoryContext.getConnectToken` has a declared return node containing only
`return userIdentity instanceof UserIdentity.Connect` at line 65, while the full function syntax
retains the actual ternary returning `Optional.of(token)` or `Optional.empty()` at lines 65–67.
`getEntraIdUser` has the same truncation. These returns are ordinary declared semantic records,
not individual unresolved records. A consumer must consult parser diagnostics and withhold
semantic conclusions for affected files; graph validity alone does not establish parse fidelity.
Use a compatible parser and rerun affected files before accepting their semantic answers.

The `OrderUpdateEventConsumer.isValidOrderEvent` guard at lines 128–132 also becomes an `unknown`
node because an inline comment is included in the source slice used to recognise `&&`.
Its AST children remain captured, but the complete admission guard has no typed operator proof.
Other observed unknowns include Java long literals, text blocks and string concatenations.

All nine cold publications validate individually and contain no contracts, effects or actors.
Inspection found a cross-shard identity conflict: all nine use host ID `host:34a1fafbf6917ed6`, but its `component` is respectively
`scope:repository-0001:unknown`, `scope:repository-0002:unknown` and
`scope:repository-0003:unknown`, continuing through `scope:repository-0009:unknown`.
A consumer cannot merge these records by ID without choosing
between different component identities. Per-document validation does not check this invariant
across publications. Retain shard context and do not present their union as one reconciled graph
until host identity is consistent. No extraction was changed during this run.

| Cold shard | Document bytes | Semantic nodes | Unknown nodes | Fallback expression nodes | Largest compact record bytes |
| ---------- | -------------: | -------------: | ------------: | ------------------------: | ---------------------------: |
| 0001       |     14,438,760 |          7,965 |             5 |                       834 |                       40,847 |
| 0002       |     17,297,115 |          9,272 |             0 |                     1,001 |                       27,760 |
| 0003       |     10,022,308 |          5,314 |             1 |                       653 |                       18,995 |
| 0004       |     11,944,226 |          6,413 |             1 |                       719 |                       28,508 |
| 0005       |     16,315,317 |          8,692 |             2 |                       920 |                       38,979 |
| 0006       |     41,146,038 |         22,121 |             1 |                     2,062 |                       55,400 |
| 0007       |     42,012,363 |         22,631 |             4 |                     2,058 |                       76,636 |
| 0008       |      7,585,967 |          3,944 |             0 |                       582 |                       14,758 |
| 0009       |     12,440,129 |          6,532 |            10 |                       665 |                      101,094 |

These sizes measure actual pretty-printed documents and compact UTF-8 JSON for individual records.
Across all nine shards there are 92,884 semantic nodes: 24 unknown and 9,494 fallback expressions.
The documents total 173,202,223 bytes for 898,465 selected source bytes, about 193 times the source
size. Four records exceed 64 KiB: root/class syntax records in `IndividualFactoryTest` and
`CustomerControllerTest`; the largest is 101,094 bytes. These fit the reader's maximum 1 MiB
budget, but 16 or 64 KiB requests can return `oversized-record`. Semantic syntax repeats full
subtrees. The bounded reader helps retrieve slices after loading the document; it still clones
and indexes the entire document on construction. These measurements establish neither a memory
limit nor a speedup against an earlier workflow.

The report records 340 broad questions and 2,720 unresolved obligation answers. These are not 340
accepted endpoint discoveries. Warm publications match their cold generations and reuse all 340
indexes with no Git source reads or parser calls. This supports cache reuse for the unchanged
scope and toolchain; it does not resolve the semantic findings above. The trial does not establish
remote/deployment freshness, a speedup over the previous workflow, or permission to restart other
repositories. The proper acceptance is a reusable partial capture with explicit follow-up defects.

## Trial 002 remediation

The follow-up publication under `reports/customer-service-pipeline-002` was inspected independently
after the two trust-boundary fixes. Its first phase reused the original source/index cache:
zero Git source reads, zero parses and 340 index hits. This is a cache-backed remediation run,
not another cold measurement. Its warm phase selects the same nine generation hashes.

All six files with parser diagnostics now have exactly one full-file pinned source and one
parser gap, with zero semantic nodes and zero summaries. The recovered `FactoryContext` returns
therefore cannot supply canonical typed answers. Raw source and diagnostic trees remain available
in the source index for review. This intentionally withholds valid-looking portions of affected
files too; a compatible parser remains necessary to recover their semantic coverage.

All nine selected documents now associate `host:34a1fafbf6917ed6` with the same component,
`scope:volvo-cars/cds-ecom-customer-service:unknown`. The component identity conflict is resolved.
This remains a consistent analysis surrogate, with no new runtime or deployment proof.

Three independent regressions pass in `local-facts-diagnostics.test.ts`: a recovery tree cannot
emit declarations/returns/candidates while preserving its pinned source and gap; an empty recovery
tree still retains the source and gap; and different shard IDs preserve a consistent host
identity. The clean-index control still emits semantic records, guarding against accidentally
disabling extraction for every file. The tests use synthetic parser output without requiring a
native compiler and verify that quarantine leaves the original source index unchanged.

Trial 002 contains 1,841 summaries and 266,321 semantic records in 169,782,086 pretty-printed
document bytes, approximately 189 times the selected source size. There are 23 unknown and 9,257
fallback expression nodes. Four records still exceed 64 KiB and the largest remains 101,094 bytes.
All 2,720 broad obligations remain unresolved. The route/default, schema,
authorisation, asynchronous, overload-resolution and payload-size limits described above remain.
The inline-comment operator defect is not fixed; its observed file is now wholly quarantined
for the independent parser diagnostic. Trial 002 is the safer reusable partial capture; trial 001
remains the original measurement and evidence for the corrected defects.
