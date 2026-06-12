# 03. Maintenance

Documentation in GroundWork is not a separate maintenance phase — it is continuously kept current by mechanisms embedded in the lifecycle itself. Five layers cooperate:

1. **Living Documents** (in-flight) — every phase and bet updates upstream docs surgically when new information surfaces.
2. **`groundwork-update`** (on-demand) — surgical, in-place doc patches when code ships outside the bet workflow.
3. **`groundwork-patch`** (on-demand) — the small-change code lane: one bounded user-facing goal, tested, doc-passed, and logged to `docs/bets/patch-ledger.md` so clustering patches surface as a bet signal instead of silent scope creep. Contract or schema changes never qualify — those are bet-scoped.
4. **`groundwork-surface-activation`** (on-demand) — the lifecycle event for adding a surface to a live product: register it, run its interface type's design track if missing, scaffold (or record `scaffold: manual`), and triage every capability ledger row's new column so the sync decision is made once and recorded. On a pre-restructure product with GroundWork docs but no registry, it bootstraps `docs/surfaces.md` first.
5. **`groundwork-check`** (CI) — automated drift detection comparing doc `last_reviewed` dates against the Git history of declared source files, plus surface registry and capability ledger signals.

## Living Documents

The primary maintenance mechanism. Every methodology skill loads the Operating Contract, which defines:

> All `docs/` artifacts are living documents. Any phase, any bet, any conversation: if new information surfaces that refines an existing document, update it immediately. Surgical and targeted. Do not ask for permission. Report what changed.

Concretely, every commit step in every phase ends with a Living Documents scan: the agent reviews the just-completed conversation for anything that refines an upstream `docs/` artifact, applies the update directly, and reports the change in one line per affected document.

This is the back-feed mechanism that prevents the documentation tree from going stale. A bet that adds a new service updates `docs/architecture.md` at Validation; an architecture conversation that surfaces a new user type updates `docs/product-brief.md` at commit. The user does not have to remember to keep documents in sync — the protocol does.

## `groundwork-update`

Used when code ships outside the normal bet workflow — direct edits, refactors, or fixes that bypass the bet pipeline. The skill performs lightweight, in-place modifications to specific `docs/` artifacts based on the diff. It does not re-scan the whole repository.

This is the explicit, user-invoked counterpart to the implicit Living Documents updates that happen automatically inside the bet workflow. Both protocols write surgical changes; the difference is the trigger.

## `groundwork-check`

The drift detector. Designed to run in CI so the team is told when documentation has fallen behind code.

The mechanism:

- Every architecture or infrastructure document declares its underlying source files via a `source_of_truth` frontmatter property.
- The document also declares a `last_reviewed` date.
- `groundwork-check` compares the Git modification timestamps of the declared source files against `last_reviewed`. When the code is newer, the document is mathematically stale and flagged.

This makes documentation drift visible and addressable rather than silent. A flagged document either gets updated (via `groundwork-update` or the next bet's Validation) or has its `last_reviewed` date refreshed to acknowledge that the current content is still accurate.

### Surface signals

Beyond date-based staleness, `groundwork-check` reads the surface registry and capability ledger:

- **Twin drift** — `docs/surfaces.md` and `.groundwork/surfaces.json` disagree on the surface set, a status, or a cell's state.
- **Empty ledger cells** — a capability row missing a decision for a registry surface; the one illegal ledger state, meaning a bet closed past its validation gate.
- **Stale planned intent** — a `planned` cell older than three closed bets with no referencing pitch: intent that no longer reflects a plan.
- **Untested active surface** — an `active` surface absent from the system-test `surfaces` fixture or carrying no test medium.
- **No registry** — GroundWork docs exist but no `docs/surfaces.md`: a pre-restructure adoption, pointed at `groundwork-surface-activation`'s registry bootstrap (advisory, not blocking).

Retired surfaces are excluded from every staleness and backlog count — a retired column is frozen history, never backlog.

### Current state

`groundwork-check` exists as a registered skill at `src/skills/groundwork-check/`. The `source_of_truth` and `last_reviewed` frontmatter conventions are defined, and the scaffold skill stamps them into every generated service and API doc (`groundwork-scaffold` phase 3), so drift detection works from the first commit of a greenfield project.

Until the scaffold generators populate the frontmatter, `groundwork-check` runs against an empty source-of-truth graph. Closing this gap is part of the Brownfield work tracked in `TODO.md`.

## What gets maintained vs. what gets replaced

Living Documents and `groundwork-update` are for *refinement* — updating an existing document to reflect new reality. They are not for wholesale rewrites or structural overhauls.

When a document needs a full structural rewrite (e.g., the system has been re-architected at a level the existing document cannot represent), the right path is to re-run the corresponding setup phase against the current state — not to keep patching the old document. This case is rare in greenfield projects (the docs evolved alongside the system); it becomes more relevant once brownfield is implemented.
