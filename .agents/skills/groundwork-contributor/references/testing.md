# Testing GroundWork — the simulation and scaffold harnesses

Part of the `groundwork-contributor` skill. Read this before running or debugging a
simulation, adding a new suite/persona, or touching the scaffold test harness. The
Test Infrastructure section of `SKILL.md` carries the 4-line orientation and the
scaffold-harness layer table this file expands on.

---

## Flow Testing — the Simulation Harness

Flow testing (the greenfield and brownfield methodology paths) is **not** a
programmatic agent driver. There is no SDK loop. A flow test is a **real Claude
Code session, run by a human, against the real installed skills** — so it
exercises genuine skill loading, orchestrator routing, subagent dispatch, and the
Serena MCP server, none of which a hand-rolled loop can reproduce faithfully.

> The old `conversational_eval.py` harness (a raw Anthropic Messages loop with two
> Haiku agents) has been removed. It re-implemented the agent loop and could only
> exercise the sequential, LLM-only path — a green run there did not prove the
> skill worked in the product. Simulation replaces it.

### How it works

`./dev sandbox --simulate` scaffolds a sandbox and seeds three artifacts into it
(via `scripts/seed_simulation.js`), then a human opens a Claude Code session in
that folder and runs the kickoff command:

| Artifact | Path | Role |
|---|---|---|
| **Persona subagent** | `.claude/agents/sandbox-user.md` | The simulated human client. Persona text is lifted verbatim from the suite's `suite.json`, so the dry-run and any future probe share one source of truth. |
| **Kickoff command** | `.claude/commands/simulate-<path>.md` | The facilitator's operating loop. Walks the full path, delegating every user-facing turn to `sandbox-user` instead of pausing for the real human. |
| **Judge command** | `.claude/commands/judge.md` | A non-gating quality rubric, run in a **fresh** session (see Assessment). |

The session runs the real skills and writes real `docs/*.md` + `.groundwork`
state, committing when the persona approves a draft. The simulation is the
**instrument**, not the thing under test — when a skill behaves poorly, the
operating loop runs it faithfully so the weakness shows in the transcript.

### Running a simulation

```bash
./dev sandbox --simulate                      # greenfield, default suite (storytelling_engine)
./dev sandbox --simulate=b2b_saas             # greenfield, a specific suite/persona
./dev sandbox --brownfield --simulate         # brownfield from the synthetic fixture (offline)
./dev sandbox --repo=owner/repo --simulate    # brownfield from a real GitHub repo (cached clone)
./dev sandbox myrun --simulate                # custom sandbox dir name (.sandboxes/myrun)
```

Then open a new Claude Code chat **from the sandbox folder** and run
`/simulate-greenfield` (or `/simulate-brownfield`). The real human observes and
may interject; any real-human message is treated as an override, not the persona.

- **Greenfield** inits into an empty repo (with a throwaway Nx-style root so the
  scaffold skill is happy). Sequence: Product Brief → Design System → Architecture
  → Scaffold → MVP → first Bet.
- **Brownfield** seeds an existing codebase, **commits it as the adoption baseline
  before GroundWork touches anything** (infra-adopt diffs against
  `baseline.source_commit`), then inits. A brownfield repo is deliberately not an
  Nx workspace — infra-adopt bootstraps `nx.json` itself. Sequence: Scan → Product
  Brief Extract → Design System Extract → Architecture Extract → Infra Adoption →
  first Bet.

The brownfield codebase comes from one of two sources:

| Source | Flag | What it is |
|---|---|---|
| **Synthetic fixture** (default) | `--brownfield` | `tests/evals/fixtures/brownfield_monorepo/00_codebase` — a tiny two-service repo. Offline, deterministic, fast. Proves the flow runs; too small to stress the scan phase. |
| **Real GitHub repo** | `--repo=owner/repo[@ref]` | Any repo, cloned **once** into a gitignored cache at `.sandboxes/.cache/repos/<slug>` (recursing submodules) and reused across runs — `--refresh` re-pulls, `./dev test clean` clears it. The first clone of a large monorepo is slow (~1 min); subsequent runs reuse the cache in seconds. Requires `gh` auth (works for private repos + private submodules). Not reproducible for anyone without repo access → they fall back to the fixture. `@ref` pins the umbrella commit (and, via gitlinks, its submodules) for determinism. |

> A real multi-service monorepo (4 services, ~1600 files) scanned by a live Opus
> session across scan + four extract phases is a long, expensive run — reserve it
> for deliberate deep runs, not casual iteration.

> **Pin the model before a review run.** Set Opus (`/model`) before kicking off a flow
> you intend to assess — a Sonnet run grinds the review loop harder (weaker first drafts →
> more revise cycles) and muddies whether a defect is a skill weakness or a model weakness.
> `render_transcript.py` records the model that actually ran in the review header, so check
> it there before drawing conclusions from a transcript.

Every sandbox carries a `CLAUDE.md` boundary file asserting it is a user project,
not the framework repo — without it, a chat opened in the nested sandbox would
inherit this repo's contributor skill and think it is building GroundWork. (When
seeding from a real repo, this boundary file replaces any `CLAUDE.md` the source
carried.)

### Personas — the coverage knob

Personas live in `tests/evals/scenarios/<suite>/suite.json` (`user_persona` +
`user_goal`). The simulated user is the test's input oracle: a bland
"looks great, commit it" persona makes a test that always passes. The current
suites are **cooperative** by design while the harness is shaken out; adversarial
variants (ambiguous, contradictory, terse) are the lever for deeper coverage and
are added as additional suites.

### Assessment

There is no automated pass/fail — the verdict is a human reading two surfaces:

```bash
./dev sandbox review <name>      # → .sandboxes/<name>-review/
```

1. **`conversation.md`** — the rendered transcript (`scripts/render_transcript.py`).
2. **`checklist.md`** — a structural checklist (`scripts/sandbox_checklist.py`):
   a non-gating mechanical check of **durable** artifacts only — canonical
   `docs/*.md` present/non-empty/titled, `state.json` `project_type` + completed
   phases, and git commits. It deliberately ignores `.groundwork/cache/*` (deleted
   on commit — checking it reports false failures in a full-flow run) and
   frontmatter (GroundWork doc templates carry none).

For a **quality** verdict, open a *fresh* Claude Code chat in the sandbox and run
`/judge`. A fresh context is a genuine critic; a judge sharing the context that
wrote the docs would only rubber-stamp its own work. The judge is non-gating —
it tells you whether the output is good and where it is weak.

### Checkpoints — resume mid-flow

A full flow is expensive to re-run when you only want to debug one phase.
Checkpoints snapshot a successful run's durable workspace (`docs/` +
`.groundwork/`, never `.agents/` — skills are always re-installed fresh) so a new
sandbox can be seeded to resume from that point:

```bash
./dev sandbox checkpoint capture <name> --as <label>   # snapshot a green run
./dev sandbox checkpoint list                           # list captured checkpoints
./dev sandbox <newname> --from=<label> --simulate       # resume from a checkpoint
```

Checkpoints are a **cache of the last green run**, not a frozen golden — when a
phase's output format changes, re-harvest the downstream checkpoints from a fresh
green run.

### Suites and fixtures

| Path | Contents |
|---|---|
| `tests/evals/scenarios/<suite>/suite.json` | Persona + goal (the single source of truth, read by `seed_simulation.js`). |
| `tests/evals/scenarios/<suite>/NN_*.json` | Per-phase descriptors (skill path, durable `success_files`) — a phase-list hint. |
| `tests/evals/fixtures/brownfield_monorepo/00_codebase` | The existing codebase the brownfield path adopts. |
| `tests/evals/fixtures/<suite>/<phase>/` | Pre-baked per-phase workspaces (legacy seeds). |

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
