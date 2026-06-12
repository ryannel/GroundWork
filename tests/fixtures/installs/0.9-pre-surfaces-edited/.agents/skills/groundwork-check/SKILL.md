---
name: groundwork-check
description: Analyzes GroundWork architecture docs for staleness against the codebase by checking git logs for `source_of_truth` paths since `last_reviewed`. Designed to run in CI.
---

# GroundWork Check Skill

The full staleness workflow lives in `instructions.md`, colocated with this file; load it when invoked.

## Doc-Type Behaviours

Different doc types have different drift semantics. Apply these rules when scanning `docs/`:

### `docs/principles/**` and `docs/ways-of-working/**`

These are project-stable docs not derived from code. Do **not** flag them for code drift. Do surface a low-severity advisory (not a build failure) for any file whose `last_reviewed` date is more than 12 months old. Advisory format: "Advisory: `<path>` has not been reviewed in over 12 months — consider a manual review pass."

### `docs/domain/<entity>.md`

Entity docs should reflect the domain as it appears in code. When discoverable (schema migration files, model definitions), compare entity names found in code against the names of files in `docs/domain/`. Flag two conditions as warnings:

- An entity file exists in `docs/domain/` but no corresponding code definition can be found — possible deletion or rename.
- A code definition exists but no entity file exists in `docs/domain/` — the architecture phase may have missed it, or a bet added it without documentation.

Do not fail the build on domain mismatches — these are advisory warnings requiring human judgement.

### `docs/decisions/NNNN-*.md`

ADRs are append-only historical records. Do **not** check for code drift. Do check:

- Numbering is sequential with no gaps (0001, 0002, 0003, ... with no missing integers).
- Every file's `status` frontmatter field is either `accepted` or begins with `superseded by`.

Report numbering gaps and invalid statuses as build failures — they indicate a corrupted ADR history.

### `docs/services/**`

Out of scope for the current check implementation.
