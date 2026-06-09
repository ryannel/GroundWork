# Phase 5: Validation (Testing & Handoff)

**Goal:** Verify the implementation, archive the bet-progress suite, fold what the bet learned back into the upstream documents, and seed the next bet with any signals that surfaced during delivery.

A bet that ships without updating upstream docs leaves the next bet operating against a stale map. The Validation phase exists to close the loop — the test suite proves the implementation works, the Living Documents scan proves the rest of the system still describes reality.

## Operating Contract

This workflow operates under the protocols defined in `.agents/groundwork/skills/operating-contract.md` (Continuous Bet mode: Protocols 1, 2, and 4 apply). This phase is the back-feed mechanism for the entire GroundWork lifecycle — Living Documents and Discovery Notes updates here are what keep the upstream `docs/` artifacts useful for every bet that follows.

## Instructions

### Step 1: Mark validation status

Update `docs/bets/<bet-slug>/pitch.md` frontmatter to `status: validation`.

### Step 2: Run the test suite

Execute the full bet-progress test suite: `./dev test bet <bet-slug>` (or `pytest tests/bets/<bet-slug>/` directly). Every test must pass before advancing.

**Contract verification:** Confirm that no manual schema definitions or rogue HTTP calls were introduced during Delivery — implementation must stay within the contracts established in the Design phase. A bet that delivered against side-channel contracts has compromised the architecture's integrity; flag it and revert.

### Step 3: Archive the bet-progress suite

Move `tests/bets/<bet-slug>/` → `tests/bets/_archive/<bet-slug>/`. Run `./dev archive bet <bet-slug>` if the CLI is available; otherwise `git mv tests/bets/<bet-slug> tests/bets/_archive/<bet-slug>`.

The permanent best-practice tests rolled out during Delivery (in service repos and `tests/system/`) remain in place — they are the ongoing coverage for this feature going forward. The bet-progress suite served its purpose as proof-of-work scaffolding and is now archived.

### Step 4: Review with the user

Summarise what was delivered. Walk through the user-facing changes, the new contracts, and any constraints the implementation revealed. Capture the user's reactions — corrections, requests for follow-up bets, or observations about what surprised them all belong in the next step's scan.

### Step 5: Apply the Living Documents protocol

The architecture of the system has changed. Every upstream document that describes the changed surface must be updated to match — surgically, in place, without asking permission. This is the single most important step of the phase, and the one most likely to be skipped under deadline pressure.

For each `docs/` artifact, scan the bet conversation and the delivered code for what now contradicts the document. Apply targeted updates. Report what changed.

Documents to scan, in order:

1. **`docs/architecture.md`** — new services, new boundaries, refined data flows, new technology choices, new service-level requirements. The Service-Level Requirements table is the most common update target.
2. **`docs/design-system.md`** — new design patterns, new component variants, new interaction states, refined accessibility commitments. Update only when the bet introduced something the design system did not anticipate.
3. **`docs/product-brief.md`** — new user types, refined success criteria, capabilities that turned out to be load-bearing in ways the brief did not capture. Vision-level refinements only; the brief is not a changelog.
4. **`docs/infrastructure.md`** — new services in the local topology, new ports, new health endpoints, new commands. The infrastructure document must continue to describe a system that actually runs.
5. **`docs/maturity.md`** — the maturity roadmap. Mark every row this bet closed as `closed (<bet-slug>)`, re-assess the dimensions the bet touched (a bet that added a service's OpenAPI contract may move D2 from 🟡 to ✅ — cite the new evidence), open new rows for gaps the bet revealed or introduced (a new service shipped without a contract is a new `standard-divergence` row), and append one line to `## History`. Re-stamp `last_reviewed`.

For each document updated, report the change in one line: "Updated `docs/architecture.md` — added `notification-service` to service map and SLR row for at-least-once delivery."

**Distinguish refinements from reversals (Protocol 2).** Most bet updates are refinements — new rows, new boundaries, additive detail. But if the bet *overturned* a prior Key Decision or Binding Constraint, or you are about to write a superseding ADR in Step 7, that update is a **reversal**, and the Reversal Protocol applies even in Continuous Bet mode (Protocols 1, 2, 4 apply to the bet). For each reversal: reconcile the *full body* of the affected doc and every dependent doc it touches, write the superseding ADR (Step 7), and **re-invoke `groundwork-review` on each mutated doc** until `PRESENT`, capping at 3 REVISE passes. Because the reversal supersedes an ADR, also re-review **every** `docs/domain/*.md` unconditionally (`document_type: domain-entity`) — their `Owner:`/fields go stale silently since they carry no summary to flag the drift, and they are the dependents most often missed. A bet that mutates four setup docs is exactly where contradictory canonical docs creep in — the re-gate is the guard.

If a scan finds nothing to update, say so explicitly. Silence is ambiguous — the user cannot tell whether you scanned and found nothing or skipped the scan.

### Step 6: Update discovery notes

Scan the bet conversation for signals that belong to a future bet — sequencing instincts ("we should do notifications next"), parking-lot ideas ("the search experience needs its own bet"), constraints the user surfaced about subsequent work. Append these as bullets under `## Bets` in `.groundwork/cache/discovery-notes.md` so the next bet's Discovery phase finds them.

Remove any discovery-notes entries that were incorporated into the artifacts updated in Step 5. A signal that has been promoted into a permanent document does not belong in the parking lot.

### Step 7: Write ADRs for significant decisions

Review the technical decisions made during this bet. If any decision was significant enough to warrant a permanent record — a stance future bets should not relitigate without a new ADR — write an ADR to `docs/decisions/NNNN-<slug>.md` using the template at `.agents/groundwork/skills/templates/adr.md`.

Significance test: would a new engineer joining the project six months from now need to know this decision to avoid revisiting it? If yes, record it. If no, skip. Not every bet produces an ADR.

Number sequentially: read the existing `docs/decisions/` directory and use the next available integer (zero-padded to four digits). Create the `docs/decisions/` directory if it does not exist.

### Step 8: Mark the bet delivered

Update `docs/bets/<bet-slug>/pitch.md` frontmatter to `status: delivered`.

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

Discovery notes:

- Removed two `## Design Details` entries that were incorporated into the
  notification service's contract.
- Appended one `## Bets` entry: "Search experience parked — the user
  raised it three times during this bet, and the architecture's search
  capability is currently unmapped. Next bet candidate."

Bet status: delivered.
```

The shallow version tells the user nothing. The deep version proves the scan happened, names what changed and why, and surfaces the discovery-note delta so the next bet starts with a clear inheritance.

The same standard applies across all four scan targets:
- **Architecture updates** must name the section, the change, and the reasoning — not just "added a service."
- **Design System updates** must name the component or pattern that changed and whether existing patterns are affected.
- **Brief updates** must justify the vision-level change against what the user actually said during delivery.
- **Infrastructure updates** must include the concrete observable changes — ports, commands, health endpoints — not a summary.

## Congratulations

Once Steps 1 through 9 are complete and the user has seen the handoff summary, congratulate them on a successful bet. The cycle returns to the orchestrator for the next bet or anytime skill.
