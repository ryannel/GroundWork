# Volvo re-scan acceptance

The pipeline has a [separate launch readiness report](launch-readiness.md). Complete semantic and product
acceptance still happens per repository after its actual pass; it has not been claimed for the whole
corpus. A pinned unresolved runtime boundary is legitimate. Missing repository-local language/framework
semantics remain source gaps. The wider queue remains stopped.

This is a strict **ingestion acceptance** contract. It does not require scanning all repositories before
launching a re-scan. Launch readiness is assessed separately: complete pinned metadata availability,
explicit language/framework routing (including a proved canonical fallback where needed), representative
parser/framework/query/reader proofs, source budgets and stop/resume controls. After launch, each
repository must meet its own strict source obligations before publication can claim completeness.
Unsupported or unexamined semantics may remain visible during a run; they cannot become complete answers.

## Metadata denominator

[volvo-metadata.json](volvo-metadata.json) inventories the exact current `scan-state.json` roster: **108
repositories**, not 101. At their recorded pins, 108 local trees are available, containing **78,699 tracked
entries**. `content-green-light` and `pop-assortment-gitops` resolve from existing alternate clones under
`cb-special-projects/.repos`; each report row retains its actual clone path. Reads used `git ls-tree` and revision resolution with lazy fetching disabled. No source blob was
read, parsed, fetched or scanned. Filename language classification includes tests, generated and vendored
files; these counts are conservative source candidates, not production semantic coverage.

| Language                 | Tracked candidate files |
| ------------------------ | ----------------------: |
| TypeScript               |                  34,108 |
| C#                       |                  12,670 |
| Java                     |                   6,334 |
| Go                       |                   3,386 |
| JavaScript               |                     861 |
| MDX                      |                     519 |
| SQL                      |                     490 |
| Protobuf                 |                     258 |
| Python (including stubs) |                     254 |
| Shell                    |                     185 |
| GraphQL                  |                     139 |
| Terraform                |                      54 |
| Handlebars               |                      51 |
| Rust                     |                      42 |
| HTML                     |                      41 |
| PowerShell               |                       7 |

Additional first-class source forms are CSS (892), Gherkin (362), Dockerfile (170), Windows shell (24),
Make (22), SCSS (21), Razor (eight), Bicep (four), Go templates (three), Avro schemas (two), a Python
notebook and one Rhai script. Their presence creates explicit language/profile or justified exclusion
obligations; it does not imply generic semantic support. The full per-repository report retains the counts.

Python candidates occur in eight repositories: `cce-filter-service`, `cce-optimization-api`,
`cce-policy-admin`, `graphql-federation-mono`, `graphql-federation-mono-gitops`, `offer-management`,
`pop-assortment-libraries` and `product-enrichment-tools`. Rust occurs in `graphql-federation-router`.
These are additional explicit semantic coverage obligations beyond C#. No whole-language support is
established by this metadata pass. The report retains every other suffix for review, rather than calling
unrecognised extensions non-source. Framework manifest filenames are candidates; dependency contents were
not inspected, so a Maven project is not automatically classified as Spring.

Reproduce against the same immutable pins, writing a new output file:

```sh
node --import ./tools/register.ts --conditions=react-server tools/scan-rescan-preflight.ts \
  docs/scan-trials/volvo-native-rescan/scan-state.json \
  /Users/RNEL/.cache/groundwork/clones /private/tmp/NEW-volvo-metadata.json \
  /Users/RNEL/Workspace/cb-special-projects/.repos
```

## Repository ingestion acceptance contract

`src/domain/scan/rescan-acceptance.ts` requires one current, independently reviewed, digest-verified receipt
per repository for each gate. The caller is responsible for checking artefact bytes before supplying a
verified digest. A bare JSON status or test summary is not a verifier. Acceptance covers exactly the
provided pinned roster; it neither implies remote freshness nor changes scan authorisation.

1. **Tracked tree and language mapping.** Reconcile every path, mode and blob against the pinned tree.
   Review unknown suffixes, extensionless executable files and embedded languages. Any exclusion has a
   source-pinned reason; unsupported languages remain first-class blockers for complete source coverage.
2. **Language syntax and semantics.** For every discovered source language, prove parser diagnostics,
   local calls/values, branches, failures and asynchronous boundaries with independent source expectations.
   Reconcile selected production source, tests/generated exclusions and quarantined files explicitly.
3. **Framework entries, effects and schemas.** Discover framework/version from source/dependency evidence;
   inventory endpoints, consumers and jobs; bind execution, request/response/message/storage shapes and
   outbound effects. Unsupported framework features remain unresolved, not generic name-based successes.
4. **Runtime components, connections and reverse queries.** Bind technical identities and connection evidence
   to pinned sources; query callers/providers and effect/schema origins in both directions. Dynamic targets,
   deployed identity and delivery/durability uncertainty remain explicit.
5. **Reader route.** Independently exercise UI and AI navigation from overview through entry, branch/effect,
   schema and pinned source. Prove bounded pages, omissions, errors and unknown states survive the route.
6. **Inference separation.** Retain best-effort actor/purpose/journey interpretation with exact input snapshot,
   rationale, confidence, alternatives, limitations and actual model usage. Inferred intent cannot fill a
   missing semantic binding or establish runtime enforcement.
7. **Cache, delta and freshness.** Prove cold/warm reuse, changes/additions/deletions/renames, negative searches,
   parser and analysis invalidation, inference invalidation and explicit local/remote freshness boundaries.
8. **Workflow and independent challenge.** Prove stop/resume, immutable publication, byte/resource bounds and
   adversarial mutations against frozen independent expectations across the actual language/framework matrix.

A declared unsupported/pending/failed gate, stale pin, duplicate/missing receipt, empty/duplicate roster or
unreviewed/unverified evidence blocks acceptance. The assessor deliberately has no generic test-count
input. The metadata command always reports that semantic and product acceptance is still required.

Launch review must reconcile the 108-versus-101 scope discrepancy and explicit per-repository language/framework routing. Fresh full captures are an outcome of the authorised re-scan, not a prerequisite for starting it.

## Capability routing for the re-scan

Run the metadata preflight before assigning repository passes. Its routes are candidates and work policies,
not support receipts. Keep the complete tracked tree as the denominator, including tests, generated files,
embedded languages, scripts, templates and deployment/configuration files.

- **Parser candidate:** TypeScript, JavaScript, Java, Go, C#, Python and Rust go through the installed
  compiler/AST adapter and its current fingerprints. Check runtime availability and diagnostics first.
  A parser path establishes syntax availability; it does not establish support for every framework/version.
- **Pinned canonical capture:** Protobuf, GraphQL, SQL, JSON/YAML/XML/TOML configuration, Avro, Terraform,
  Dockerfiles, shell/build files, Razor, MDX, templates, Rhai and every other source form without a verified
  semantic path retain pinned bytes and source anchors. Use the appropriate canonical authoring contract
  and independently review the source facts needed by the questions. Preserve explicit unsupported,
  unexamined and dynamic boundaries; raw retention alone closes no semantic obligation. Keep `scan/v1` and
  retained `knowledge/v3` capture contracts separate.
- **Framework discovery:** Inspect pinned manifests/imports/declarations before choosing the entry,
  schema or effect profile. Unknown frameworks get an explicit partial capture and an open learning gap.
  Do not infer activation, dispatch, wire coercion, effects or delivery from names or inferred intent.
- **Unknown suffix or executable content:** Review the path and source form explicitly. A missing parser
  is never a justification to relabel executable/contract/configuration source as ancillary-complete.
  Exclusions need a pinned reason and remain part of the inventory reconciliation.

During an authorised run, repair repeated or reproducible extraction gaps through the existing learning
loop: retain a minimal reproducer and nearby counterexample, improve the shared capability, verify it,
then regenerate affected facts and interpretations at a checkpoint. A genuine external/runtime boundary
can remain unresolved with evidence. Neither a successful parser run nor a plausible LLM explanation
makes an unclosed semantic question complete.

Launch review needs available pinned trees, explicit routing and representative verified paths plus workflow
controls. Strict ingestion acceptance happens per repository after its actual pass. This permits a useful
re-scan to start without claiming that unscanned repositories or unsupported semantics are already complete.

## Python and Rust runtime setup

The Python adapter uses the selected installed Python 3 standard-library `ast` parser. The Rust adapter
uses **tree-sitter 0.25.2** and **tree-sitter-rust 0.24.0** binary wheels in
`node_modules/.cache/groundwork/python-tree-sitter`. Setup installs only those parser wheels into that
cache, using exactly the interpreter selected by the runtime; it restores no application dependencies,
imports no target modules and runs no Cargo build.

```sh
node --import ./tools/register.ts --conditions=react-server tools/scan-python-rust-setup.ts
node --import ./tools/register.ts --conditions=react-server tools/scan-python-rust-setup.ts --check
```

The check parses synthetic Python/Rust functions and prints actual parser identities and fingerprints.
Missing/incomplete Rust wheels stop fingerprint preflight with the setup command; direct parsing returns
an explicit unavailable diagnostic and no syntax proof. Adapter source, selected Python version, package
wrappers and grammar/runtime binary digests participate in fingerprints. Unknown or newer syntax is
quarantined, not reinterpreted as another language or treated as successful empty extraction.

The current machine verified Python **3.13.17**, Tree-sitter **0.25.2** and Rust grammar **0.24.0**. The
bounded optimisation project declares Python **3.15.0** in its pinned manifest; the selected four source
files parse under the available runtime. This proves those selected files, not arbitrary Python 3.15
syntax. A wider pass must retain diagnostics and provide a compatible runtime or explicit canonical
fallback for unsupported syntax before claiming complete source semantics.

## Retained Python/Rust proof

[proof-r4/receipt.json](proof-r4/receipt.json) is the current selected-source proof, after the managed C#
compiler and Java boolean normalisation changes. It retains four Python files, three Rust files, two
manifest inputs, validated source documents, bounded API pages and exact baseline fingerprints. Retained API pages use
`pages.json.gz`; `transport.json` records the exact decompressed byte hashes. Compression preserves the
original page JSON without formatting or changing any evidence records. Its six
fixed checks cover FastAPI entry linkage and explicit mount uncertainty, Graphene resolver/source DTOs,
Apollo plugin declaration and Serde source optionality. All 4,085 source anchors were checked against the
seven pinned Git blobs. The 49 bounded pages contain 192 selected records.

The refresh reused all seven compatible syntax indexes: no Git source-blob reads and no parses were
needed. Documents are byte-identical to the preserved earlier proof versions; new baseline fingerprints record the
analysis refresh after deterministic managed-compiler diagnostics were verified. This is representative launch evidence, not complete Python/Rust repository acceptance.
The frozen original scopes remain beside this report. All proof versions and input bytes are retained.

The proof runner rejects stale parser/analysis baselines. To replay a retained pack, decompress each
`document.json.gz` beside copies of its `scope.json` and `baseline.json` in a new temporary directory, then
run:

```sh
node --import ./tools/register.ts --conditions=react-server tools/scan-polyglot-proof.ts \
  /path/to/python/document.json /path/to/rust/document.json \
  /Users/RNEL/.cache/groundwork/clones /path/to/NEW-proof-output
```

Current analysis changes require a new immutable capture before this command can pass. The learning
records cover [closure reaching values](learning/closure-reaching-value.md) and
[native boolean types](learning/java-boolean-literal-values.md), including the independent counterexamples
and why failed candidate evidence cannot be promoted.

[The independent Customer-service question review](customer-independent-question-review.json) retains
all 22 frozen questions and required-evidence clauses. The fresh 225-mutation receipt and seven native
probes support the unchanged 13/8/1 source tally, with explicit semantic edge-ID migration and no UI-based
promotion. The eight partial questions and Q21 source gap retain their exact outstanding obligations.

## Local object availability

[The final header preflight](object-availability.json) verifies all 108 pinned parent-repository snapshots:
78,695 tracked blob paths and 75,441 unique per-repository commit/tree/blob header lookups. Four gitlinks
remain explicit external child-source boundaries. This verifies names, object types and sizes, not a
full source-body hash or semantic audit.

The initial check found 52 missing objects across four primary clones. Existing complete alternate clones
resolved 41; an explicitly authorised fetch requested only the remaining 11 pinned blob IDs for
`cds-finance-engine` and `gpe-price-data`, with no tag, branch, FETCH_HEAD, worktree or submodule updates
requested. No source bodies were inspected. [The recovery ledger](object-recovery.json) preserves the
exact IDs and scope; the original failed availability report is retained.

Use the read-only clone routing in [source-clone-routes.json](source-clone-routes.json) for launch:
`reports/rescan-launch-readiness-001/source-clones` is the concrete clone root. It contains directory
aliases to the selected existing clones, including the complete alternate clones; using the old primary
clone root alone would lose those two recoveries. The actual source pass still verifies all selected bytes.

Recheck metadata without source reads, parsing, lazy fetching or network:

```sh
node --import ./tools/register.ts --conditions=react-server tools/scan-rescan-objects.ts \
  docs/scan-trials/volvo-native-rescan/scan-state.json \
  reports/rescan-launch-readiness-001/source-clones /private/tmp/NEW-object-availability.json
```
