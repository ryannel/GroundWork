# The Migration Registry

Every framework change that touches an installed project ships with a migration. The
changelog's `[migration]` line stays — for humans — but it names an entry here, and the
tooling cross-checks both directions (a contract test fails when either side is missing).

## Format

`index.json` lists entries in execution order:

```json
{ "id": "gw-seed-config-toml", "version": "0.10.0", "title": "…", "kind": "cli", "summary": "…" }
```

- `id` — stable, kebab-case, `gw-` prefixed. Referenced from the changelog line as
  `[migration] … (gw-seed-config-toml)`.
- `version` — the package version that ships the migration. `update` uses it to gate
  agent migrations against the install's stamped version.
- `kind` — who executes it:
  - **`cli`** — mechanical. A CommonJS module at `migrations/<id>.js` exporting
    `detect(ctx)` and `run(ctx)`; `npx groundwork-method update` runs it.
  - **`agent`** — judgment. A brief at `migrations/<id>/brief.md`; `update` copies it
    into the project's upgrade brief and the `groundwork-upgrade` skill executes it
    conversationally.

## Rules (all migrations)

- **Forward-only.** Projects do not downgrade frameworks; there are no down-migrations.
- **Detect-first.** `detect(ctx)` returns `"pending"`, `"done"`, or `"n/a"` and MUST be
  read-only — `update --dry-run` calls it. `run` is only invoked on `pending`.
- **Idempotent.** Running twice must be a no-op; a crashed update re-runs safely.
- **Self-contained.** A `cli` module imports nothing from `bin/` — it receives
  `ctx = { targetDir, packageRoot }` and uses only Node built-ins.

Completions are recorded in the project's `state.json` under `groundwork.migrations`;
recorded entries are never asked again (so a user who reverts a migration's effect on
purpose is respected). A fresh `init` records the entire registry as settled — a new
install needs no catch-up.

Agent briefs carry three required sections — **Detect**, **Transform**, **Accept** —
written as intent and invariants, not scripts. Start from `_template/`.

## Authoring checklist

1. Copy `_template/` (brief) or `_template/cli-migration.js` (script); pick an `id`.
2. Add the entry to `index.json` at the unreleased version.
3. Add the `[migration] … (<id>)` line to the changelog's Unreleased section.
4. Add or extend a fixture under `tests/fixtures/installs/` that exercises the
   migration from the shape it migrates, and cover it in `tests/cli/`.

`GROUNDWORK_MIGRATIONS_DIR` overrides the registry location — a test seam for
exercising the runner with synthetic migrations.
