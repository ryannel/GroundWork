# The Migration Registry

The registry is the framework's **mechanical** update lane: small, scripted, deterministic
file operations that bring an installed project's plumbing to the current shape — seeding a
file `init` now writes that `update` once didn't, deleting an artifact a redesign retired,
registering an MCP server. Every entry is a `cli` migration.

**Structural and judgment-bearing advancement is not here.** How a project's bets are laid
out, where its architecture docs live, what its published docs may contain — these move
through the **`groundwork-update` skill's reconcile pass**, which compares each artifact
family against the framework's current canonical and advances divergent instances with
agent judgment (no per-change migration, no change-tracking). Add a registry migration only
when the change is a mechanical file op; when it needs judgment about the user's content,
it belongs to a Family Index entry in the `groundwork-update` skill instead.

The changelog's `[migration]` line stays — for humans — but it names an entry here, and the
tooling cross-checks both directions (a contract test fails when either side is missing).

## Format

`index.json` lists entries in execution order:

```json
{ "id": "gw-seed-config-toml", "version": "0.10.0", "title": "…", "kind": "cli", "summary": "…" }
```

- `id` — stable, kebab-case, `gw-` prefixed. Referenced from the changelog line as
  `[migration] … (gw-seed-config-toml)`.
- `version` — the package version that ships the migration.
- `kind` — always **`cli`**: a CommonJS module at `migrations/<id>.js` exporting
  `detect(ctx)` and `run(ctx)` that `npx groundwork-method update` runs.

## Rules (all migrations)

- **Forward-only.** Projects do not downgrade frameworks; there are no down-migrations.
- **Detect-first.** `detect(ctx)` returns `"pending"`, `"done"`, or `"n/a"` and MUST be
  read-only — `update --dry-run` calls it. `run` is only invoked on `pending`.
- **Idempotent.** Running twice must be a no-op; a crashed update re-runs safely.
- **Self-contained.** The module imports nothing from `bin/` — it receives
  `ctx = { targetDir, packageRoot }` and uses only Node built-ins.

Completions are recorded in the project's `state.json` under `groundwork.migrations`;
recorded entries are never asked again (so a user who reverts a migration's effect on
purpose is respected). A fresh `init` records the entire registry as settled — a new
install needs no catch-up.

## Authoring checklist

1. Copy `_template/cli-migration.js`; pick an `id`.
2. Add the entry to `index.json` at the unreleased version.
3. Add the `[migration] … (<id>)` line to the changelog's Unreleased section.
4. Add or extend a fixture under `tests/fixtures/installs/` that exercises the
   migration from the shape it migrates, and cover it in `tests/cli/`.

If the change needs judgment rather than a deterministic file op, do **not** author a
migration — add or extend a family in the `groundwork-update` skill's Family Index, where
the reconcile pass will pick it up against the current canonical.

`GROUNDWORK_MIGRATIONS_DIR` overrides the registry location — a test seam for
exercising the runner with synthetic migrations.
