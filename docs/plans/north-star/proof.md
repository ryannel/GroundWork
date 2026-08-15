# Part 4: The Proof

The battery is the shipped set of checks behind one `verify` command.

## Probes by topology

The capability manifest declares a topology profile for each product surface: server, web, desktop, CLI, mobile, or library. A repo can carry more than one profile — for example, an API and its web app count as two surfaces. A monorepo registers once; its manifest maps each surface to a profile.

Each profile names its own universal probes:

- **Server**: compose boot, HTTP health, round trip, migration apply.
- **Desktop**: launch-to-window, relaunch-after-crash, UI-driver smoke.
- **CLI**: install, run, exit codes and output.
- **Mobile**: build, boot in the simulator, one smoke flow.
- **Library**: install from the registry, import, and a consumer-fixture round trip. Its drive artifact is a run of the real consumer example the design names — a library's front door is code that uses it.

A capability with no runnable probe on its platform gets a fail-closed placeholder. It is never silently skipped.

Each deploying topology also names a release probe, run at bet close ([loop.md](loop.md)):

- **Server** — deploy to the named target and pass health there.
- **Desktop** — the notarized build installs and launches.
- **Mobile** — the store build boots.

The front door must be proven where users actually receive the product, not only where it was built.

**A capability with a user interface is proven at that interface.** In real use, a common failure looks like this: the API works, but the UI on top of it is broken. Every headless row is green, yet the user still cannot use the feature.

So every user-facing case in a proof plan is paired:

- One **headless case**, at the API or unit level. It is fast and rock solid — the thing that makes failures cheap to find.
- One **UI-driver case** that walks the same case through the real interface. It clicks what the user clicks and checks what the user sees on screen, never the API response underneath.

A UI case starts at the app's entry point and navigates to its target. It never deep-links. A screen nobody can reach cannot pass its own proof.

The UI case is the headline. The board row for a user-facing proof shows the UI result, with the headless twin behind it. Green underneath a broken screen is not done, and the board cannot say it is.

Scheduling keeps this affordable. The per-slice battery runs the headless suite plus the slice's own headline UI case. The full UI set runs at milestone close. UI cases stay out of per-slice mutation runs. Pairing is a proof requirement, not a per-commit tax.

## How the checks stay trustworthy over time

- Universal checks run from the installed package, never the working tree. `verify` confirms the package hash against the lockfile.
- **Project probes run at their sealed git revision.** A probe diff re-opens the seal and re-runs the adversary.
  - Probe *intent* is sealed with the plan that names it: at the design-walk seal on the complex lane, and at the birth or adoption seal for a manifest probe.
  - Probe *code* is sealed at first green, because a probe cannot be deletion-tested before its capability exists.
- Deletion tests apply to probes and ratchet linters, not just product tests.
- **The evidence is protected from the party it audits.** The CLI hash-chains journal lines, seal tags are signed with a key the agents cannot read, and `verify` checks chain continuity. "Append-only" is a control here, not a convention: the agents being audited have full write access to the repo that holds the record.

## Proofs are authored, not just checked

The review that catches a bad test is the last line of defense. These rules act earlier, where the test is born. They exist because the mining's dominant defect class was suites that stayed green while behavior was wrong — and every one of those suites was authored, reviewed as prose, and trusted before it failed to see its bug.

### Authoring the plan

- **Every slice carries a proof plan.** It is written at decomposition, before any implementation. It names the cases that prove the capability, the fixture axes that must vary, and what runs real versus faked.

  Tests implement the plan. The adversary reviews the tests against the plan — not against the implementation's own claims.

  - On the **complex lane**, the human walks and seals the proof plan alongside the design. Test design is design: deciding what would prove the work deserves the same human attention as the work, where complexity justifies it.
  - On the **standard lane**, the proof plan is the whole per-slice artifact. There is no separate intent paragraph. Inside a bet, intention is inherited from the sealed pitch.
  - **Standalone standard-lane work** — work that belongs to no bet — opens its plan with one line: what was asked, and why, in the requester's own words where there is a requester. The adversary and the Queue read this line to catch work aimed at the wrong target.
  - **Patches** rely on the battery alone.
  - A **data-touching slice**'s plan carries three more entries: reversibility (the down-migration is probed, not assumed), an expected-runtime class for anything that runs against production-scale data, and fixture provenance (production-derived data is named and scrubbed, because fixtures must be policed for being too real as well as too fake).
  - A slice's plan also lists every user-visible default, string, and edge-case behavior it introduces. One that no design line or standing ruling names is decided as a recorded default — never silently ([loop.md](loop.md)).
- **The oracle is independent at authoring, not just at review.** Green-but-wrong bugs happened because one context wrote both the code and the tests that judged it — and seeded the fixtures with the one shape its own logic handled. The rule that follows: the agent that wrote the code is never the only author of the tests that judge it.
- **Fixture diversity is stated, not hoped for.** A suite that seeds only the happy shape proves the happy shape. The plan names the risky axes the fixtures must cover. Where the stack supports it, that includes property-based tests.

### The blind author and the auditor

- **On the complex lane, the accepting tests are written blind.** After the implementer hands off, a separate agent writes the slice's suite. It runs at the execution tier: it implements the sealed proof plan, and the frontier adversary reviews its output against that plan.

  Its three inputs are the slice's extract of the sealed design (cut down by the driver the same way the driver cuts the ripple caller list — [loop.md](loop.md)), the proof plan, and the public interface of the built code: names, signatures, and endpoints, extracted mechanically, never the bodies. It does not see the implementation, and it does not see any tests the implementer wrote while building.

  Its brief is adversarial: assume the implementation is trying to pass without doing the job, and write the suite that makes that impossible. The implementer cannot build toward these tests, because they do not exist while it builds. The author cannot shape its tests around the code, because it never reads the code.

  Drift surfaces on its own. If the design promises something the built code lacks, the blind author writes that test anyway — from the design — and it fails.

  The suite is run by the driver, not the author, and the fix loop is laundered. What crosses back to the author is pass or fail per test, with the failure restated against the design and the plan — never raw stack traces or assertion diffs that echo the bodies. Compile-fix rounds are capped, and every crossing writes a journal line. An implementation bug goes back to the implementer with the full failing output — the implementer has no blindness to protect.

  Two things are bundled here, and they are held to different standards:

  - That the implementer does not author its own accepting suite is a **rule**. Every green-but-wrong catch on record traces back to self-authored tests.
  - That the independent author must also be blind is a **hypothesis**, judged the way preventive rules are ([index.md](index.md)): the blind-author-cheat sim must pass, the built-to-the-test defect class must stay absent from the complex lane, and a switch-off run must show output thinning without it. If blindness earns nothing, the independent author keeps writing the suite — sighted, under the same source rule as the auditor: the code says where to look, never what to expect. Body-reading review stays either way; it is where every recorded catch came from.
- **The implementer's own tests are scaffolding.** It may write whatever tests help it build, and they may stay in the suite. But acceptance never rests on them, and the auditor below prunes duplicates and empty assertions.
- **After green, a test auditor extends the suite.** At milestone close, with full sight of the design, the tests, and the code, its brief mirrors the blind author's: assume the tests were written to hide something, find what they fail to prove, then write those tests. It looks for coverage gaps, edge cases the code visibly fudges, and the known cheat tells. What it writes joins the permanent suite.

  On the standard lane, where the implementer authors its own tests, this audit is the independence mechanism. On the complex lane, it is the second layer.
- **The auditor never mirrors the code.** A post-hoc test goes wrong at one moment: the writer needs the right answer and takes it from the code, so the bug becomes the test. The rule: the code may tell the auditor where to look, never what to expect.

  Every test the auditor writes takes its expected outcome from the sealed design, the proof plan, or a stated invariant — and names that source on the test. An edge that none of those settles gets no test at all. Instead it files as a finding ("the design does not cover X; the code currently does Y"), lands in the decision-needed bucket, and the test is written from your decision, never from the observed behavior.

### What this proves, and what it does not

- **What tests-first buys, and what it does not.** A test authored before the code takes its shape from the intent instead of mirroring the implementation. A headline proof born red has proven it can fail. And the board only means something because its proofs are named up front.

  What tests-first does not do is stop cheating. That job belongs to the layers above and below: authorship independence, the audit, the deletion test, run evidence, and your drive of the real product.
- **A checker exercises its consumer's real code path.** Staycurrent's gate passed content that the site's own loader then rejected — twice — because the gate reimplemented the loader's rules in parallel, and parallel implementations drift.

  The fix — the gate now imports the loader's schema path — becomes the rule: a checker imports the real parser, schema, or loader it guards. A hand-rolled second definition of "valid" is itself a defect.
- **Execution is evidenced, never inferred.** Real failures on record: test suites that shipped compiling-but-never-run, a build that reported success while a hand-edited project file silently dropped the tests from the target, and a CI pipeline that ran one of three suites for weeks.

  So the battery records run evidence: which suites ran, how many tests executed, and that every test a slice adds appears by name in the run log. A run that executes zero tests is red. Suites are discovered by pattern, never enumerated by hand, and the battery reconciles discovered against ran.

## One suite, not two: the board is a view of it

The red-then-green board stays; the separate suite it lived in goes.

Today a bet gets a dedicated progress suite: authored all-red up front, deleted at archive. The permanent tests live elsewhere. That means two copies of every proof.

The record shows what that split cost ([evidence.md](evidence.md)):

- Regression guards written into the disposable copy died with it.
- "Mirror this into a permanent target" had to be re-learned bet after bet.
- The permanent copy was chronically the weaker one — the coverage lens's most recurring finding.
- Stale red stubs outlived their bets.
- Agents could not tell which of two near-identical tests was the real one.

The replacement:

- **Tests are born once, in their permanent home.** Headline proofs are authored at decomposition and committed red, exactly as today. Slice suites join them at their lane's authoring moment — the implementer first on the standard lane, the blind author after handoff on the complex lane. All are long-lived tests from their first commit. Nothing is deleted at close, and there is nothing to mirror.
- **Membership is a marker, not a location.** Every headline proof carries its bet and slice in its name or metadata — one more field in the derivation contract. Running just a bet's tests is a filter, which every stack's test runner supports. And every test permanently records which bet created it.
- **The board is derived.** The sealed proof plan lists the proofs and which milestone each belongs to; the battery's last run says which are red and green. The tower joins the two into the bet's board page, stamped with the run it came from. It freezes at archive like every delivered view.
- **Expected state comes from plan position, never from edits.** A proof on an unreached milestone must be red, for the right reason. A proof on a claimed-done slice must be green. Green on an unreached milestone is flagged — ahead of plan or hollow, both worth a look. Nobody flips expectation markers; the only way to move the board is to deliver. Bets run on their own branches, so mainline CI never sees mid-bet red.
- **Deliberate exceptions are recorded.** A proof that genuinely should not outlive its bet — a one-time migration behavior, say — is marked retire-at-close in the proof plan. Deletion is a decision, never the default fate of a test.

## The adversary

Fresh-context review with zero shared context with the author. It runs at two levels, doing two different jobs.

- **Per slice**: blind correctness review of the diff.
- **Per milestone sum**: the honesty audit, edge-case judgment over the assembled diff, and the test audit — the suite-extending pass defined above.

  The audit carries a six-tell catalog of ways agents fake done. It judges three of them directly:
  - a stub standing in where the proof named the real dependency
  - fixtures nothing real ever produces
  - tests that assert against a test-only copy of the logic

  The other three are caught mechanically, by the scans below:
  - proofs quietly hollowed (honesty scan)
  - controls built but never wired (wiring scan)
  - raw style literals (token scan)

The honesty half of the split is measured. Per-slice honesty auditing rubber-stamped: 17 runs, 2 catches, 4 false negatives. So it moved to the milestone sum.

The correctness half is a belief, not a measurement. The archives that could show its miss rate were destroyed, so "no rubber-stamping observed" is all the record can honestly say.

The edge-case and coverage lenses folded into this split made real catches at the slice level. So the merge has a rollback trigger: if the defect classes they used to catch come back — class tags make that visible — the lens moves back to per slice.

The new attribution data will confirm or revise all of this. The measurements that do exist are in [evidence.md](evidence.md).

## The human's tools

- **The drive artifact.** The acceptance seal requires evidence that you actually drove the product. It is recorded after the work's last commit, so it cannot be a stale run. `verify` refuses the seal without it.

  Without this, acceptance could decay into clicking a button on a page. With it, accepting means you ran the thing. The strongest evidence for keeping it: the owner driving the real app found live bugs no agent review had caught ([evidence.md](evidence.md)).
- **The waiver.** A sealed, dated override for a wrong check, rendered loudly on the Map. Wrong checks happen, and without a legitimate exit, the only escape is tampering.

  A check that keeps needing waivers is itself the defect. Repeated waivers of the same check flag it for repair or deletion. Magpie overrode the same six false-red gate checks every bet for weeks, because nothing counted the overrides. Those checks have since been fixed ([evidence.md](evidence.md)).

## Also in the battery

The scans, the deletion test, and the flake policy:

- **Honesty scan** — tests that assert nothing, assertions commented out or skipped, proofs quietly redefined down to what a stub can pass.
- **Wiring scan** — controls built but never wired: empty or TODO-only handlers, functions no caller reaches.
- **Token scan** — raw color, font, and spacing literals that bypass the design tokens.
- **Divergence row** — same-shaped solutions fingerprinted across slices: error envelopes, naming conventions, retry logic, duplicated capability. It turns red when the same problem got solved two ways.

  It judges divergence, never taste, so a consistent codebase passes even where the owner might have chosen differently.

  Per-slice review structurally misses one failure class: many locally fine calls that sum to an incoherent product. This row watches the sum. A divergence class that keeps firing triggers the recurrence rule — the decision is deleted, turned into a check, a generator, or a standards line, so it stops being a decision at all.
- **Reachability row** — the screens and routes found in code, checked against a crawl of the navigation graph from the app's entry point. A screen no navigation path reaches is red. Built work you cannot get to is not delivered.
- **Flag scan** (opt-in: it runs only where a project has declared a flag backend) — every flag in code must appear in the committed flag registry, with its purpose, default state, review-by date, and removal criteria written at creation.

  An unregistered flag is red, like an unlaned commit. A flag past its review date is red, like an expired `dated` rule — flag debt is the harden-in-place disease, and it gets the same cure.

  Proofs run with the flag on. Turning a flag off must leave every existing proof green. A flagless project never sees this scan.
- **The deletion test** (`mutate`) — remove or damage the implementation; the tests must go red. A suite the deletion test cannot make fail proves nothing.
- **The flake policy** — nondeterminism is a certainty at any real suite size, so the board cannot pretend red and green are the only states.

  A failing row reruns once. If the two runs disagree, the CLI writes a flake event to the journal and the proof enters quarantine: shown loudly as quarantined on the board, never silently green, never falsely red. While a UI case flakes, its headless twin stands as interim evidence.

  A quarantined proof is repaired or retired within its milestone. Flake rate is a check-health metric, alongside repeat-waivers. Unattended runs treat a flake as quarantine-and-continue, not a stop: one nondeterministic test must not halt a night's work.

The schedule bounds the cost. Per slice, the battery runs the touched area's suites and scopes the deletion test to changed code. The full suite and full mutation run at milestone close.

Battery wall-clock time is published as a trend, like the word count, because the record shows a slow battery is what makes people bypass it.

Journal segments archive as they age. Nothing is lost, but nothing is carried hot forever.

Visual rows: render smoke, a11y, and token conformance, plus the affordance-floor checklist for UI review — the minimum interactions every shipped surface must support (reachable controls, sane hit targets, selection, a way back). UI review also judges the built screen against the sealed page mockup ([loop.md](loop.md)) — the design was signed as a picture, so the shipped screen is compared to that picture, not to prose.

The one-page worker contract:

- Arrive briefed — the dispatch carries the extract the work needs, and a worker missing orientation escalates instead of hunting for it.
- Hand off changes unstaged, for the driver to inspect.
- Return a parseable report.
- Escalate blocking concerns instead of guessing.
- Never satisfy with a mock anything the sealed proof names as real.

Dispatch tiers follow the core context principle: frontier drives and reviews, execution workers build. Tier is explicit on every dispatch, and spend and role are recorded per dispatch. Overrides go upward only — a hard slice lifts its worker to frontier, a battling worker consults the advisor ([loop.md](loop.md)) — and nothing ever silently runs the review cheaper.

Every battery run writes its outcome to the journal ([loop.md](loop.md)) automatically, at the moment it runs — which rows ran, and each row's result. A check with no journal lines is a check that never ran. That is now a visible fact, not a forensic discovery.

## Proving the method

The battery proves products. This section is about proving GroundWork itself: the prose, the checks, and the surfaces. The instruments sit on a cost ladder of four levels, and the rule is to reach for the cheapest one that can answer the question. Model calls are spent last.

**Level 0 — code proves code.** Parsers, the board derivation, the journal writer, the tower's rendering, every CLI verb: ordinary code with ordinary tests, zero tokens. A model call is never spent proving what a unit test can prove.

**Level 1 — real work.** The journal and dev mode measure every mechanism in production for free: catch and fire counts, waiver repeats, spend by role ([surfaces.md](surfaces.md)). The sunset regime's re-tests run in real projects first ([index.md](index.md)). A sim is never scheduled to answer a question the journal will answer anyway.

**Level 2 — judge-only replays.** One frontier dispatch, no generation: a fresh judge reads a real past bet's archive — or a planted fixture — against a rubric and returns a verdict with quoted evidence. The archived bets are test fixtures we already own. Most method regressions are checked this way: assessment without simulation.

**Level 3 — live sims.** The expensive instrument, kept for the one question nothing cheaper answers: does the prose actually steer an agent end to end.

The harness is a session of the reference host adapter (Claude Code today — [index.md](index.md)). It seeds a fixture repo in a worktree, spawns the scenario as subagents, and dispatches the judge.

A cast of three, under the same tier policy as delivery:

- The **runner**, execution tier, plays the delivering agent.
- The **scripted owner** plays the human: a canned decision script wherever answers are predetermined, a model only where the scenario needs improvisation.
- The **judge**, frontier tier, fresh context, scores against a rubric and quotes its evidence.

The transport note is `dated`: the fan-out is in-session subagents, because headless print mode is unavailable on subscription quota ([evidence.md](evidence.md)). The rig's interface — scenario in, artifacts and verdict out — does not care what the host calls its agents next year.

**The scenario shelf.** Five flows, plus the scenarios that attack the method itself:

- **Greenfield door**: intent conversation → toolchain proposal → adversary review → birth seal → manifest build-out.
- **Brownfield door**: day-one install on a fixture legacy repo → adoption seal → ratchet baseline → first slice through the repo adapter ([doors.md](doors.md)).
- **Slice**: one slice through the full pipeline — brief, worker, battery, adversary, capsule. Run in both lane shapes: standard, with self-authored tests, and complex, with the blind author writing the accepting suite after handoff.
- **Bet**: pitch → design walk → decomposition → acceptance → archive, with the scripted owner sealing.
- **Program**: a ladder of two tiny bets with the dial at `program` — did it run unattended, stop only for the mechanical list, and catch a planted cross-bet invalidation.
- **The blind-author cheat**: a complex-lane slice whose runner is secretly briefed to cut corners — handle only the plan's listed cases, skip one design-promised element.

  The sim passes only if the blind suite or the auditor goes red. It must also show, in the transcript, that the blind author never saw the code bodies or the implementer's tests, and that only laundered failure summaries ever crossed back to it.

  This scenario exists because the blind author is itself an anti-cheat mechanism, and a broken one would fail silently green.
- **Escape replays**: fixtures seeded from the six-tell catalog (the adversary's, above) — proving the catchers still catch. When a defect class recurs in real work, its replay joins the shelf: catches point upstream, applied to the method itself.

**The quota rules.** Fixtures are the smallest faithful ones — a sim bet is two milestones of two slices. The flow is what is proven, never the scale.

Three run tiers, each with a named trigger:

- **Smoke** — the slice scenario. Cheap. Runs every release.
- **Full** — the doors, the bet, and the blind-author cheat. Runs pre-release, or when the prose a scenario exercises changed.
- **Deep** — the program and the replays. Runs per model generation, or on drift evidence.

The rig journals its own dispatches with role `sim`, so the harness's spend sits in the same sorted column as everything else. Every scenario carries a cost budget it must justify.
