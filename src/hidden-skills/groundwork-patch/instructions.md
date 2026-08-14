---
name: groundwork-patch
description: >
  Delivers a bounded code change that does not warrant a bet — a bug fix, a copy
  tweak, a single small enhancement with one user-facing goal. Tests the change,
  applies the Living Documents pass, and lands each patch as a single commit
  stamped `Lane: patch` / `Area:` so bet discovery mines clusters from git
  history — accumulating patches in one area surface as a bet signal instead of
  silent scope creep.
---

# groundwork-patch

You are delivering a patch — one bounded code change with a single user-facing goal. The bet lifecycle exists because design-heavy work fails without locked contracts and pre-agreed proof; forcing a typo fix through five phases teaches users to bypass the framework entirely. The patch lane is the pressure valve: small work moves at small-work speed, while git keeps it honest — every patch lands as one stamped commit, and patches that cluster in one area surface from that history as the signal that the area deserves a bet.

Apply the `groundwork-writer` skill when producing any artifact this lane commits. The shared operating contract at `.groundwork/skills/operating-contract.md` (contract v1) governs this skill in Maintenance mode: Protocols 1, 2, and 4 apply; Protocols 8 and 9 apply when a patch's Living Documents pass mutates a canonical doc through a reversal.

---

## Scope test — run this first

A patch has **one user-facing goal** and touches no API contract or schema — this is patch's own membership test; the fuller sizing rule, including whether the change touches anything a queued bet depends on, is decided once at the orchestrator's Work Intake triage. Before accepting the work, check each:

- The ask names a correction or small refinement to existing behaviour — not a new capability.
- No endpoint, message channel, or table shape changes. A contract change needs a signing gate the patch lane does not have — but it is not automatically a full bet: a small, **local, non-structural** delta (one additive endpoint or field) is a **quick bet**, and a structural or cross-service contract change is a full **bet**.
- Git history does not already show two or more patch commits in the same area. This is a cheap gate before an expensive lookup — run them in that order. **Count first, don't read:** one `git log --grep='Lane: patch' --format='%(trailers:key=Area,valueonly)'` (since the most recent archived bet under `docs/bets/_archive/`), tallied by `Area:`, decides the question with no per-commit `git show`. Only when a single area already holds two — this would be the third, a bet pitch wearing disguises — is the read worth paying for: open those specific commits to characterize the cluster, then tell the user in the product's terms that this is the third small fix in the same area and that the repetition is the signal the area deserves designed work, and route them to `groundwork-bet` with those SHAs as discovery input. An area under the threshold gets no patch archaeology at all — and the same discipline governs an override: don't read the cluster to argue "these are coherent, proceed as a patch" until the count has actually tripped.

When the ask fails the test, explain in plain terms which boundary it crossed — a new capability, a contract change, a repeat pattern in one area — and hand off to the orchestrator, which sizes it into the right lane: a **quick bet** for one small new capability or a local contract delta, a full **bet** for anything larger. The user can override — record the override in the patch commit (an `Override: <reason>` trailer) so the retrospective sees it.

## Provisional mode (before setup completes)

The orchestrator routes patch-scope work here before the canonical doc set exists, so a new install's first bug fix ships in its first session instead of queueing behind setup. The lane runs unchanged except where a step reads what setup has not yet produced:

- **Orient from code, not canon.** Run `npx groundwork-method repo-map` for impact when no map exists yet; treat absent canonical docs as absent, never as missing context to reconstruct.
- **The Living Documents pass becomes a debt note.** With no canonical doc to update, record what this patch changed that setup will need to capture — one bullet under the matching header in `.groundwork/cache/discovery-notes.md` (Protocol 1) — so the extract phases absorb it instead of re-discovering it.
- **The commit is stamped identically.** `Lane: patch` / `Area:` trailers as in step 6 — the cluster gate and bet discovery must see provisional patches too, and the cluster count carries over when setup completes.

The scope test, the test-with-the-change, honest green, and the blind review bind unchanged — provisional mode changes what the lane reads, never what it proves.

## Delivering the patch

Before touching code, write the active-lane sentinel — `printf '%s\n' 'patch' > .groundwork/cache/active-lane` — so the capture reminder hook stays silent while this lane drives the edit; clear it in the final step.

1. **Read before changing.** Read every file the patch touches in full — what it does today, what the patch changes, what must keep working. Scan recent git history for the conventions in play.
2. **Test the change.** Extend the nearest permanent test population — a unit test beside the logic, a system test when the behaviour is user-observable. The test is written with the change, red-then-green where the fix is behaviour-shaped. A patch with no test is a regression waiting for a bet to find it.
3. **Run the relevant suite** (`./dev test`, or the touched service's tests) and confirm green, including the tests that existed before the patch.
4. **Honest green, and a blind review for behaviour-shaped patches.** Even a patch earns the cheap half of delivery's rigor. First confirm **honest green** — the change satisfies its test for the right reason against the real code, not a hardcoded return, a test-only branch, or a fixture standing in for real work. (This is delivery's honest-green *behaviour* check; its prose-integrity half has no patch analog — a patch has no approved decomposition to reconcile against — so that half is omitted.) Then, when the patch is **behaviour-shaped** (it got a red-then-green test in step 2, not a pure copy or string tweak), dispatch the **blind-reviewer** lens (`.groundwork/skills/groundwork-bet/briefs/blind-reviewer.md`) as an isolated subagent over the diff (Protocol 9 mechanics, at the `frontier` tier, model set explicitly, never inherited — a review lens is the gate; Model Tiers, operating contract) — it reads only the diff and catches the correctness bug familiarity hides. Triage its findings: fix an unambiguous bug before logging, drop noise. A pure copy or string tweak skips this — mandating a subagent on every typo fix would re-ceremonialize the lane this exists to keep light. If the host has no subagent mechanism, run the blind read inline and say so.
5. **Apply the Living Documents pass** (Protocol 2). Most patches change nothing canonical; when one does — an infrastructure port, a documented behaviour — update the doc surgically. A reversal routes through the Reversal Protocol unchanged.
6. **Commit the patch.** Land the change as a single Conventional Commit carrying two trailers — `Lane: patch` and `Area: <service-or-surface>` — plus `Override: <reason>` when the user overrode the lane sizing. The commit *is* the log: its subject is the description, `git show --name-only` the files touched, the commit date the date, and the test rides in the same commit. Bet discovery and the retrospective's pattern mining read these from git history (`git log --grep='Lane: patch'`, grouped by `Area:`) — an unstamped patch is invisible scope creep.
7. **Report** what changed, the test that proves it, any doc updated, and the commit that landed it, opening with one line of program orientation (operating contract's checkpoint snapshot, proportionate to a patch: not the full snapshot, just where this patch sits relative to the bets in flight) — then remove the sentinel (`rm -f .groundwork/cache/active-lane`) so the capture hook resumes guarding direct edits.

## What this lane never does

Accumulate. The moment a "patch" grows a second goal, sprouts a contract change, or reveals that the area needs design, stop and route to the orchestrator with what you learned — a small new capability or a local contract delta is a quick bet, a larger change a full bet. An abandoned patch never lands a patch commit; carry what you learned about why it grew straight into the next lane's pitch via the orchestrator handoff — that context seeds the next lane's discovery.
