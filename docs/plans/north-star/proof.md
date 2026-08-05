# Part 4: The Proof

The battery is the shipped set of checks behind one `verify` command.

## Probes by topology

The capability manifest declares a topology profile: server, desktop, CLI, or mobile. Each profile names its universal probes. Server: compose boot, HTTP health, round trip, migration apply. Desktop: launch-to-window, relaunch-after-crash, UI-driver smoke. CLI: install, run, exit codes and output. Mobile: build, boot in the simulator, one smoke flow. A capability with no runnable probe on its platform gets a fail-closed placeholder, never silence.

## Integrity over the checker's lifetime

- Universal checks run from the installed package, never the working tree. `verify` confirms the package hash against the lockfile.
- Project probes run at their sealed git revision. A probe diff re-opens the seal and re-runs the adversary. Probe *intent* is sealed at intent. Probe *code* is sealed at first green, because a probe cannot be deletion-tested before its capability exists.
- Deletion tests apply to probes and ratchet linters, not just product tests.

## Proofs are authored, not just checked

The review that catches a bad test is the last line of defense. These rules act earlier, where the test is born — they exist because the mining's dominant defect class was suites that stayed green while behavior was wrong, and every one of those suites was authored, reviewed as prose, and trusted before it failed to see its bug.

- **Every slice carries a proof plan**, written at decomposition, before any implementation: the cases that prove the capability, the fixture axes that must vary, and what runs real versus faked. Tests implement the plan, and the adversary reviews the tests against the plan — not against the implementation's own claims. On the complex lane the human walks and seals the proof plan alongside the design, because test design is design: deciding what would prove the work deserves the same human attention as the work, where complexity justifies it. On the standard lane the proof cases ride in the intent paragraph. Patches rely on the battery alone.
- **The oracle is independent at authoring, not just at review.** The green-but-wrong bugs happened because one context wrote both the code and the tests that judged it, and seeded the fixtures with the one shape its own logic handled. The proof plan is authored before and apart from the implementation, so the tests encode the design's intent rather than the implementation's assumptions.
- **Fixture diversity is stated, not hoped for.** A suite that seeds only the happy shape proves the happy shape. The plan names the risky axes the fixtures must cover; property-based tests where the stack supports them.
- **A checker exercises its consumer's real code path.** Staycurrent's gate passed content that the site's own loader then rejected — twice — because the gate reimplemented the loader's rules in parallel, and parallel implementations drift. The fix (the gate now imports the loader's schema path) becomes the rule: a checker imports the real parser, schema, or loader it guards. A hand-rolled second definition of "valid" is itself a defect.
- **Execution is evidenced, never inferred.** Test suites have shipped compiling-but-never-run; a build reported success while a hand-edited project file silently dropped the tests from the target; CI ran one of three suites for weeks. So the battery records run evidence: which suites ran, how many tests executed, and that every test a slice adds appears by name in the run log. A run that executes zero tests is red. Suites are discovered by pattern, never enumerated by hand, and the battery reconciles discovered against ran.

## The adversary

Fresh-context review with zero shared context with the author, at two altitudes doing two different jobs.

- **Per slice**: blind correctness review of the diff.
- **Per milestone sum**: the honesty audit plus edge-case judgment over the assembled diff. The audit carries the six-tell catalog of ways agents fake done: three it judges — a stub standing in where the proof named the real dependency, fixtures nothing real ever produces, tests that assert against a test-only copy of the logic — and three the scans below catch mechanically: proofs quietly hollowed (honesty scan), controls built but never wired (wiring scan), raw style literals (token scan).

The split is evidence-based. Auditing honesty per slice was measured and it rubber-stamped, so it moved to the milestone sum. Per-slice correctness review was never observed to rubber-stamp, so it stays per slice. The measurements are in [evidence.md](evidence.md).

## The human's instruments

- **The drive artifact.** The acceptance seal requires evidence that you actually drove the product — recorded after the work's last commit, so it cannot be a stale run. `verify` refuses the seal without it. Without this, acceptance could decay into clicking a button on a page; with it, accepting means you ran the thing. The strongest evidence for keeping it: the owner driving the real app found live bugs no agent review had caught ([evidence.md](evidence.md)).
- **The waiver.** A sealed, dated override for a wrong check, rendered loudly on the Map. Wrong checks happen. Without a legitimate exit, the only escape is tampering. And a check that keeps needing waivers is itself the defect: repeated waivers of the same check flag it for repair or deletion — magpie overrode the same six false-red gate checks every bet for weeks because nothing counted the overrides.

## Also in the battery

The three scans and the deletion test:

- **Honesty scan** — tests that assert nothing, assertions commented out or skipped, proofs quietly redefined down to what a stub can pass.
- **Wiring scan** — controls built but never wired: empty or TODO-only handlers, functions no caller reaches.
- **Token scan** — raw color, font, and spacing literals that bypass the design tokens.
- **The deletion test** (`mutate`) — remove or damage the implementation; the tests must go red. A suite the deletion test cannot make fail proves nothing.

Visual rows: render smoke, a11y, token conformance, plus the affordance-floor checklist for UI review — the minimum interactions every shipped surface must support (reachable controls, sane hit targets, selection, a way back).

The one-page worker contract: hand off changes unstaged for the driver to inspect, return a parseable report, escalate blocking concerns instead of guessing, and never satisfy with a mock anything the sealed proof names as real. Dispatch tiers follow the core context principle: frontier drives and reviews, execution workers build, tier explicit on every dispatch.
