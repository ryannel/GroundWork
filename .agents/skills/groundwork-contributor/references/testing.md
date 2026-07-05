# Testing GroundWork — the simulation and scaffold harnesses

Part of the `groundwork-contributor` skill. Read this before running or debugging a
simulation, adding a new suite/persona, or touching the scaffold test harness. The
Test Infrastructure section of `SKILL.md` carries the 4-line orientation and the
scaffold-harness layer table this file expands on.

---

## Flow Testing — the Simulation Harness

Flow testing (the greenfield, brownfield, and delivery methodology paths) is
**not** a programmatic agent driver. There is no SDK loop. A flow test is a
**real Claude Code session against the real installed skills** — so it exercises
genuine skill loading, orchestrator routing, subagent dispatch, and the Serena
MCP server, none of which a hand-rolled loop can reproduce faithfully. The
session is launched detached by `./dev sim run`, or by a human at a keyboard
(`--attended`); both run the identical session.

> The old `conversational_eval.py` harness (a raw Anthropic Messages loop with two
> Haiku agents) has been removed. It re-implemented the agent loop and could only
> exercise the sequential, LLM-only path — a green run there did not prove the
> skill worked in the product. Simulation replaces it.

### The driver loop

Four commands take an empty state to a graded verdict. Any agent (from a chat
session) or human can drive it; nothing in the loop needs manual wiring.

```bash
./dev sim run pilot --until="Product Brief"   # provision + seed + launch, detached
./dev sim follow pilot                        # block until done; digest + conversation tail
./dev sim assess pilot                        # transcript + checklist + judge verdict + findings scaffold
$EDITOR .sandboxes/pilot-review/findings.md   # grade: cite evidence, generalize fixes, disposition each
```

Rules that keep the loop honest:

- **Model tiers.** `sim run` defaults to sonnet — right for harness shakeouts and
  bounded runs. Pin opus (`--model=opus`) for a run you intend to judge: a weaker
  model grinds the review loop harder and muddies whether a defect is a skill
  weakness or a model weakness. `sim judge` defaults to opus for the same reason.
- **Bound first runs.** `--until=<phase>` stops the run after that phase's output
  is committed, and `sim assess` checks the bounded contract (later artifacts
  report `out of bound`, not missing). Never send an unattended session into the
  scaffold phase blind.
- **Quota.** Sessions bill to the machine's Claude subscription, so runs draw
  from its usage limits. Check limit pressure before a full opus flow; prefer
  bounded sonnet runs for routine coverage.
- **Billing invariant.** Sessions launch via `claude --bg` with a scrubbed
  environment (`claude_clean` in `scripts/sim/_common.sh`), so a run triggered
  from inside another Claude Code session still authenticates with the machine's
  subscription OAuth. `claude -p` is banned in the harness — headless print mode
  mis-bills subscription runs as API usage (claude-code issue #43333) — and
  `scripts/check_sim_invariants.sh` fails `./dev ci` if it reappears.

The verbs around the loop: `sim status <name>` (recorded runs + live sessions,
`--json` for polling), `sim list` (latest run per sandbox), `sim stop <name>`,
`sim judge <name>` (fresh-context verdict by itself), `sim suites` (every
scenario with last-run info), `sim checkpoint` (below). `./dev sim` prints the
full surface.

### What a run leaves behind

Every launch writes a record to `<sandbox>/.simrun/runs.jsonl` (run id, path,
suite, model, bound, session id, outcome) — the durable link between a sandbox
and its sessions after the live `claude agents` registry forgets them. Run
history survives re-provisioning.

Background sessions isolate their edits in a git worktree
(`<sandbox>/.agents/worktrees/`, branch `worktree-<session>`) — Claude Code
policy, so a detached session can't clobber a shared checkout. The harness
absorbs the isolation: `sim follow` and `sim assess` merge the session branch
back into the sandbox root and harvest untracked outputs (the judge's verdict),
so the sandbox root stays the single source of truth. Provisioning
baseline-commits the fully seeded sandbox for the same reason — the isolated
checkout contains only committed state, so an uncommitted skill or config file
would be invisible to the session that needs it.

`sim assess` produces the complete review bundle at `.sandboxes/<name>-review/`:

| File | What it is |
|---|---|
| `conversation.md` + `subagents/` | The rendered transcript and each persona side-thread |
| `checklist.md` | Structural check of durable artifacts, bound-aware for `--until` runs |
| `verdict.md` | The fresh-context judge's verdict, harvested from `.simrun/verdict.md` |
| `findings.md` | The grading scaffold — the driver's judgment work, and the only manual step |

Grading closes the loop: every finding cites evidence (a transcript turn, a
checklist row, a verdict line), names the owning skill, and carries a
**generalized** fix — the Sandbox Problem rule in `SKILL.md` applies to every
entry. A finding with no disposition (fixed / filed / accepted-because) is
unfinished business. Quality verdicts are non-gating by design; only the
structural checklist is mechanical.

### How the harness is put together

Provisioning (`./dev sandbox`, called by `sim run`) creates the sandbox, runs
`groundwork init`, and seeds three artifacts via `scripts/seed_simulation.js`:

| Artifact | Path | Role |
|---|---|---|
| **Persona subagent** | `.claude/agents/sandbox-user.md` | The simulated human client. Persona text comes verbatim from the suite's `suite.json` — attended and autonomous runs share one source of truth. |
| **Kickoff command** | `.claude/commands/simulate-<path>.md` | The facilitator's operating loop. Walks the path, delegating every user-facing turn to `sandbox-user`. Its `$ARGUMENTS` slot receives run directives (`--until` bounds). |
| **Judge command** | `.claude/commands/judge.md` | The non-gating quality rubric. Requires the verdict be written to `.simrun/verdict.md` — a verdict that lives only in a chat evaporates. |

The seeder is a thin renderer: all session-facing text lives in
`tests/evals/templates/` (persona, both kickoffs, the delivery judge) and
`tests/evals/judge-rubric.md` (the setup judge). Edit the template, never the
seeder — template text is diffable and reviewable; string blobs in a script are
neither.

The session runs the real skills and writes real `docs/*.md` + `.groundwork`
state, committing when the persona approves a draft. The simulation is the
**instrument**, not the thing under test — when a skill behaves poorly, the
operating loop runs it faithfully so the weakness shows in the transcript.

### Attended runs

`./dev sim run <name> --attended` provisions and seeds without launching; open a
chat from the sandbox folder and run `/simulate-<path>` yourself. The real human
observes and may interject — any real-human message is an override, not the
persona. Attended runs assess identically (`sim assess` falls back to the latest
transcript when no run record exists).

### The three paths

- **Greenfield** inits into an empty repo (with a throwaway Nx-style root so the
  scaffold skill is happy). Sequence: Product Brief → Design System → Architecture
  → Scaffold → MVP → first Bet.
- **Brownfield** (`--path=brownfield`, or `--repo=owner/repo[@ref]` for a real
  codebase) seeds an existing codebase, **commits it as the adoption baseline
  before GroundWork touches anything** (infra-adopt diffs against
  `baseline.source_commit`), then inits. A brownfield repo is deliberately not an
  Nx workspace — infra-adopt bootstraps `nx.json` itself. Sequence: Scan → Product
  Brief Extract → Design System Extract → Architecture Extract → Infra Adoption →
  first Bet.
- **Delivery** (`--path=delivery`) seeds a project mid-flow with a sealed,
  approved bet and drives Phase 4 only — the delivery engine's mechanics are the
  thing under test, and its judge scores each mechanic Present/Weak/Absent.

The brownfield codebase comes from one of two sources:

| Source | Flag | What it is |
|---|---|---|
| **Synthetic fixture** (default) | `--path=brownfield` | `tests/evals/fixtures/brownfield_monorepo/00_codebase` — a tiny two-service repo. Offline, deterministic, fast. Proves the flow runs; too small to stress the scan phase. |
| **Real GitHub repo** | `--repo=owner/repo[@ref]` | Any repo, cloned **once** into a gitignored cache at `.sandboxes/.cache/repos/<slug>` (recursing submodules) and reused across runs — `--refresh` re-pulls, `./dev test clean` clears it. Requires `gh` auth. Not reproducible for anyone without repo access → they fall back to the fixture. `@ref` pins the umbrella commit for determinism. |

> A real multi-service monorepo scanned by a live opus session across scan + four
> extract phases is a long, expensive run — reserve it for deliberate deep runs.

Every sandbox carries a `CLAUDE.md` boundary file asserting it is a user project,
not the framework repo — without it, a chat opened in the nested sandbox would
inherit this repo's contributor skill and think it is building GroundWork. (When
seeding from a real repo, this boundary file replaces any `CLAUDE.md` the source
carried.)

### Personas and the coverage matrix

Personas live in `tests/evals/scenarios/<suite>/suite.json` (`user_persona` +
`user_goal`) — `./dev sim suites` lists them all with last-run info. The
simulated user is the test's input oracle: a bland "looks great, commit it"
persona makes a test that always passes. Pick suites by the failure class you
are hunting:

| Failure class | Suites | Cadence |
|---|---|---|
| Baseline mechanics (does the flow run at all) | `storytelling_engine`, `b2b_saas`, `developer_cli`, `headless_api`, `ai_agent_tool` | Bounded sonnet run after any skill-corpus change to that path |
| Ambiguity handling (vague, underspecified answers) | `adversarial_ambiguous` | Bounded runs against the discovery phases |
| Requirement reversal (user contradicts earlier answers) | `adversarial_reversal` | Bounded runs against discovery + design phases |
| Scope discipline (user keeps adding wants) | `adversarial_scope_creep` | Bounded runs against Product Brief / MVP planning |
| Terse input (minimal answers, no elaboration) | `adversarial_terse` | Bounded runs against discovery phases |
| Brownfield grounding (docs must trace to real code) | `brownfield_monorepo`, `--repo=` deep runs | Full run before a release |
| Delivery mechanics (the eight judged mechanics) | `delivery_task_capture` | Full run before a release |
| Multi-surface routing | `multi_surface`, `forge_native_desktop` | When surface routing changes |
| Upgrade path | `upgrade` | When the update lane changes |

A full opus run of a setup path before each release, plus bounded sonnet runs of
the classes a change touches, is the working cadence until scheduled sweeps earn
their quota (plan `autonomous-sim-harness.md`, open decision O-1).

### Checkpoints — resume mid-flow

A full flow is expensive to re-run when you only want to debug one phase.
Checkpoints snapshot a successful run's durable workspace (`docs/` +
`.groundwork/`, never `.agents/` — skills are always re-installed fresh) so a new
sandbox can resume from that point:

```bash
./dev sim checkpoint capture <name> --as <label>   # snapshot a green run
./dev sim checkpoint list                          # list, with staleness flags
./dev sim run <newname> --from=<label> --until=... # resume from a checkpoint
```

Checkpoints are a **cache of the last green run**, not a frozen golden. Each
capture stamps `meta.json` with the skill-corpus commit it was harvested under;
`list` flags a checkpoint **STALE** when the corpus (`src/skills`,
`src/hidden-skills`, `src/docs`, `src/config`) has moved since — re-harvest it
from a fresh green run before trusting a resume.

### Suites, fixtures, templates

| Path | Contents |
|---|---|
| `tests/evals/scenarios/<suite>/suite.json` | Persona + goal — the single source of truth, read by `seed_simulation.js`. |
| `tests/evals/templates/` | Session-facing text: persona, kickoff-setup, kickoff-delivery, judge-delivery, findings scaffold. |
| `tests/evals/judge-rubric.md` | The setup-path judge rubric ({{flowPath}} + per-path blocks, rendered by the seeder). |
| `tests/evals/fixtures/brownfield_monorepo/00_codebase` | The existing codebase the brownfield path adopts. |
| `tests/evals/scenarios/delivery_task_capture/fixture/` | The sealed-bet workspace the delivery path starts from. |

> Note: `tests/evals/validate_scaffold.py` is **not** part of the flow harness —
> it is a scaffold boot-prober (a sibling of the scaffold tests). Run it via
> `./dev test validate`.

---

## Scaffold Test Harness — how it works

The scaffold harness creates a fresh sandbox, uses the Nx generators to build a
multi-service monorepo, and stands up the entire local infrastructure via Docker
Compose and native binary runners. The four-layer table (Generation → Contracts →
Compilation → End-to-End) and the `./dev test <layer>` commands live in `SKILL.md`
— run them in that order, cheapest first.

The **Inner System Tests** (`src/generators/system-test-runner/files/test_system.py`)
are generated into the sandbox and run inside the boot topology to verify cluster
health, webhook rejection, load shedding, and cross-service communication.

To inspect the generated environment after a full `./dev test scaffolds` run,
comment out the teardown in `test_scaffolds.py` — the sandbox persists at
`.sandboxes/scaffolds/testloop/`.
