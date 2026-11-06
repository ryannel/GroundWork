# PR6: deterministic model migration

The migration writes a new workspace copy and review files. Original workspaces, their repositories and
caches remain untouched. No LLM runs inside the tool. PR7 must use the merged PR6 tool commit and accept
reviewed data proposals separately.

## Acceptance proof

- `verification/pr6/round-trip.json`: two complete synthetic legacy migrations with the same accepted
  headline produce byte-identical output files and review reports. The original remains unchanged, and
  reversing authored file order preserves identities. This includes cited queue access, an app job, its
  original trigger, tagged fields, and an uncited future plan return. Both outputs pass the isolated
  ordinary reader, strict current-fact validation and plan-projection validation.
- `src/infrastructure/model-plan-projection.test.ts`: seven focused tests cover six proposed effects,
  replacements, retained citations as context, unchanged facts, an invalid current base, malformed steps,
  missing targets and invalid citation syntax. A projection remains proposed even when old citations exist.
- `verification/pr6/queue-compatibility-current.json`: the 13 recorded queue probes fail only on their
  rewritten prefix under the frozen PR5 authority and pass the corrected current authority. Four focused
  semantic tests reject streams and missing topics and preserve queue read/write facts.
- `verification/pr6/fidelity.json`: all facts and all 188 legacy route statuses, headings, links and payloads
  equal PR5. All 193 frozen PR1 baseline files are unchanged. The unchanged comparator accepts the recorded
  captures with zero unexplained differences: Personal 31, Acme 78, Volvo 42,792 historical differences.
- Four new exact HTML-size pairs are proved by `verification/pr6/transport/proof.json`: complete DOM and
  decoded Flight values are equal, with one fewer 43-byte wrapper each. Only those exact pairs were added
  to `allowed-diffs.yaml`. The parameterised recorder and verifier retain the response actually compared,
  so no manual recapture loop is needed.

## Implemented migration

Identities and references are rewritten together, including bare domain/system/area ids, qualified text
links, fields, plan operations, progress, revisions and locks. Unique job labels receive aliases; a shared
trigger label has an explicit ambiguity. An explicitly proposed UI component receives an app id.

Components and their details are consolidated into their containing systems, with keyed homes and exact
historical commit/span citations. Misfiled component details follow declared identity; interfaces follow
declared providers, while vendor contracts remain at their recorded consuming system. Resource owners
require a cited executable component. Original conflicts and unsupported source notes remain in review.

Handlers are split by component. Control flow, failures, retries, waits and effect modifiers are retained.
Readable step ids use meaning and code-location ordering; collisions require review rather than traversal
numbering. Full long descriptions remain present, and only accepted headline rows supply `say`.

Jobs and subscriptions are declared. Graphs/subgraphs, full GraphQL documents, screens and interactions
are retained in their canonical homes. Possible resolver reach is labelled as such; runtime conditions
are not inferred. Historical document provenance remains explicit.

Cited handler effects, GraphQL operations and uncovered contract access/producer/consumer declarations
back relationships and summary connections. Other claims remain review rows; accepted edge dispositions
are applied exactly. Output validation rejects unbacked summaries. Message identity is preserved when
several messages share one topic; consumption duplicate checks use delivery direction.

## Approved design clarification

The user approved the narrow plan-provenance amendment after three independent reviews, recorded in
`pr6-plan-provenance/`. One structural model and schema authority serve named current-fact and projection
profiles. Only the annotated implementation-evidence requirement differs. The projection boundary validates
today strictly and computes its own after model. Missing implementation evidence stays visible; current-fact
checks reject uncited effects and derived proposed behaviour. No authored per-step planned flags were added.

The remaining schema corrections preserve observed values: app jobs, free-text delivery semantics,
GraphQL invocation metadata, screen reads/assets, HTTPS transport, high-level flow transport, landscape
model backing, historical document references and retry wording with an unknown stopping condition. They
do not infer missing message contracts, retry success conditions, client placement or implementation.

## Real-data preflight and PR7 handoff

`verification/pr6/migration-inventory.json` pins Volvo commit
`723085497ded5b51d3c23fdcb5f6b1c778aa3efa` and hashes all 250 authored input files. The current preflight
builds 445 fragments, including 190 handler files and 111 job declarations. Counts distinguish source URL
occurrences across all authored files from the narrower original design audit.

The tool intentionally stops before creating an output when identity, placement, step-id or document
reconciliation is pending. Volvo is still unchanged. Pending rows include 122 external/system classifications,
583 step collisions, 83 placements and three older plan context documents. Those three documents retain
all original narrative and stage identities; the tool accepts only an explicitly reviewed canonical
replacement, rather than dropping their contents automatically. Full descriptions remain usable while
headlines are reviewed.

The specification's 17 operations / 313 plan step nodes comprise seven handler operations / 275 nodes
(five replacements and two additions) plus ten added flows / 38 nodes. All eight `after: flow:…#step`
anchors remain explicit. This corrects the inventory label without changing its total.

`verification/pr6/evidence-migration.json` records 348,730 unambiguous evidence identities. The 1,817
unsupported legacy records retain their complete originals in review and become visible evidence gaps;
confidence, provenance and other missing information are never fabricated. Legacy discovery metadata
keeps its values through canonical field renaming.

The output excludes repository metadata and large generated cache/explorer folders from the new copy;
these remain untouched in the original. PR7 must transfer the authored migration manifest and preserve
legacy files and caches until PR9's replacement proof. The cache decision in design §10.2 still requires
the user's reconfirmation before PR9.

## Verification and merge gate

The frozen source passed focused format, lint, types and 3,051 related tests across 346 files. The production
build passed; its initial restricted-network font download failure is retained separately from the passing
network-enabled build. Page budget passed for 606 pages, maximum 1,021 KB against 1,024 KB.

Logs and structured results are under `verification/pr6/`. The normal pre-push `npm run check` and GitHub
check, mutation and CodeQL workflows remain mandatory merge gates. No PR5 check result substitutes for
the changed PR6 inputs. Mutation covers the four touched pure-layer files in full; all existing thresholds
and architecture rules remain unchanged.
