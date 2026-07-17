# How We Work

Stockroom ships through **work units** — small, shaped batches of work with a
fixed appetite. This file is the team's canon; nothing about process lives
anywhere else.

## The shape

1. **Brief** (`workdocs/<slug>/brief.md`) — the problem, the appetite, what we
   are not doing. Status line moves `Shaping → Agreed → Building → Shipped`.
2. **Plan** (`workdocs/<slug>/plan.md`) — the stages. A stage is a demonstrable
   step; we never start a stage before the previous one is green.
3. **Stage tests** (`tests/workunits/<slug>/test_stage_NN_*.py`) — one file per
   stage, skip-gated (`pytestmark = pytest.mark.skip(...)`) until the stage is
   reached. `./dev test unit <slug>` renders progress: passes are shipped
   stages, skips are the road ahead.
4. **Ship** — `./dev archive unit <slug>` moves the docs to `workdocs/shipped/`
   and the tests to `tests/workunits/_shipped/`.

## Rules

- Progress is what the stage tests say — no separate status tracker.
- One work unit in flight at a time.
- Skills in `.agents/skills/` are a build product of `./dev sync skills`; edit
  `scripts/skill-src/` instead.
- The public site (`content/site` submodule) mirrors shipped briefs; it is not
  the source of truth.
