# PR 4: core model and indexes

Base: `7cfdcbc9470559eafcdeea040fc238f8872166b9` (PR 3). Branch: `codex/rebuild-pr4`.
The design, work plan and requirements remain unchanged.

## What is proven

The canonical fixture loads through `readModel`, indexes every declared identity, applies the complete fixture
plan, validates with the same contracts and round-trips through JSON. Its legacy carrier has no losses. The
existing `DomainPage` renders Orders and its Ordering system through that adapter in
`src/features/workspace/rebuild-model.test.tsx`. This is the required compatibility slice; it does not claim
that all legacy pages already read the canonical model.

`verification/pr4/model-proof.json` records source fingerprints, counts, gaps and execution edges before and
after the overlay. The fixture deliberately retains unknown ownership, schedules, unresolved composition and
missing citations as gaps. Its 23 evidence records cover all 22 schema families. `model-map.md` is produced
from that same index.

## Implementation

- `domain/workspace-model` owns serialisable model data. `domain/plan-apply` edits a private copy by explicit
  identities. New citations use the generated schema metadata; arbitrary business JSON is untouched.
- `infrastructure/read-model` reads registered workspaces, validates fragments, joins containment, resolves
  pinned code and evidence citations and memoises until authored files or evidence change. Duplicate evidence
  identities and missing repository metadata fail before resolution can choose a record.
- `application/model-index` derives placement, entries, flows, component and system edges, reverse queries,
  read/write and message roles, code homes, cited resource ownership, teams, freshness and gaps. GraphQL
  composition follows recorded selections, requires/provides and overrides. Possible resolver reach is not
  presented as an observed query plan. `plans-index` gives each overlay independent before and after values.
- `application/legacy-view` is the new-to-old boundary. It retains canonical facets on their containing
  workspace/domain/system and compares every source field with that carrier. Unsupported legacy display forms
  are carried raw; no store form, transport or owner is invented. `systemModelOf` remains the old-input path.
- Legacy placement is indexed explicitly before the store-owner fallback is removed. Regression tests cover
  the system map, today journeys, area resources and workspace plan index. Global flows have no invented
  containing service: work on a whole flow follows all recorded participants, and a nested step follows its
  own placement. Browser JSON carries serialisable placement data.

## Fidelity

PR 1's frozen baselines are unchanged. `causes.json` reconciles differences by cause, source citation and classification (changed derived claims, representation and ordering). `fidelity-ledger.json` records checks against Personal, Acme and Volvo:
all authored workspace data, raw attribution, code homes, explorer data, languages, targets and scan/repository
states are unchanged. All retained component and system edge records are exactly unchanged, including their
backing steps and handlers. Callers, handler edges and message derivations are unchanged.

The removed inferred owners number 1, 2 and 18 respectively. The resulting 1, 1 and 5 removed data edges have
no backing steps or handlers. Only exact changed JSON pointers and before/after hashes are allowed; array
reindexing accounts for much of the large allowance list. No wildcard or comparator rule is relaxed.

Area resources stay in their declared systems, and folding requires the same boundary. Misplaced duplicate
cards remain listed as resources on their recorded users. Every previously displayed authored diagram is
retained. Choose additionally shows Assortment because its saved diagram explicitly references six topics
placed there; Buy and Orders diagrams that were hidden by the previous folding now resolve. No landscape data
is edited. The plan for the unified price breakdown loses an incidental admin service and database from its
scope once the unsupported ownership path is removed; its operations, reasoning and outline are unchanged.
The baseline's old admin-service detail URL consequently reports no matching thing in that plan, while the
workspace's service and its facts remain intact. Exact route output changes are recorded.

Repeated captures have 190 byte-identical files; the only variation is the existing exact 43-byte Acme Flight-wrapper allowance. No new transport exception is added. The final consumer and ID/URL inventories remain conservative. No consumer or explorer capability is declared
retired on the strength of this slice. All 20 explorer parity rows remain unproven.

## Verification

All required local checks pass: 4,249 tests; production build; 599 pages within the 1,024 KB limit (maximum 1,021 KB); three comparisons with zero unexplained differences; and the unchanged mutation gate. Final command logs, mutation report, comparison captures, baseline integrity and fixture proof are committed
under `verification/pr4/`. Checks and source pins are listed in `verification.json`.

The first mutation run scored 73.38%, below the unchanged 75% floor. Additional tests exercised real containment,
complete map output, optional legacy representations and evidence boundaries. The next run passed at 75.36%.
The final run passes at 76.16% across all 26 touched pure files and includes the area-diagram and flow-work regressions. No threshold or whole-file scope was
reduced. The failed report and completed reports are retained as evidence.

## Next: PR 5

Start a fresh worktree from the merged main. Read the agreed node-canvas mockup and the relevant installed
Next.js guides. Build the entry-flow route from the canonical fixture, with a real overlay comparison, both
themes and explicit budget seeds. Existing legacy readers and explorer producers stay available until their
separate migration and parity proofs. Volvo remains read-only until PR 7. Human acceptance of PR 7 review rows
and the pre-PR 9 cache decision remain outstanding.
