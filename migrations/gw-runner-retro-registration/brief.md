# gw-runner-retro-registration — register surfaces and native sidecars as `./dev` runners

`./dev` gained a **runner registry**: native processes (surfaces like an Electron/CLI/Flutter
app, and native sidecars like a Metal/MPS Python service) are declared in
`.dev/dev.config.json` under `runners` so `start`/`stop`/`status`/`logs` manage them.
Surface and sidecar generators now self-register. Projects scaffolded before this have a
runner-less `dev.config.json`, so their non-container apps are invisible to `./dev` —
`./dev start` cannot launch them and `./dev status` cannot see them.

## Detect

- **Applies** when `.dev/dev.config.json` exists and the workspace has at least one
  surface or native sidecar that is **not** a docker-compose service and has **no**
  matching entry in the config's `runners` array — e.g. an `electron-app` /`cli-app`
  /`flutter-app` under `services/`, or a Python service run natively, with nothing
  registered for it.
- **Already done** when every such surface/sidecar already has a `runners` entry (the
  field may simply be absent on a workspace that genuinely has only containers — that
  is the empty case, not an owed migration).
- **N/A** when there is no `.dev/dev.config.json` (not a workspace-dev-cli project), or
  the workspace has no surfaces and no native sidecars (a pure container stack).

## Transform

For each surface and native sidecar that lacks a runner, add one entry to the `runners`
array in `.dev/dev.config.json`:
- `name` — unique, the service/app directory name;
- `kind` — `surface` for an app the user interacts with, `sidecar` for a backing native process;
- `cmd` — its dev launch command (e.g. `npx nx run <app>:serve` for a surface, the
  service's native run command for a sidecar) with `cwd` relative to the repo root;
- `autostart` — `true` for a long-lived process `./dev start` should bring up; `false`
  for a CLI invoked ad hoc.

Prefer re-running the surface/sidecar generator where it exists — its self-registration is
the authoritative shape — over hand-writing entries. Preserve any existing `runners`
entries and all other config fields.

**Invariant:** this registers what already exists; it never adds or removes
docker-compose infrastructure. Leave the project's `db`/`jaeger` compose exactly as
found unless the user explicitly asks to make it on-demand — that is a separate, opt-in
change, not part of retro-registration.

## Accept

- Every active surface and native sidecar appears in `.dev/dev.config.json` `runners`
  and in `./dev status` (probe `./dev status --json` → `runners`).
- The `docker-compose.yml` is byte-unchanged.
- One commit, referencing `gw-runner-retro-registration`.
