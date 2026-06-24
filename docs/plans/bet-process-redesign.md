# Execution Plan: Bet process redesign — prose-only bet, machine-readable artifacts built in code

> **Resumable spec.** Self-contained for a clean context. This is a methodology redesign of the
> GroundWork bet lifecycle — no code-behaviour change to ship, only `src/hidden-skills/**`, the dev CLI,
> the docs-site generator, and lifecycle docs.

## RESUME HERE — first actions in a fresh context

To resume after a context clear, the user says e.g. *"Resume the bet-process-redesign plan"*. Then:

0. **Read this whole file** (it is the single source of truth; the conversation that produced it is gone).
1. **`EnterWorktree`** a fresh worktree off `main` (HEAD must be `37e1584` or later — see environment below).
2. **Copy this plan into the repo**: `docs/plans/bet-process-redesign.md` (matches the existing
   `docs/plans/docs-quality-uplift.md` convention) and commit it, so the plan is version-controlled.
3. **Drop a memory pointer** (so future sessions find this): add a `project_bet_process_redesign.md` under
   `~/.claude/projects/-Users-ryannel-Workspace-groundWork/memory/` + one index line in `MEMORY.md`,
   summarizing the model (bet=prose, code=machine-readable; decomposition tree; drop JSON + bet contracts;
   archive on delivery) and pointing at the repo plan path. *(Not yet created — this plan was authored in
   plan mode, which cannot write memory.)*
4. **Work WS-A → WS-J in order**, running the gates after each cohesive chunk; ff-merge to local `main`;
   **do not push** unless asked.

## How to resume / environment

- **Repo:** `/Users/ryannel/Workspace/groundWork`. Work off current `main` (HEAD `37e1584`) in a **fresh
  git worktree** (`EnterWorktree`). Do NOT reuse the older `docs-test-review-prose` worktree — it predates
  the seal cut and would edit stale text.
- **Prior merged passes (context, already on `main`):** (1) test-review→prose + lean up-front suite +
  writer density (`60d1227`); (2) technical-design→4-file dir + pitch topology (`5420896`); (3) **seal
  cut** (`37e1584`): removed the `test-manifest.json` hash seal and `./dev bet sign`, replaced with an
  *approval commit* (SHA in `decomposition.json`) + a per-slice **test-integrity reconciliation** in
  04-delivery Step 4. **This plan partly rewrites that just-landed reconciliation** (see Integrity model).
- **Hidden skills ship raw** at scaffold time (no bundle for `src/hidden-skills/**`), but **the dev CLI is
  a generator** — after editing `src/generators/workspace-dev-cli/**`, **rebuild the dev bundle** (same as
  the seal-cut merge did).
- **Do not touch** `tests/fixtures/installs/pre-0.9*` or `0.9-pre-surfaces*` — frozen upgrade fixtures.
- **Gates (must stay green):** `python3 scripts/lint_skills.py`, `python3 scripts/check_sync_anchors.py`,
  `node scripts/generate_workflow_index.js --check`.
- **Commit/push:** commit on the worktree branch; ff-merge to local `main`; **do not push** unless asked.
  Trailer: `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.

## The design model (why)

Make the **bet pure prose design intent**, and move **every machine-readable artifact — tests AND
contracts — into the code, built at Delivery.** One uniform rule: **bet = prose; code = every
executable/machine-readable artifact.** This came from a long design dialogue; the settled model:

- **Decomposition = prose only.** High-level test cases per milestone/slice, reviewed and approved before
  execution. *The prose is the contract.* No test code, no JSON, no machine-readable specs in the bet.
- **Delivery start materializes the red board.** Generate the red bet-progress **stubs** (heavy-hitting
  milestone + slice proofs) from the approved prose. Running the suite is the live progress board ("see
  how far we've come" = red→green).
- **Contracts are code-first.** Drop the bet `docs/bets/<slug>/contracts/` intermediate. Specs were in 3
  places (bet prose, bet contracts, real contracts); collapse to 2: the **prose API/data design** (carries
  shapes at design fidelity) and the **real contract built in code** at Delivery (FastAPI/Huma already
  generate OpenAPI from code). The canonical `docs/api/<service>/openapi.yaml` is **captured from the
  running service**, not promoted from a bet spec.
- **Drop the tracking JSON.** `decomposition.json` removed (`test-manifest.json` already gone). The suite
  is the status; git is the record.
- **Decomposition is a browsable docsite tree.** One folder per milestone, one file per slice — so
  `/docs/bets/<slug>/decomposition` reads as prose, not a wall.
- **Archive the whole bet at delivery** so the active docsite Bets section shows only in-flight bets.

## Integrity model (the tricky part — replaces the seal-cut reconciliation)

The seal cut (just landed) assumed tests are written complete + sealed in Decomposition, so its Step-4
reconciliation flags **any test-file change during delivery**. This plan **inverts the baseline** because
tests + contracts are now built *during* delivery (the files are *supposed* to change):

- **Baseline = a git tag** `bet/<slug>/approved`, set on the commit that lands the approved prose bet
  (decomposition tree + technical-design). Replaces `approval_commit`-in-`decomposition.json`.
- **What's frozen = the prose** (the `decomposition/` tree + `technical-design/`). **Tamper check** at each
  slice review and at validation: `git diff bet/<slug>/approved.. -- docs/bets/<slug>/decomposition/<m>/<slice>.md`
  (and the milestone `index.md`) shows no change except an **approved amendment**. A prose-contract change
  during delivery without approval is the cheat signal.
- **What's free to change = the code** (`tests/bets/<slug>/` stubs filling in red→green; the service code +
  its generated contract). NOT the tamper target.
- **Honest verification** stays from the seal cut: the per-slice **honest-green** check + **acceptance
  auditor** verify the built test honestly proves the approved prose case AND the built contract matches the
  prose API design (no hardcoded-to-fixture, no undeclared endpoints/fields).
- **Amendment Protocol:** to change an approved prose test/contract, get user approval, edit the slice's
  prose, commit (re-tag or record the amended commit), then change the code. The amendment commit is the
  trail the reconciliation reads.

## End-state bet folder structure

```
docs/bets/<slug>/                       (active; → docs/bets/_archive/<slug>/ at delivery)
├── pitch.md                            + topology graph (filled during design, Step 2.1)
├── technical-design/
│   ├── 01-ui-design.md                 ASCII wireframes · states · interactions · micro-polish
│   ├── 02-data-flows.md                mermaid: business logic · routing · API-to-API
│   ├── 03-api-design.md                interfaces — purpose · SHAPES (req/resp/fields) · errors · rationale
│   └── 04-data-design.md               stores · key fields · lifecycle · SHAPES · rationale
├── decomposition/                      browsable prose contract tree
│   ├── meta.json
│   └── NN-<milestone-slug>/
│       ├── index.md                    goal · sequencing · acceptance · proof-of-work test · slice links
│       └── NN-<slice-slug>.md          Scope · Design (+data-flow refs) · Proof of work (prose test case)
├── change-proposal-<n>.md              (only on mid-delivery design contradiction)
└── retrospective.md                    (Validation)

tests/bets/<slug>/                      CODE — red→green stubs generated at Delivery start; flat naming; the board
docs/api/<service>/openapi.yaml         CANONICAL real contract — captured from running code at Delivery/Validation
```

Gone vs today: `test-review.md`, `decomposition.json`, monolithic `decomposition.md`,
`docs/bets/<slug>/contracts/`.

## Decisions locked (overridable by user)

1. **Approval baseline = git tag** `bet/<slug>/approved` (fileless; `.groundwork/bets/<slug>/` disappears).
2. **`./dev bet status` = run the suite**, render red/green per milestone/slice (derived, not stored).
3. **Flat test files** — `test_milestone_N_<slug>.<ext>` / `test_slice_N_<service>_<slug>.<ext>`.
4. **Archive whole bet at delivery** — `docs/bets/<slug>/`→`docs/bets/_archive/<slug>/` AND
   `tests/bets/<slug>/`→`tests/bets/_archive/<slug>/`; sidebar collapses `_archive`. Permanent
   best-practice tests remain.
5. **Contracts code-first** — no bet `contracts/`; prose carries shapes; real spec is code-generated;
   canonical `docs/api/<service>/` captured from running code. Conformance tests / clients / maturity-D2
   read `docs/api/` (unchanged; only its *source* changes).

## Workstreams (with file/line references found during exploration)

### WS-A — Decomposition as a browsable tree
- **Replace** `src/hidden-skills/groundwork-bet/templates/decomposition.md` with a template SET:
  - `templates/decomposition/meta.json` (sidebar order + "Decomposition" title)
  - `templates/decomposition/milestone-index.md` → renders to `<milestone>/index.md`: type · consumer ·
    demonstrable goal · sequencing rationale · acceptance criteria · **Proof of work** (milestone prose test:
    Proves / How we prove it / test file) · links to slices.
  - `templates/decomposition/slice.md` → renders to `<milestone>/<slice>.md`: header (owner · surface ·
    complexity · prerequisite) · **Scope** (vertical capability + Required Capabilities) · **Design**
    (references `technical-design/01-ui-design`/`03-api-design`/`04-data-design` + the data flow it
    implements in `02-data-flows.md`) · **Proof of work** (prose test case + named test file).
- **Rewrite** `workflows/03-decomposition.md` to author this tree as **prose only**. Today: line 1 title,
  line 5 (tests up front), Steps 3 & 5 (lines ~41–72 author test code — MOVE to delivery, WS-B), Step 6
  (lines ~103–105 write single decomposition.md → write the tree), Step 6.5 (line ~118 write JSON — DELETE,
  WS-D), Step 6.6 (line ~144 write test-review.md → write the slice files' Proof-of-work prose, WS-C),
  gate (line ~172), Transition (line ~306 approval commit → approval **tag**).

### WS-B — Prose-first; red stubs at Delivery start
- Add `workflows/04-delivery.md` **Step 0: materialize the red suite** — from the approved prose, generate
  one red stub per milestone + per slice (`./dev new milestone` / `./dev new slice` where available, else
  write directly). They are red (implementation absent); running them = the board.
- Reframe `templates/bet-progress-test.md` (today line 3 "written during Decomposition") → delivery-time
  guidance generated from the approved prose.
- `03` ends by approving + **tagging** (`git tag bet/<slug>/approved`).

### WS-C — Fold test-review into slice files
- **Delete** `templates/test-review.md` (today lines 3–5 describe a separate surface).
- The slice file's **Proof of work** section IS the prose proof. Repoint: `03` Step 6.6/gate; checklists
  `decomposition.md` (lines 119–121 "Test-review surface stale") and `implementation-readiness.md` (line 40)
  → "the slice file's Proof-of-work prose is missing/stale".

### WS-D — Drop the JSON; integrity on the prose contract
- Remove `03` Step 6.5 (decomposition.json) + the `approval_commit` field (line ~138).
- **Rewrite the integrity model** per the Integrity section above:
  - `04-delivery.md` top CRITICAL CONSTRAINT (line ~7), "stay within decomposition.md" (line 9 → the
    decomposition tree), "work through decomposition.md" (line 27), **Step 4 *Test integrity* bullet
    (line ~54)** — re-point from `git log approval_commit.. -- tests/bets/` to
    `git diff bet/<slug>/approved.. -- docs/bets/<slug>/decomposition/...` (prose, not test files);
    Amendment Protocol (lines ~95, 99).
  - `05-validation.md` reconciliation (line ~19) → diff the prose contract against the tag.
  - `implementation-readiness.md` line 36 ("Suite not approved/committed: decomposition.json has no
    approval_commit") → "approval tag `bet/<slug>/approved` is absent".

### WS-E — Dev CLI (`bet.ts`) — REBUILD BUNDLE after
- `src/generators/workspace-dev-cli/cli-src/src/commands/bet.ts`: rewrite `status()` (293–351) and
  `statusAll()` (353–386) to derive the board by running the bet suite and parsing `test_milestone_` /
  `test_slice_` names; delete the `Decomposition`/`Milestone`/`Slice` JSON interfaces (199–224),
  `decompositionPath()` (230–232), `progressOf()` (277–282) JSON reliance. Keep `newMilestone` (102–122) /
  `newSlice` (124–162) stub generators (now Delivery-time). Extend `archive()` (164–188) to also move
  `docs/bets/<slug>/` → `docs/bets/_archive/<slug>/`. `util/paths.ts` line 33 (`GROUNDWORK_BETS_DIR`) —
  remove if `.groundwork/bets/` fully unused.
- CLI stub templates `scripts/cli/templates/{milestone-test,slice-test}.pytmpl` — keep; they're invoked at delivery now.

### WS-F — Validation
- `05-validation.md`: (a) reconciliation once against the approval tag (line 19); (b) **re-source contract
  capture** — Step 2.5 (lines 23–25 "promote bet `contracts/` → docs/api/") becomes "snapshot each touched
  service's served OpenAPI (`/openapi.json`) into `docs/api/<service>/openapi.yaml`"; (c) contract
  verification (line 21) traces to `docs/api/` not bet `contracts/`; (d) archive `docs/bets/<slug>/` +
  `tests/bets/<slug>/` to `_archive/` (line 69 already archives tests — extend to docs).

### WS-G — Docsite sidebar
- Add `decomposition/meta.json` template (milestone order). Ensure generated `bets` sidebar collapses
  `_archive`: `src/generators/docs-site/generator.ts` `seedDocsMeta` (~377–411; `pages` array already
  positions `bets`). Add a `docs/bets/meta.json` (or nested) with `_archive` last + `defaultOpen:false`.
  Precedent: nested `docs/principles/stack/<lang>/` + `index.md` landing pages already render. Verify
  Fumadocs treatment of a `_archive`-named folder at build (hide vs collapse).

### WS-H — Review checklists
- `groundwork-review/checklists/technical-design.md`: the "API Design" section (lines ~52–83, esp. 58–60
  "Missing spec files", "Spec format", "Prose↔spec drift") → reframe: the prose API/data design must carry
  the **shapes** (a *vague-shape* check), not a missing-spec-file check; drop bet-`contracts/` references.
- `decomposition.md` checklist line 100 ("Shape not in spec") → "shape not in the prose design".
- `implementation-readiness.md` lines 29–31 ("Slice without a contract / Spec files missing / Contract
  orphan") → trace to the prose design + the canonical `docs/api/` the code produces.

### WS-I — Remove the bet `contracts/` flow
- `02-design.md`: **delete Step 2.2** (emit specs, lines ~88–100) + the prose↔spec invariant; the API/data
  design prose now carries shapes at design fidelity (the "Deep" quality example already shows inline
  req/resp shapes — keep that). Templates `technical-design/03-api-design.md` (line 5 "field shapes live in
  specs / reference the spec, don't restate") + `04-data-design.md` ("Schema spec: contracts/schema.sql") →
  the prose carries the shapes; drop the spec-deferral language.
- `03-decomposition.md` lines 58, 88, 169 ("tests derive shapes from contracts/") → from the prose design.
- `04-delivery.md` lines 9, 48, 61 ("satisfy/derive clients from bet contracts/") → implement code-first;
  derive cross-service clients from canonical `docs/api/<service>/`.
- `instructions.md` line 39 (Design output "+ contracts/ specs") → drop; `groundwork-mvp/instructions.md`
  line 191; `templates/{change-proposal,decomposition}.md`; `maturity-model.md` (line 36 D2 signal — docs/api
  populated code-first; line 75 test-manifest dating — drop).

### WS-J — Lifecycle docs + migration
- `docs/lifecycle/02-delivery-loop.md` (lines 13, 71, 77, 90) + `docs/lifecycle/index.md`.
- `.agents/skills/groundwork-contributor/SKILL.md` (any bet-artifact rows).
- New `migrations/gw-<name>.js` + `migrations/index.json` entry: on upgrade, note decomposition nesting,
  `decomposition.json` drop, and `contracts/` removal (mechanical cleanup where safe).

## Critical files

- `src/hidden-skills/groundwork-bet/workflows/{02-design,03-decomposition,04-delivery,05-validation}.md`
- `src/hidden-skills/groundwork-bet/templates/` — new `decomposition/` set; delete `test-review.md`;
  reframe `bet-progress-test.md`, `decomposition.md`, `technical-design/{03-api-design,04-data-design}.md`
- `src/hidden-skills/groundwork-bet/instructions.md`; `src/hidden-skills/groundwork-mvp/instructions.md`
- `src/hidden-skills/groundwork-review/checklists/{technical-design,decomposition,implementation-readiness}.md`
- `src/hidden-skills/maturity-model.md`
- `src/generators/workspace-dev-cli/cli-src/src/commands/bet.ts` (+ `util/paths.ts`) — rebuild bundle
- `src/generators/docs-site/generator.ts`
- `docs/lifecycle/02-delivery-loop.md` (+`index.md`); `migrations/`
- VERIFY UNCHANGED: `src/generators/system-test-runner/files/tests/system/test_contract_conformance.py.template`
  (reads `docs/api/` — survives); engineer-skills `references` that read `docs/api/`.

## Verification

1. Gates green: `lint_skills.py`, `check_sync_anchors.py`, `generate_workflow_index.js --check`.
2. Grep clean: no live refs to `decomposition.json`, `test-review.md`, `test-manifest.json`,
   `approval_commit`, or `docs/bets/<slug>/contracts/` outside frozen `pre-0.9`/`0.9-pre-surfaces`
   fixtures, CHANGELOG, migrations. `docs/api/` references intact.
3. CLI builds; `./dev bet status` renders a red/green board with no JSON present; dev bundle rebuilt.
4. Docsite build against a sample bet: `decomposition/` tree renders in order; `index.md` is the milestone
   landing page; a `_archive` bet collapses out of the active Bets nav; no `contracts/` page.
5. Conformance intact: contract-conformance template still reads `docs/api/`; 05 code-first capture
   populates it.
6. Coherence pass: read `02`→`03`→`04`→`05` end to end — prose design (shapes inline) → prose tests → tag
   → red stubs at delivery → code-first build (tests + contract) → suite-as-board → prose tamper check →
   capture canonical `docs/api/` → archive — no dangling reference to bet `contracts/`, the JSON, or the
   sealed-up-front model.

## Out of scope

- Regenerating magpie's own docs (separate later pass).
- Pushing to origin / version bump (fold into the next release act).

## Open / to confirm at execution

- Fumadocs handling of a `_archive` folder (hide entirely vs collapse) — decide at WS-G build.
- Whether canonical `docs/api/` capture happens incrementally in Delivery or once at Validation (default:
  Validation snapshot of served spec).
