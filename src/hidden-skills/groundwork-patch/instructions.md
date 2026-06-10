---
name: groundwork-patch
description: >
  Delivers a bounded code change that does not warrant a bet — a bug fix, a copy
  tweak, a single small enhancement with one user-facing goal. Tests the change,
  applies the Living Documents pass, and logs every patch to a ledger that bet
  discovery reads, so accumulating patches in one area surface as a bet signal
  instead of silent scope creep.
---

# groundwork-patch

You are delivering a patch — one bounded code change with a single user-facing goal. The bet lifecycle exists because design-heavy work fails without locked contracts and pre-agreed proof; forcing a typo fix through five phases teaches users to bypass the framework entirely. The patch lane is the pressure valve: small work moves at small-work speed, while the ledger keeps it honest — every patch is recorded, and patches that cluster in one area are the signal that the area deserves a bet.

Apply the `groundwork-writer` skill when producing any artifact this lane commits. The shared operating contract at `.agents/groundwork/skills/operating-contract.md` (contract v1) governs this skill in Maintenance mode: Protocols 1, 2, and 4 apply; Protocols 8 and 9 apply when a patch's Living Documents pass mutates a canonical doc through a reversal.

---

## Scope test — run this first

A patch has **one user-facing goal**, touches no API contract or schema, and changes nothing a queued bet depends on. Before accepting the work, check each:

- The ask names a correction or small refinement to existing behaviour — not a new capability.
- No endpoint, message channel, or table shape changes. A contract change is bet-scoped by definition: contracts are signed artifacts, and the patch lane has no signing gate.
- `docs/bets/patch-ledger.md` does not already show two or more patches in the same area. Three clustering patches are a bet pitch wearing disguises — say so, and route the user to `groundwork-bet` with the ledger entries as discovery input.

When the ask fails the test, explain which line it crossed and hand off to the orchestrator for bet discovery. The user can override — record the override in the ledger entry so the retrospective sees it.

## Delivering the patch

1. **Read before changing.** Read every file the patch touches in full — what it does today, what the patch changes, what must keep working. Scan recent git history for the conventions in play.
2. **Test the change.** Extend the nearest permanent test population — a unit test beside the logic, a system test when the behaviour is user-observable. The test is written with the change, red-then-green where the fix is behaviour-shaped. A patch with no test is a regression waiting for a bet to find it.
3. **Run the relevant suite** (`./dev test`, or the touched service's tests) and confirm green, including the tests that existed before the patch.
4. **Apply the Living Documents pass** (Protocol 2). Most patches change nothing canonical; when one does — an infrastructure port, a documented behaviour — update the doc surgically. A reversal routes through the Reversal Protocol unchanged.
5. **Log the patch.** Append one row to `docs/bets/patch-ledger.md` (create it with a one-line purpose header if absent): date, area (service or surface), one-line description, files touched, test added. The ledger is read by bet discovery and by the retrospective's pattern mining — an unlogged patch is invisible scope creep.
6. **Report**: what changed, the test that proves it, any doc updated, and the ledger entry.

## What this lane never does

Accumulate. The moment a "patch" grows a second goal, sprouts a contract change, or reveals that the area needs design, stop and route to the bet lifecycle with what you learned. The ledger entry for the abandoned patch records why it grew — that context seeds the bet's discovery.
