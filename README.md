# Groundwork

Portable repository plans with a live standalone viewer, a central local dashboard, and matching CLI/MCP authoring tools. The viewer retains the existing brief, journey, design, system flow, API, data model and test coverage views, and adds user-visible deliverables, component tasks, layered validation and Git activity.

## Direction and history

Groundwork now centres on repository-owned product plans and the **Feature → Deliverables → Tasks** workflow. Multiple repositories can appear together in one local dashboard, while each keeps its own plans and Git context.

The previous rebuild is preserved at the [`v2` tag](https://github.com/ryannel/GroundWork/tree/v2), pointing to `22796e8cf06fa7c2ec0b45e5df0535211c508c94`. This implementation replaces the files on `main` in a follow-on commit, preserving the earlier history. Existing branches and release tags remain available. The `v2` tag names the archived direction; the current local package is `groundwork-v2` version `0.4.12`.

## Develop the tooling

```sh
npm install
npm run dev
npm test
npm run lint
npm run build
```

Vite development mode retains the Word Loop example dataset in `content/` when no API is present. Packaged viewers load repository documents through the local service. `npm run build` checks schemas, compiles the viewer and emits the Node runtime. Node 22.18+ is required.

## Install in an application

This package has not been published to npm. Build a local tarball:

```sh
npm pack
```

Copy `groundwork-v2-0.4.12.tgz` into the app's `vendor/` directory, then run there:

```sh
npm install --save-dev ./vendor/groundwork-v2-0.4.12.tgz
npx --no-install groundwork-v2 init --name "My app"
npx --no-install groundwork-v2 start
```

Keep the tarball, lockfile and `.groundwork/plans/` in the application repository so a fresh clone can run `npm ci` and open the same committed plans. The compiled viewer and styles come from the package. Do not copy the Groundwork source into the app.

The first consumer is `../tellourstory`, intended for https://tellourstory.xyz/. The local planning service is separate from the future public product deployment.

## Central dashboard and agent access

```sh
npx --no-install groundwork-v2 register --workspace Personal
npx --no-install groundwork-v2 dashboard
npx --no-install groundwork-v2 read
npx --no-install groundwork-v2 validate
npx --no-install groundwork-v2 mcp
```

The central dashboard groups registered repositories using local configuration and discovers linked Git worktrees. Each checkout has its own URL and explicit branch context. A branch selector opens committed refs without switching the working copy. Independent clones need explicit registration. Git activity is observed locally; the service never fetches or publishes.

CLI `call` and MCP expose the same operations: project discovery, reads, atomic document writes, feature creation, deliverable/task planning, progress/evidence recording, branch linking and explicit worktree creation. Writes require both a document revision and checkout context. Interrupted writes have recovery journals; malformed external edits retain the last valid viewer snapshot.

See [the portable authoring guide](docs/PORTABLE.md) for the format, MCP setup and recovery behaviour. The [legacy content guide](docs/CONTENT.md) describes the original example format.

## Migration fixture

The [Word Loop import review](docs/wordloop-meeting-recording/REVIEW.md) records source disagreements and evidence limitations. The portable supplement preserves 11 deliverables, 28 component tasks and frozen source records. To export it into a new test repository without changing the original docs:

```sh
node bin/groundwork-v2.js export --source content --target /tmp/wordloop-groundwork \
  --name "Word Loop" --assets public/images \
  --supplement docs/wordloop-meeting-recording/portable
node bin/groundwork-v2.js serve /tmp/wordloop-groundwork --port 4318
```

Tests exercise schema and reference validation, migration, concurrent writers, stale revisions, branch switches, interrupted transactions, external edits, worktree discovery, origin/token checks and filesystem isolation. Local HTTP integration tests require permission to bind a localhost port.

## Hub and project startup

From a project with Groundwork installed, run `npm run plans:start` to start or reuse Groundwork Hub and get the URL for that project's workspace. Run `groundwork-v2 instructions` after upgrading to add the project scripts without replacing existing commands.

`npm run plans:hub` opens the Hub entry point; `npm run plans:standalone` starts a project-only viewer without a Hub. Commands print a clickable URL. The terminal that starts the server owns its lifetime; keep it open and press Ctrl+C to stop it. Later commands reuse the same server and exit. The default ports are 4318 for Hub and 4317 for standalone; use `--port` explicitly when needed.

The Hub serves all project workspaces itself. Each repository keeps its own plans, assets, revision checks and checkout context. No project application servers are needed to view plans.
