---
name: groundwork-stack-forge
description: >
  Forge a first-class starting point when the architecture's chosen stack has no
  GroundWork generator — a native desktop app (AppKit, WinUI), an embedded daemon, an
  unsupported language or framework. Researches the stack, authors a self-contained
  engineer skill for it, and builds a Day-2 seed wired into `./dev`, then hands the
  Day-2 checklist to MVP planning. Invoked from the scaffold phase's unsupported-stack
  branch so going off the paved road still lands the project in a good place.
---

# groundwork-stack-forge

The paved road is the set of stacks GroundWork has a generator for. This skill is what
happens when the architecture, deliberately, goes off it — a macOS-native app, a Rust
service, an embedded firmware target, a language the generators do not produce. The wrong
answer is a passive shrug: "no generator, you're on your own." The right answer — the one
that makes GroundWork worth using off-script — is to do everything a generator would have
done, by hand and to the same bar: a real engineering skill for the stack, and a seed that
clears the Day-2 baseline.

You are a staff engineer who has shipped in this stack and is setting up a teammate to
succeed in it. Two artifacts come out of this: **an engineer skill** the project's agent
loads on every task in this stack, and **a seed** — a small, real, running starting point
that already does config validation, error handling, debugging, and the rest of the Day-2
baseline in this stack's idiom. The seed is a skeleton, not a finished product; the first
bets grow it. Both must be good enough that a senior practitioner in the stack would nod.

Apply the `groundwork-writer` skill when producing any output document — the engineer
skill, infrastructure notes, the hand-off. Declarative, assertive, zero-hedging.

## Operating Contract

This skill runs **inside** the scaffold phase: it owns no cache of its own, writes no
hand-off, and gates no review of its own — those are scaffold's Phase Lifecycle obligations,
already discharged around it. Its own obligations are three: record the Day-2 checklist
under a `## Forged Stack Checklist` heading in `.groundwork/cache/scaffold-cache.md` — the
identifier both scaffold's Phase 6 commit and MVP's Phase 1 read; apply the Living Documents
protocol to anything it writes into the canonical docs; and apply `groundwork-writer` to
every output document.

The governing rule is the Day-2 baseline: read
`docs/principles/delivery/day-2-operational-baseline.md` now. It is the bar the seed is held
to and the source of the checklist you hand to MVP — its two rules (**no empty capabilities**,
**off-script still lands well**) are why this skill exists.

## When this runs

The scaffold phase routes here from Phase 1 when it maps a service or surface to a stack no
generator can produce and the user chooses to build it properly (rather than reverse the
architecture onto a supported stack, or hand-roll it with no support). You inherit the
chosen stack from `docs/architecture/index.md` and `docs/surfaces.md`; do not re-litigate the
choice — the architecture made it. Your job is to honour it well.

## The forge pipeline

Run these in order. Each stage feeds the next; do not skip ahead.

### Stage 1 — Frame the stack and classify the target

Read the architecture and the surface registry for what was actually chosen: the language,
the framework, the platform, and what this component *is* — a service, a daemon, a CLI, a
native UI surface. Classify it, because the classification drives everything downstream: it
picks the engineer-skill family (Backend or Surface — see
`references/authoring-engineer-skills.md`), and it decides which Day-2 items apply in this
idiom and which are genuinely N/A.

State the frame back in two or three lines — "a native macOS menu-bar app in Swift/AppKit; a
Surface-family target; no server, so the API and schema baseline items are N/A, but config,
errors, debugging, logging, graceful teardown, a pure core, a test harness, and `./dev`
integration all apply." Confirm it with the user before researching.

### Stage 2 — Research the stack

Invoke the `deep-research` skill to build a cited, current picture of how this stack is built
*well*. Scope the research to the decisions the engineer skill and seed must get right:

- The idiomatic project layout and the one golden-path way to structure a pure core behind a
  thin shell in this stack.
- The build / run / debug loop — how a developer attaches a debugger and reads logs (the
  highest-leverage DX affordance).
- The error model — how errors are typed, propagated, and surfaced.
- Concurrency / event model, configuration, graceful teardown, and packaging.
- The test harness that runs in seconds, and how it is driven headlessly (for `./dev` and the
  system-test runner).
- The plausible-but-wrong idioms — what a strong general model writes that a senior
  practitioner would reject.

Do not author from memory where the stack has moved; the research is what keeps the skill
from being confidently out of date.

### Stage 3 — Author the engineer skill

Write `.agents/skills/groundwork-<stack>-engineer/` to the standard in
`references/authoring-engineer-skills.md` — the right family, the section spine, self-contained
references (no sync-anchor), the house style, and the **eval-before-accept loop**. Do not
accept the skill until you have run it against two or three realistic first tasks and it comes
out senior-grade against both the Day-2 baseline and stack idiom. Read the nearest shipped
engineer skill in the project as a worked example of shape.

### Stage 4 — Build the Day-2 seed by adopting the skill

Now build the seed — and build it *as* the engineer skill you just wrote would have you build
it. This dogfoods the skill: if it cannot guide a good seed, it is not done, so loop back to
Stage 3. The seed is a skeleton that clears the **applicable** Day-2 baseline items in this
stack's idiom — a pure core with a thin shell, config loaded and validated at startup, typed
errors handled at the boundary, a debugging entry point, structured logs, graceful teardown,
and a test that runs in seconds and proves the wired thing does something real. It is not a
product; it is the smallest real thing that is already operable and debuggable.

### Stage 5 — Wire the seed into `./dev` and the test loop

A seed outside `./dev` is a side process, not a first-class citizen — exactly the failure the
Day-2 baseline forbids. Wire it in:

- **`./dev`** — register the seed so `./dev start` runs it. If it is a process `./dev` can
  launch, register a runner in `.dev/dev.config.json` (name + launch command). If it needs a
  build-then-run or a richer verb, add a project command under `.dev/commands/` (it appears in
  `./dev help` and may shadow a built-in). Never leave `./dev start` with nothing to do for
  this project.
- **Surface registry** — if the target is a surface, register it in `docs/surfaces.md` and
  `.groundwork/surfaces.json` with `scaffold: forged` and its `testMedium`; if it is a service,
  record it in `docs/architecture/infrastructure.md` like any other managed unit.
- **System tests** — give it a headless test medium the `system-test-runner` can drive
  (the harness from Stage 2), so it joins the system test loop rather than sitting outside it.

Then verify: `./dev start` brings the seed up, `./dev status` shows it, and its test runs
green. Debug and fix anything that does not — a forged seed that does not boot is not done.

### Stage 6 — Hand the Day-2 checklist to MVP

The seed proves the shape; the first bets earn the depth. Walk the Day-2 baseline once for this
stack and, for each item, record *satisfied by the seed*, *to be built by a bet*, or *N/A
because…*. Write that list into the scaffold cache (`.groundwork/cache/scaffold-cache.md`) under
a `## Forged Stack Checklist` heading — the scaffold commit folds it into the MVP hand-off, and
MVP scopes the to-be-built items into the first bets. This is how "the checklist becomes part of
the MVP."

Record the forged stack in `docs/architecture/infrastructure.md` (its run command, its debug entry point, its
test command) so the next developer runs it without asking, then return control to the scaffold
phase to finish its mapping and commit.

## Output Expectations

- An engineer skill at `.agents/skills/groundwork-<stack>-engineer/` that passes its own
  eval loop and reads like a senior practitioner wrote it — self-contained, no sync-anchor.
- A seed that boots through `./dev start`, clears the applicable Day-2 baseline in the stack's
  idiom, and has a test that runs green.
- The seed registered in `./dev`, the surface/infra docs, and the system-test loop — a
  first-class citizen, never a side process.
- A Day-2 checklist in the scaffold hand-off so the first bets are scoped to finish the job.
- No empty capabilities anywhere in what you forged — every command, endpoint, and test medium
  you materialised does something real.
