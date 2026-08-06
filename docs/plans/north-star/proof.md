# Part 4: The Proof

The battery is the shipped set of checks behind one `verify` command.

## Probes by topology

The capability manifest declares a topology profile: server, desktop, CLI, or mobile. Each profile names its universal probes. Server: compose boot, HTTP health, round trip, migration apply. Desktop: launch-to-window, relaunch-after-crash, UI-driver smoke. CLI: install, run, exit codes and output. Mobile: build, boot in the simulator, one smoke flow. A capability with no runnable probe on its platform gets a fail-closed placeholder, never silence.

**A capability with a user interface is proven at that interface.** A recurring failure class in real use: the API works, the UI over it is broken — and every headless row is green while the user cannot use the feature. So every user-facing case in a proof plan is paired. One headless case at the API or unit level: fast, rock solid, the thing that makes failures cheap to find. And one UI-driver case that walks the same case through the real interface — clicking what the user clicks, asserting what the user sees on screen, never the API response underneath. The UI case is the headline: the board row for a user-facing proof shows the UI result, with the headless twin behind it. Green underneath a broken screen is not done, and the board cannot say it is.

## Integrity over the checker's lifetime

- Universal checks run from the installed package, never the working tree. `verify` confirms the package hash against the lockfile.
- Project probes run at their sealed git revision. A probe diff re-opens the seal and re-runs the adversary. Probe *intent* is sealed at intent. Probe *code* is sealed at first green, because a probe cannot be deletion-tested before its capability exists.
- Deletion tests apply to probes and ratchet linters, not just product tests.

## Proofs are authored, not just checked

The review that catches a bad test is the last line of defense. These rules act earlier, where the test is born — they exist because the mining's dominant defect class was suites that stayed green while behavior was wrong, and every one of those suites was authored, reviewed as prose, and trusted before it failed to see its bug.

- **Every slice carries a proof plan**, written at decomposition, before any implementation: the cases that prove the capability, the fixture axes that must vary, and what runs real versus faked. Tests implement the plan, and the adversary reviews the tests against the plan — not against the implementation's own claims. On the complex lane the human walks and seals the proof plan alongside the design, because test design is design: deciding what would prove the work deserves the same human attention as the work, where complexity justifies it. On the standard lane the proof cases ride in the intent paragraph. Patches rely on the battery alone.
- **The oracle is independent at authoring, not just at review.** The green-but-wrong bugs happened because one context wrote both the code and the tests that judged it, and seeded the fixtures with the one shape its own logic handled. The rule that follows: the agent that wrote the code is never the only author of the tests that judge it.
- **On the complex lane, the accepting tests are written blind.** After the implementer hands off, a separate agent writes the slice's suite from three inputs: the sealed design, the proof plan, and the public interface of the built code — names, signatures, and endpoints, extracted mechanically, never the bodies. It does not see the implementation and it does not see any tests the implementer wrote while building. Its brief is adversarial: assume the implementation is trying to pass without doing the job, and write the suite that makes that impossible. The implementer cannot build toward these tests, because they do not exist while it builds; the author cannot shape its tests around the code, because it never reads the code. Drift surfaces on its own: if the design promises something the built code lacks, the blind author writes that test anyway — from the design — and it fails. When a blind test fails, the driver triages: an implementation bug goes back to the implementer with the failing output; a test that misread the design is fixed against the design.
- **The implementer's own tests are scaffolding.** It may write whatever tests help it build, and they may stay in the suite — but acceptance never rests on them, and the auditor below prunes duplicates and empty assertions.
- **After green, a test auditor extends the suite.** At milestone close, with full sight of the design, the tests, and the code, its brief is the mirror of the blind author's: assume the tests were written to hide something — find what they fail to prove, then write those tests. Coverage gaps, edge cases the code visibly fudges, the known cheat tells. What it writes joins the permanent suite. On the standard lane, where the implementer authors its own tests, this audit is the independence mechanism; on the complex lane it is the second layer.
- **What tests-first actually buys — stated honestly.** A test authored before the code takes its shape from the intent instead of mirroring the implementation; a headline proof born red has proven it can fail; and the board only means something because its proofs are named up front. What tests-first does not do is stop cheating. That job belongs to the layers above and below: authorship independence, the audit, the deletion test, run evidence, and your drive of the real product.
- **Fixture diversity is stated, not hoped for.** A suite that seeds only the happy shape proves the happy shape. The plan names the risky axes the fixtures must cover; property-based tests where the stack supports them.
- **A checker exercises its consumer's real code path.** Staycurrent's gate passed content that the site's own loader then rejected — twice — because the gate reimplemented the loader's rules in parallel, and parallel implementations drift. The fix (the gate now imports the loader's schema path) becomes the rule: a checker imports the real parser, schema, or loader it guards. A hand-rolled second definition of "valid" is itself a defect.
- **Execution is evidenced, never inferred.** Test suites have shipped compiling-but-never-run; a build reported success while a hand-edited project file silently dropped the tests from the target; CI ran one of three suites for weeks. So the battery records run evidence: which suites ran, how many tests executed, and that every test a slice adds appears by name in the run log. A run that executes zero tests is red. Suites are discovered by pattern, never enumerated by hand, and the battery reconciles discovered against ran.

## One suite — the board is a view

The red-then-green board stays; the separate suite it lived in goes. Today a bet gets a dedicated progress suite, authored all-red up front and deleted at archive, while the permanent tests live elsewhere — two copies of every proof. The record shows what that split cost ([evidence.md](evidence.md)): regression guards written into the disposable copy died with it, and "mirror this into a permanent target" had to be re-learned bet after bet; the permanent copy was chronically the weaker one — the coverage lens's most recurring finding; stale red stubs outlived their bets; and agents could not tell which of two near-identical tests was the real one.

The replacement:

- **Tests are born once, in their permanent home.** Authored at decomposition, committed red, exactly as today — but they are the long-lived tests from their first commit. Nothing is deleted at close, and there is nothing to mirror.
- **Membership is a marker, not a location.** Every headline proof carries its bet and slice in its name or metadata — one more field in the derivation contract. Running just a bet's tests is a filter, which every stack's test runner supports. And every test permanently records which bet created it.
- **The board is derived.** The sealed proof plan lists the proofs and which rung each belongs to; the battery's last run says which are red and green. The tower joins the two into the bet's board page, stamped with the run it came from. It freezes at archive like every delivered view.
- **Expected state comes from plan position, never from edits.** A proof on an unreached rung must be red, for the right reason. A proof on a claimed-done slice must be green. Green on an unreached rung is flagged — ahead of plan or hollow, both worth a look. Nobody flips expectation markers; the only way to move the board is to deliver. Bets run on their own branches, so mainline CI never sees mid-bet red.
- **Deliberate exceptions are recorded.** A proof that genuinely should not outlive its bet — a one-time migration behavior, say — is marked retire-at-close in the proof plan. Deletion is a decision, never the default fate of a test.

## The adversary

Fresh-context review with zero shared context with the author, at two altitudes doing two different jobs.

- **Per slice**: blind correctness review of the diff.
- **Per milestone sum**: the honesty audit, edge-case judgment over the assembled diff, and the test audit — the suite-extending pass defined above. The audit carries the six-tell catalog of ways agents fake done: three it judges — a stub standing in where the proof named the real dependency, fixtures nothing real ever produces, tests that assert against a test-only copy of the logic — and three the scans below catch mechanically: proofs quietly hollowed (honesty scan), controls built but never wired (wiring scan), raw style literals (token scan).

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

The one-page worker contract: arrive briefed — the dispatch carries the extract the work needs, and a worker missing orientation escalates instead of hunting for it; hand off changes unstaged for the driver to inspect; return a parseable report; escalate blocking concerns instead of guessing; and never satisfy with a mock anything the sealed proof names as real. Dispatch tiers follow the core context principle: frontier drives and reviews, execution workers build, tier explicit on every dispatch, spend and role recorded per dispatch.

Every battery run writes its outcome to the journal ([loop.md](loop.md)) — which rows ran and each row's result — automatically, at the moment it runs. A check with no journal lines is a check that never ran, and that is now a visible fact instead of a forensic discovery.

## Proving the method

The battery proves products. This section is about proving GroundWork itself: the prose, the checks, and the surfaces. The instruments sit on a cost ladder, and the rule is to reach for the cheapest one that can answer the question. Model calls are spent last.

**Rung 0 — code proves code.** Parsers, the board derivation, the journal writer, the tower's rendering, every CLI verb: ordinary code with ordinary tests, zero tokens. A model call is never spent proving what a unit test can prove.

**Rung 1 — real work.** The journal and dev mode measure every mechanism in production for free: catch and fire counts, waiver repeats, spend by role ([surfaces.md](surfaces.md)). The sunset regime's re-tests run in real projects first ([index.md](index.md)). A sim is never scheduled to answer a question the journal will answer anyway.

**Rung 2 — judge-only replays.** One frontier dispatch, no generation: a fresh judge reads a real past bet's archive — or a planted fixture — against a rubric and returns a verdict with quoted evidence. The archived bets are test fixtures we already own. Most method regressions are checked this way: assessment without simulation.

**Rung 3 — live sims.** The expensive instrument, kept for the one question nothing cheaper answers: does the prose actually steer an agent end to end. The harness is a Claude Code session: it seeds a fixture repo in a worktree, spawns the scenario as subagents, and dispatches the judge. A cast of three, under the same tier policy as delivery:

- The **runner**, execution tier, plays the delivering agent.
- The **scripted owner** plays the human: a canned decision script wherever answers are predetermined, a model only where the scenario needs improvisation.
- The **judge**, frontier tier, fresh context, scores against a rubric and quotes its evidence.

The transport note is `dated`: the fan-out is in-session subagents because headless print mode is unavailable on subscription quota ([evidence.md](evidence.md)). The rig's interface — scenario in, artifacts and verdict out — does not care what the host calls its agents next year.

**The scenario shelf.** Five flows and an adversarial set:

- **Greenfield door**: intent conversation → toolchain proposal → adversary review → birth seal → manifest build-out.
- **Brownfield door**: day-one install on a fixture legacy repo → adoption seal → ratchet baseline → first slice through the adapter.
- **Slice**: one slice through the full pipeline — brief, worker, battery, adversary, capsule.
- **Bet**: pitch → design walk → decomposition → acceptance → archive, with the scripted owner sealing.
- **Program**: a ladder of two tiny bets with the dial at `program` — did it run unattended, stop only for the mechanical list, and catch a planted cross-bet invalidation.
- **Escape replays**: fixtures seeded with the mined cheat catalog — commented-out assertions, hollow capabilities, mocks where the proof names real — proving the catchers still catch. When a defect class recurs in real work, its replay joins the shelf: catches point upstream, applied to the method itself.

**The quota rules.** Fixtures are the smallest faithful ones — a sim bet is two milestones of two slices; the flow is what is proven, never the scale. Three run tiers with named triggers: smoke (the slice scenario; cheap; every release), full (the doors and the bet; pre-release, or when the prose a scenario exercises changed), deep (the program and the replays; per model generation, or on drift evidence). And the rig journals its own dispatches with role `sim`, so the harness's spend sits in the same sorted column as everything else and every scenario carries a cost budget it must justify.
