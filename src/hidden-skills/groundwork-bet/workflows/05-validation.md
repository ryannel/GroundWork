# Phase 5: Validation (Testing & Handoff)

**Goal:** Verify the implementation, archive the bet-progress suite, fold what the bet learned back into the upstream documents, and seed the next bet with any signals that surfaced during delivery.

A bet that ships without updating upstream docs leaves the next bet operating against a stale map. The Validation phase exists to close the loop — the test suite proves the implementation works, the Living Documents scan proves the rest of the system still describes reality.

## Operating Contract

This workflow operates under the protocols defined in `.agents/groundwork/skills/operating-contract.md` (contract v1; Continuous Bet mode: Protocols 1, 2, 4, 8, and 9 apply). This phase is the back-feed mechanism for the entire GroundWork lifecycle — Living Documents and Discovery Notes updates here are what keep the upstream `docs/` artifacts useful for every bet that follows.

## Instructions

### Step 1: Mark validation status

Update `docs/bets/<bet-slug>/pitch.md` frontmatter to `status: validation`.

### Step 2: Run the test suite

Execute the full bet-progress test suite: `./dev test bet <bet-slug>` (or `pytest tests/bets/<bet-slug>/` directly). Every test must pass before advancing — and the manifest verification must pass with it: a suite that drifted from `.groundwork/bets/<bet-slug>/test-manifest.json` without a recorded amendment is not the suite the user signed.

**Contract verification:** Confirm that no manual schema definitions or rogue HTTP calls were introduced during Delivery — cross-service calls use clients derived from `docs/bets/<bet-slug>/contracts/`, and no endpoint, field, or table exists that the specs do not define. A bet that delivered against side-channel contracts has compromised the architecture's integrity; flag it and revert.

### Step 2.5: Promote the contract specs

The bet's spec files were the design commitment; now that the implementation satisfies them, they become the canonical record of each service's API. For each service this bet touched, merge the relevant operations from `docs/bets/<bet-slug>/contracts/openapi.yaml` into `docs/api/<service>/openapi.yaml` (creating it for a new service), and likewise `asyncapi.yaml` where the bet defined channels. The canonical per-service spec is what the generated contract-conformance tests and `groundwork-check` read — a bet whose spec never promotes leaves the canonical record describing the system before this bet existed.

### Step 2.7: Record the bet in the capability ledger

Skip this step entirely when the project has no `docs/surfaces.md` — a project without a registry has a single implicit surface and no ledger to maintain.

The capability ledger (in `docs/surfaces.md`) is where surface divergence becomes a recorded decision instead of silent drift, and validation is the one writer that appends capability rows. For each capability this bet delivered — user-meaningful, typically 1–3 per bet, coarse enough to stay readable, never per-endpoint — write its ledger row:

- **Row key:** `<bet-slug>/<capability-slug>` — stable, greppable, collision-free.
- **Every surface column filled** with exactly one state and its payload: `delivered` (this bet's slug), `planned` (a bet ref or discovery-notes pointer), `omitted` (one-line rationale), or `n/a` (no payload). The pitch's `surfaces:` scope and surface no-gos are the source: in-scope surfaces whose surface milestones went green are `delivered`; deferred no-gos and deferred surface milestones are `planned`; omitted no-gos are `omitted`, carrying the pitch's rationale; structurally meaningless columns are `n/a`. A retired surface's column fills `n/a` automatically.
- **Cross-post every `planned` cell** as a bullet under `## Bets` in `.groundwork/cache/discovery-notes.md`, naming the capability key and the target surface — the next bet's Discovery reads that section, so the deferral becomes backlog instead of memory.
- **Update `.groundwork/surfaces.json` in the same change:** append the capability entries with the same keys, states, and payloads. The prose ledger and its machine twin are projections of the same decisions; they never drift.

**The gate:** a bet cannot reach `delivered` status with an empty ledger cell. An unfilled column is an undecided divergence — decide it with the user (`planned`, `omitted`, or `n/a`) before Step 8.

**Shallow ledger update (insufficient):**

```markdown
| `notifications/status` | delivered | planned | planned |
```

States without payloads, `planned` cells pointing nowhere, nothing cross-posted to discovery notes, the JSON twin untouched — a deferral recorded where no future bet will find it is silent drift wearing a ledger row.

**Deep ledger update (required standard):**

```markdown
| Capability | web-app | admin-cli | mcp-server |
|---|---|---|---|
| `notification-delivery/in-app-status` | delivered (`notification-delivery`) | planned (discovery-notes — operators asked for failure visibility during the Step 4 review) | omitted — agents query operation status directly via the contract; a push feed duplicates it |
```

Plus, in the same change: the `planned` cell cross-posted under `## Bets` in discovery notes ("`notification-delivery/in-app-status` → `admin-cli`: operators need failure visibility; deferred from `notification-delivery`"), and `.groundwork/surfaces.json` gaining the matching capability entry with identical states and payloads. Every column decided, every decision findable.

### Step 3: Archive the bet-progress suite

Move `tests/bets/<bet-slug>/` → `tests/bets/_archive/<bet-slug>/`. Run `./dev archive bet <bet-slug>` if the CLI is available; otherwise `git mv tests/bets/<bet-slug> tests/bets/_archive/<bet-slug>`.

The permanent best-practice tests rolled out during Delivery (in service repos and `tests/system/`) remain in place — they are the ongoing coverage for this feature going forward. The bet-progress suite served its purpose as proof-of-work scaffolding and is now archived.

### Step 4: Review with the user

Summarise what was delivered. Walk through the user-facing changes, the new contracts, and any constraints the implementation revealed. Capture the user's reactions — corrections, requests for follow-up bets, or observations about what surprised them all belong in the next step's scan.

### Step 5: Apply the Living Documents protocol

The architecture of the system has changed. Every upstream document that describes the changed surface must be updated to match — surgically, in place, without asking permission. This is the single most important step of the phase, and the one most likely to be skipped under deadline pressure.

For each `docs/` artifact, scan the bet conversation and the delivered code for what now contradicts the document. Apply targeted updates. Report what changed. When the update to `docs/architecture.md` is structural — a new boundary, a changed data flow, a new service-level requirement — adopt the architect persona (`.agents/groundwork/skills/groundwork-architect/SKILL.md`) so the refinement carries the same reasoning standard the document was built to.

Documents to scan, in order:

1. **`docs/architecture.md`** — new services, new boundaries, refined data flows, new technology choices, new service-level requirements. The Service-Level Requirements table is the most common update target.
2. **`docs/design-system.md`** — new design patterns, new component variants, new interaction states, refined accessibility commitments. Update only when the bet introduced something the design system did not anticipate.
3. **`docs/product-brief.md`** — new user types, refined success criteria, capabilities that turned out to be load-bearing in ways the brief did not capture. Vision-level refinements only; the brief is not a changelog. When the refinement is a vision-level product change — a new user type, a reframed success criterion, a capability that shifted the product's scope — adopt the product persona (`.agents/groundwork/skills/groundwork-product/SKILL.md`) so the update carries the same reasoning standard the brief was built to.
4. **`docs/infrastructure.md`** — new services in the local topology, new ports, new health endpoints, new commands. The infrastructure document must continue to describe a system that actually runs.
5. **`docs/surfaces.md`** — when it exists: registry entries whose reality changed (a `planned` surface this bet activated, a changed core-access path or test medium), and confirm Step 2.7's ledger rows landed with their `.groundwork/surfaces.json` twin in lockstep. Skip when the project has no registry.
6. **`docs/maturity.md`** — the maturity roadmap. Mark every row this bet closed as `closed (<bet-slug>)`, re-assess the dimensions the bet touched (a bet that added a service's OpenAPI contract may move D2 from 🟡 to ✅ — cite the new evidence), open new rows for gaps the bet revealed or introduced (a new service shipped without a contract is a new `standard-divergence` row), and append one line to `## History`. Re-stamp `last_reviewed`. On a registry project, re-assess D8 (surface parity discipline) against the ledger state Step 2.7 just wrote — a `planned` cell aging past three closed bets with no referencing pitch is what moves it off ✅. If this bet activated a second independently-deployed surface or changed a published contract, re-assess D9 (contract compatibility): the stance must stand under architecture's Binding Constraints and the contract-conformance tests must show no breaking drift.

For each document updated, report the change in one line: "Updated `docs/architecture.md` — added `notification-service` to service map and SLR row for at-least-once delivery."

**Distinguish refinements from reversals (Protocol 2).** Most bet updates are refinements — new rows, new boundaries, additive detail. But if the bet *overturned* a prior Key Decision or Binding Constraint, or you are about to write a superseding ADR in Step 7, that update is a **reversal**, and the Reversal Protocol applies even in Continuous Bet mode (Protocols 1, 2, 4, 8, and 9 apply to the bet). For each reversal: reconcile the *full body* of the affected doc and every dependent doc it touches, write the superseding ADR (Step 7), and **re-invoke `groundwork-review` on each mutated doc** (Protocol 9), with the matching `document_type`. The re-gate is fail-closed and the revise cap applies (Protocol 8): proceed only on a parseable `VERDICT: PRESENT` per doc. Because the reversal supersedes an ADR, also re-review **every** `docs/domain/*.md` unconditionally (`document_type: domain-entity`) — their `Owner:`/fields go stale silently since they carry no summary to flag the drift, and they are the dependents most often missed. A bet that mutates four setup docs is exactly where contradictory canonical docs creep in — the re-gate is the guard.

If a scan finds nothing to update, say so explicitly. Silence is ambiguous — the user cannot tell whether you scanned and found nothing or skipped the scan.

### Step 6: Update discovery notes

Scan the bet conversation for signals that belong to a future bet — sequencing instincts ("we should do notifications next"), parking-lot ideas ("the search experience needs its own bet"), constraints the user surfaced about subsequent work. Append these as bullets under `## Bets` in `.groundwork/cache/discovery-notes.md` so the next bet's Discovery phase finds them.

Remove any discovery-notes entries that were incorporated into the artifacts updated in Step 5. A signal that has been promoted into a permanent document does not belong in the parking lot.

### Step 7: Write ADRs for significant decisions

Review the technical decisions made during this bet. If any decision was significant enough to warrant a permanent record — a stance future bets should not relitigate without a new ADR — write an ADR to `docs/decisions/NNNN-<slug>.md` using the template at `.agents/groundwork/skills/templates/adr.md`.

Significance test: would a new engineer joining the project six months from now need to know this decision to avoid revisiting it? If yes, record it. If no, skip. Not every bet produces an ADR.

Number sequentially: read the existing `docs/decisions/` directory and use the next available integer (zero-padded to four digits). Create the `docs/decisions/` directory if it does not exist.

### Step 7.5: Run the bet retrospective

A bet that ships without extracting its lessons leaves the next bet to rediscover them at delivery prices. The retrospective is one facilitated pass over four mechanics — checklist items in a single conversation, not a ceremony — and its output is `docs/bets/<bet-slug>/retrospective.md` plus action items the next bet reads.

1. **Mine the slice records.** Read every slice's `notes`, `files`, and review findings from `.groundwork/bets/<bet-slug>/decomposition.json` and any change proposals or amendments in the bet directory. Surface *patterns*, not anecdotes: a finding type that appeared in two or more slice reviews, a struggle that recurred, a contract that needed amending. One-off issues are noise; repeats are process signal.
2. **Audit the previous bet's action items.** Read the previous bet's `retrospective.md` (if one exists). For each action item: done, in progress, or ignored — and if ignored, did it cost us this bet? An item that was ignored *and* costly escalates to a `docs/maturity.md` row so it stops depending on anyone's memory.
3. **Detect significant discoveries.** Check whether this bet invalidated anything queued bets depend on: an architectural assumption broken, a dependency the next pitch does not account for, debt that changes the appetite math, user behaviour different from what the brief assumed. On detection, recommend re-pitching the affected bets before the next one starts — never start a bet on premises this one just disproved. Whether a discovery overturns a queued bet's premise — changed user behaviour, shifted appetite math, or resequenced priorities — is a product judgement; adopt the product persona (`.agents/groundwork/skills/groundwork-product/SKILL.md`) when weighing a re-pitch.
4. **Explore readiness.** Green is not live. Confirm with the user where the delivered work actually stands — deployed, accepted, observed in use — and carry anything unresolved forward as an explicit item rather than an assumption.

Write `docs/bets/<bet-slug>/retrospective.md`: the patterns found, the follow-through audit results, any discovery alerts, the readiness state, and the action items — each with a stable ID (`<bet-slug>-R1`, `-R2`, …) so the next retrospective can audit them mechanically. Append the action items as bullets under `## Bets` in `.groundwork/cache/discovery-notes.md`, each carrying its ID — the next bet's Discovery phase already reads that section.

### Step 8: Mark the bet delivered

Update `docs/bets/<bet-slug>/pitch.md` frontmatter to `status: delivered`. On a registry project, Step 2.7's gate applies: do not write `delivered` while any ledger cell for this bet's capabilities is empty — fill the column or the bet does not close.

### Step 9: Hand off

Confirm the bet is complete. Summarise what was delivered, what was updated upstream, and what was parked for the next bet. Recommend a fresh context for the next bet — the rich delivery context has been compressed into doc updates and discovery notes, so the next bet does not need it.

## Quality Standard: What "Deep Enough" Looks Like

The handoff fails when the Living Documents scan is a checkbox instead of a surgical update. A handoff that says "no changes needed" without naming what was scanned is indistinguishable from a handoff that skipped the scan entirely. The standard is concrete: state what you read, name what changed, and quote the change.

**Shallow output (insufficient):**

```
Validation complete. Tests pass. Handing off to groundwork-update to refresh
the docs.
```

**Deep output (required standard):**

```
Validation complete.

Test suite: 47/47 passing. Contract verification: all cross-service calls
use the generated `notification_client`; no rogue HTTP found.

Bet-progress suite archived to tests/bets/_archive/notification-delivery/.

Living Documents scan:

- `docs/architecture.md` — added `notification-service` to the service map
  (Phase 3 — Service Design). Added two rows to the Service-Level
  Requirements table: at-least-once delivery for outbound notifications,
  idempotent webhook handler on the receiving side. Tech stack updated to
  reference NATS JetStream as the chosen async transport with the same
  reasoning attached to existing entries.
- `docs/design-system.md` — added `Toast` component variant for delivery-status
  notifications. Updated interaction states to include the dismissable
  state with focus-trap behaviour.
- `docs/product-brief.md` — no changes; the bet implemented capabilities
  already described.
- `docs/infrastructure.md` — added `notification-service` (port 4002,
  health endpoint `GET /health`) to the services table. Added NATS to
  the infrastructure components table (port 4222, container
  `<app>-nats`). Updated `./dev start` verification footnote to include
  notification flow.
- `docs/surfaces.md` — ledger row `notification-delivery/in-app-status`
  written: web-app delivered (`notification-delivery`), admin-cli planned
  (cross-posted to discovery notes), mcp-server omitted (agents query
  operation status via the contract). `.groundwork/surfaces.json` updated
  in the same change; no empty cells.

Discovery notes:

- Removed two `## Design Details` entries that were incorporated into the
  notification service's contract.
- Appended one `## Bets` entry: "Search experience parked — the user
  raised it three times during this bet, and the architecture's search
  capability is currently unmapped. Next bet candidate."

Bet status: delivered.
```

The shallow version tells the user nothing. The deep version proves the scan happened, names what changed and why, and surfaces the discovery-note delta so the next bet starts with a clear inheritance.

The same standard applies across every scan target:
- **Architecture updates** must name the section, the change, and the reasoning — not just "added a service."
- **Design System updates** must name the component or pattern that changed and whether existing patterns are affected.
- **Brief updates** must justify the vision-level change against what the user actually said during delivery.
- **Infrastructure updates** must include the concrete observable changes — ports, commands, health endpoints — not a summary.
- **Ledger updates** must carry every cell's state with its payload and name where each `planned` deferral was cross-posted — a state without its payload is a decision without its record.

## Congratulations

Once Steps 1 through 9 are complete and the user has seen the handoff summary, congratulate them on a successful bet. The cycle returns to the orchestrator for the next bet or anytime skill.
