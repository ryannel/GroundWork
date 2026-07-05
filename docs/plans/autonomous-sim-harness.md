# Implementation Plan: The Autonomous Simulation Harness (Runtime CI for the Methodology)

**Status:** PROPOSED 2026-07-05 — nothing executed. Foundation already landed separately: `./dev sandbox --run` background driver + `status`/`judge` verbs + billing invariant (`4e46b78`).
**Audience:** An engineer or agent implementing this change, and any future agent *driving* simulations — WS-D makes the harness legible to them.
**Scope owner:** `./dev` + `scripts/` (sim harness, dev-only), `tests/evals/` (scenarios, templates, rubrics), `.agents/skills/groundwork-contributor/` (SKILL.md + `references/testing.md`). Nothing here ships in the npm package.

---

## 0. Read this first — the mental model

GroundWork is a methodology executed by agents in live sessions. The four scaffold
test layers prove the *code*; only a simulation proves the *methodology* — real skill
loading, orchestrator routing, persona dispatch, real docs committed by a real
session. Until 2026-07-05 a simulation needed a human at a keyboard, so sims ran
rarely and every wave of repo work ended with "live sims owed." The `--run` driver
removed the human bottleneck; this plan builds the harness around it.

**End state:** any agent, from inside a chat, on subscription quota, can run the
whole loop in one command per step —

```
trigger → follow → assess → grade → fix → re-run
./dev sim run · ./dev sim follow · ./dev sim assess · (judgment) · (repo work) · ./dev sim run
```

— and every run leaves durable evidence (run record, transcript bundle, checklist,
judge verdict, graded findings) without a single manual wiring step. The simulation
becomes the framework's **runtime CI**: run routinely, not ceremonially.

Four nouns organize everything; the current code has only the first two, implicitly:

| Noun | What it is | Today | End state |
|---|---|---|---|
| **Scenario** | What to test: suite persona × path × optional checkpoint × bound | 13 suites (4 adversarial) exist but nothing enumerates or matrixes them | First-class: listable, matrixed against failure classes, phase-bounded |
| **Run** | One execution: sandbox + background session(s) + parameters | Anonymous — no record of model/suite/bound/session/outcome | Durable record per run, queryable after the session is gone |
| **Verdict** | What came out: mechanical checklist + fresh-context judge | Checklist durable; judge verdict evaporates in the judge session's chat | Both durable, collected into one review bundle per run |
| **Findings** | What to fix, generalized per the Sandbox Problem rule | Ad-hoc chat output | A graded findings file per run, the input to framework fixes |

**Philosophy that must not regress** (from the harness's history): the simulation is
the *instrument*, not the thing under test — skills run faithfully so weaknesses show.
Quality verdicts stay judgment (non-gating); only structural checks are mechanical.
No SDK loop, ever: the removed `conversational_eval.py` proved a re-implemented agent
loop is a green light that proves nothing. And the billing invariant: sessions launch
via `claude --bg` on subscription OAuth; `claude -p` is banned (mis-bills as API,
upstream issue #43333).

**Considered and rejected in the ground-up rethink** (so it isn't relitigated):
a programmatic SDK/API driver (rebuilds the discredited loop, API-billed); a pytest
wrapper around sessions (sessions aren't pytest-shaped; stdlib scripts + bash stay);
replacing sandbox provisioning (it is sound — the grammar around it is the problem);
automated quality gates (judgment stays non-gating); a separate dev-only "sim-driver"
skill (the contributor skill is already always-on here — one more routing surface,
no new content; testing.md rewritten driver-first covers it).

---

## 1. Findings this plan responds to

| ID | Finding |
|---|---|
| F1 | Command grammar is accreted, not designed: `./dev sandbox` mixes provisioning flags (`--simulate`, `--run`, `--brownfield`, `--from=`) with lifecycle subcommands (`review`, `status`, `judge`, `checkpoint`) in inconsistent spellings. The lifecycle a driver actually walks (run → follow → assess) is nowhere visible in the surface. |
| F2 | Runs are anonymous. No record of model, suite, bound, session id, launch time, or outcome. `status` leans on `claude agents`' live registry, which forgets; a sandbox cannot be linked to its historical sessions. |
| F3 | The judge verdict is ephemeral — it lands in the judge session's chat and nowhere else. Grading has no artifact, no template, no home for findings. |
| F4 | Observability is raw: `claude logs` is ANSI soup; nothing answers "where is the run now?" (current phase, last persona exchange, stalled-or-progressing) without hand-spelunking the transcript JSONL. |
| F5 | Kickoff templates are ~100-line JS string blobs inside `seed_simulation.js` — undiffable, unlintable, invisible to skill tooling. (The judge rubric already does this right: a file, `tests/evals/judge-rubric.md`, thin-rendered.) |
| F6 | Coverage exists but can't be exercised at scale: 13 suites including 4 adversarial personas, per-phase descriptors with `success_files`, checkpoints — but nothing lists them with run history, the phase descriptors are dead weight ("a phase-list hint"), and checkpoints go stale silently when the skill corpus moves. |
| F7 | Bounded runs have no bounded contract: `--until=` stops a run mid-path, but the checklist always checks the full-path artifact contract — a clean Product-Brief-bounded run reads as a failing full run. |
| F8 | No operating guide for the *driving agent*: `testing.md` documents mechanics bottom-up; the loop (trigger → follow → assess → grade → generalize fixes) is undocumented, so each future agent re-derives it. |
| F9 | Quota is unmanaged folklore: the sonnet-shakeout/opus-review rule lives in a blockquote; nothing records a run's cost tier or surfaces limit pressure (the 80%-of-weekly incident, 2026-07-05). |
| F10 | Aspirations with no design: interview-me mode (driver plays the user live), cross-run regression comparison. |

---

## 2. Workstream A — The `sim` verb family (grammar maps to the lifecycle)

The driver's lifecycle becomes the command surface. `./dev sandbox` remains the
provisioning primitive (creating a project folder is genuinely a different act);
everything about *running and judging simulations* moves under `./dev sim`. Old
spellings (`sandbox --run/status/judge`) keep working for one cycle, printing a
one-line pointer to the new verb.

**A1 — `./dev sim run [name] [--path=…|--suite=…|--from=…|--model=…|--until=…|--attended|--force]`.**
Provision (delegating to the existing sandbox internals) + seed + launch in one
command. Writes the run record (A2) at launch. `--attended` seeds but does not
launch — it prints the kickoff instructions for a human-at-keyboard session,
replacing today's `--simulate`-without-`--run` usage. Implementation moves out of
the `dev` case-block into `scripts/sim/` (bash, sourced by `dev` — `dev` stays a
router; the 500-line script must not become 900).
*Files:* `dev`, `scripts/sim/run.sh` (new), `scripts/sim/_common.sh` (new; owns `claude_clean`).
*Accept:* one command takes an empty repo state to a launched background session and prints the three follow-up commands; `bash -n` green; old spellings still work with pointers.

**A2 — Run records.**
`.sandboxes/<name>/.simrun/runs.jsonl` (append-only) + `latest.json`: `{run_id, path, suite, model, until, session_id, launched_at, kind: sim|judge, outcome: running|done|stopped}`.
Written by `sim run`/`sim judge`; `outcome` stamped by `sim follow`/`sim assess`.
The checkpoint capture (C3) and review bundle also read it.
*Files:* `scripts/sim/run.sh`, `scripts/sim/_records.sh` (new).
*Accept:* after any launch, `runs.jsonl` has the record; `sim status` works from records + `claude agents` even after the live registry forgets the session.

**A3 — `./dev sim status [name]` / `./dev sim list` / `./dev sim stop [name]`.**
`status`: run record + live session state, JSON, agent-pollable. `list`: all sandboxes with their latest run + outcome (the "what has been proven lately" view). `stop`: stops the recorded session id.
*Files:* `scripts/sim/status.sh` (new).
*Accept:* each verb usable both by a human (readable) and a chat agent (`--json`).

**A4 — `./dev sim follow [name] [--timeout=<min>]`.**
Blocks (poll loop) until the session reaches done/stopped or goes quiet past a stall
threshold, then prints a completion digest: phases completed (`state.json`), commit
count, last persona exchange (from the transcript tail, rendered legibly — not ANSI).
Designed to be the single call a chat driver runs via background Bash after `sim run`.
*Files:* `scripts/sim/follow.sh` (new), small transcript-tail helper in `scripts/render_transcript.py` (expose a `--tail` mode).
*Accept:* `sim run` + `sim follow` is a complete unattended trigger-and-wait; a stalled session is reported as stalled, not waited on forever.

---

## 3. Workstream B — Assessment produces durable evidence

**B1 — Kickoff templates become files.**
Move both kickoff bodies out of `seed_simulation.js` into
`tests/evals/templates/kickoff-setup.md` and `kickoff-delivery.md` with
`{{placeholder}}` substitution, exactly the pattern `judge-rubric.md` already uses.
`seed_simulation.js` becomes a thin renderer.
*Files:* `scripts/seed_simulation.js`, `tests/evals/templates/` (new).
*Accept:* seeded output byte-identical (modulo placeholders) to today's; the templates are plain markdown a reviewer can diff.

**B2 — The judge writes a durable verdict.**
Both judge templates gain a final instruction: write the full verdict to
`.simrun/verdict-<runid>.md` before ending. `sim judge` (relocated from
`sandbox judge`) records the judge run in `runs.jsonl` like any other run.
*Files:* `tests/evals/judge-rubric.md`, delivery judge template (moves to `tests/evals/templates/judge-delivery.md` under B1), `scripts/sim/judge.sh` (new).
*Accept:* after a judge run completes, the verdict exists as a file in the sandbox regardless of who read the chat.

**B3 — `./dev sim assess [name]` — one verb, whole verdict.**
Orchestrates: wait for the sim session if still running (via A4) → render transcript
bundle → run the checklist (bound-aware, B4) → launch the judge and wait → harvest
the verdict → scaffold `findings.md` (B5). Output: one review bundle,
`.sandboxes/<name>-review/{conversation.md, subagents/, checklist.md, verdict.md, findings.md}`.
`sandbox review` remains as the mechanical-only subset (pointer added).
*Files:* `scripts/sim/assess.sh` (new), `dev`.
*Accept:* from a finished run, one command produces the complete bundle; the driver's remaining work is reading and grading, nothing mechanical.

**B4 — Bound-aware structural checklist.**
`sandbox_checklist.py` accepts `--until=<phase>` (read from the run record by
`sim assess`): checks the durable-artifact contract only through that phase, and
reports later artifacts as `(out of bound)` rather than missing. Fold the per-phase
expected artifacts into one explicit phase→artifacts map in the script (superseding
the dead `NN_*.json` `success_files` — delete them or regenerate them from the map,
decide in-slice; two sources of truth is the only wrong answer).
*Files:* `scripts/sandbox_checklist.py`, possibly `tests/evals/scenarios/*/NN_*.json`.
*Accept:* a green Product-Brief-bounded run yields a green checklist; a full-run checklist is unchanged from today.

**B5 — `findings.md` scaffold — grading gets a home.**
`sim assess` seeds a findings file with: run parameters (from the record), verdict
summary line, a findings table (`severity | what the transcript shows | which skill
owns it | generalized fix`), and the Sandbox Problem rule quoted at the top ("fix the
skill for every product, not this product"). Graded findings are the durable output
the fix work cites.
*Files:* `scripts/sim/assess.sh` (template inline or `tests/evals/templates/findings.md`).
*Accept:* the findings file exists per assessed run and the fix-commit convention ("sim finding: <run-id>") is documented in testing.md (D1).

---

## 4. Workstream C — Coverage becomes runnable at scale

**C1 — `./dev sim suites`.**
List every scenario suite with its one-line persona summary, flow path, and last-run
info (join on run records). The adversarial suites stop being a secret.
*Files:* `scripts/sim/suites.sh` (new).
*Accept:* the four adversarial suites and their coverage intent are visible in one command.

**C2 — Checkpoint freshness.**
`sim checkpoint capture` (relocated) stamps `meta.json`: source sandbox, run id,
skill-corpus git sha at capture. `sim checkpoint list` flags checkpoints whose corpus
sha no longer matches `HEAD`'s skill tree (stale = re-harvest candidate). Checkpoints
stay a cache of the last green run — this just makes staleness visible instead of silent.
*Files:* `scripts/sim/checkpoint.sh` (new), `dev`.
*Accept:* capturing then touching any `src/skills/**` file makes `list` flag the checkpoint stale.

**C3 — The coverage matrix, written down.**
A short section in `testing.md`: failure class × suite (cooperative baseline,
ambiguity, reversal, scope-creep, terseness, brownfield, delivery mechanics,
multi-surface) with the recommended cadence per class (bounded sonnet runs routinely;
full opus runs before releases). This is documentation, not tooling — the matrix
earns automation only after several manual cycles prove its shape.
*Files:* `.agents/skills/groundwork-contributor/references/testing.md`.
*Accept:* a driver can pick "what should I run this week" from the matrix without archaeology.

---

## 5. Workstream D — Legible to the next agent (docs, skills, guardrails)

**D1 — `testing.md` rewritten driver-first.**
The flow-testing section leads with **The driver loop** — one screen: the four
commands (`sim run` → `sim follow` → `sim assess` → grade `findings.md`), the model
rule (sonnet shakeout / opus review-grade), the quota rule (bound first runs; check
limit pressure before full flows), the billing invariant. Mechanics (personas,
checkpoints, suites, fixtures, the scaffold harness) follow beneath, restructured but
substantively intact.
*Files:* `references/testing.md`, contributor `SKILL.md` (Dev CLI table + test-infra paragraph).
*Accept:* gate G-1 below.

**D2 — Billing invariant becomes a lint.**
`./dev lint` (or the skills lint script, whichever is cheaper to extend) greps
`dev` + `scripts/` for `claude -p` / `claude --print` and fails with the issue-#43333
explanation. Invariants that live only in comments regress.
*Files:* `scripts/lint_skills.py` or a new `scripts/check_sim_invariants.sh` wired into `./dev ci`.
*Accept:* introducing `claude -p` anywhere in the harness fails `./dev ci`.

**D3 — Memory ↔ repo handoff note.**
The plan's execution status, per the house rule, lives in this file's Status line —
but the *operational* knowledge (how to drive) must live in testing.md, not in any
agent's memory. D1's acceptance is explicitly "a fresh agent with no memory of this
work succeeds from the docs alone."

---

## 6. Workstream E — Proving runs (quota-gated: after the weekly reset)

The harness is only real once it has caught real defects. In order:

**E1 — Bounded pilot.** Greenfield → Product Brief only, sonnet, cooperative suite,
through the full new loop (`run`/`follow`/`assess`/grade). Purpose: shake the driver,
not the skills. *Accept:* the loop completes with zero manual wiring; driver friction found becomes WS-A/B fixes.

**E2 — Full greenfield, review-grade.** Opus, full path, judge + graded findings;
harvest per-phase checkpoints from the green run (C2 stamps them).
*Accept:* findings.md with ≥1 generalized skill finding (history says a full run always yields some); checkpoint set refreshed.

**E3 — Adversarial bounded sweep.** The four adversarial suites × Product Brief
phase, sonnet, bounded. *Accept:* one findings.md per suite; the coverage matrix (C3) updated with what each class actually caught.

**E4 — Delivery-path run.** The `--delivery` sim on the sealed task-capture bet —
this discharges the standing owed items from the user-legibility waves (legibility
rubric is already judge criterion #8; inline-comment round trip observable in the
transcript). *Accept:* verdict + findings filed; owed-sims ledger in memory updated.

---

## 7. Decisions

**Settled by this plan:**

| # | Decision |
|---|---|
| D-1 | Lifecycle verbs live under `./dev sim`; `./dev sandbox` stays the provisioning primitive; old sim spellings alias with pointers for one cycle. Dev-only surface — no migration/changelog obligations. |
| D-2 | Every launch writes a run record; `.simrun/` is the sandbox's run home (gitignored with the sandbox). |
| D-3 | All session-facing templates (kickoffs, judges, findings scaffold) are files under `tests/evals/templates/`, thin-rendered — never JS string blobs. |
| D-4 | Judge verdicts are durable files; assessment is one verb producing one bundle. |
| D-5 | Bounded runs get bounded contracts; the phase→artifact map has exactly one source of truth. |
| D-6 | Quality verdicts stay non-gating judgment; only structure is mechanical. The billing invariant (`--bg` only) is lint-enforced. |
| D-7 | Model tiering: sonnet for shakeout/bounded runs, opus for review-grade — encoded as defaults (`sim run` sonnet, `sim judge` opus) and stated once in testing.md. |

**Open (decide when the trigger arrives):**

| # | Question | Trigger |
|---|---|---|
| O-1 | Scheduled "sim CI" (e.g. weekly bounded sweep) — worth quota? Where scheduled? | After E3 shows what a sweep costs and catches |
| O-2 | Interview-me mode (driver plays the user, turn-relay into a live session) — needs a clean input-injection primitive (`claude attach` is a TTY, not an API). | When the claude CLI grows one, or when adversarial suites stop finding new classes |
| O-3 | Cross-run regression diff (compare two review bundles for the same scenario) | After ≥3 green runs of one scenario exist |
| O-4 | Promote any sim verbs into the shipped workspace-dev-cli for end users | Default no; revisit only on user demand |

---

## 8. Sequencing and gates

```
WS-A (grammar, records, follow)  ──┐
WS-B (assessment pipeline)       ──┼──►  WS-D (docs + lint)  ──►  WS-E (proving runs, post-reset)
WS-C (coverage plumbing)         ──┘         (E1 pilot may interleave with C — pilot needs only A+B)
```

A and B interleave (A1–A2 before B3; B1–B2 anytime). C is independent of both except
C2's use of run records. D lands last so it documents what exists, not what was
intended. E is gated on the quota reset (2026-07-07 20:00 Europe/Stockholm) and on
A+B being merged.

**Definition of done — three gates:**

- **G-1 (one-command loop):** a fresh agent, given only the contributor skill and
  testing.md, takes a clean checkout to a graded findings file using ≤4 harness
  commands and zero manual wiring. (Verified literally in E1: the driving agent must
  not need this plan open.)
- **G-2 (durable evidence):** every run — sim or judge, bounded or full — leaves a
  run record and, once assessed, a complete review bundle (transcript, checklist,
  verdict, findings). Nothing of a run's outcome lives only in a chat window.
- **G-3 (invariants enforced):** `./dev ci` fails on any `claude -p` in the harness;
  bounded runs assess against bounded contracts; checkpoint staleness is visible.
