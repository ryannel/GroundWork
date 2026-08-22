# Carried over from the old GroundWork

This is the port list. It says what must remain true in the rebuild, taken from the
old GroundWork behind the `legacy-final` tag. The old GroundWork was a command-line
program. It installed a set of agent instruction files into a project, kept them
updated as new versions shipped, and generated new projects from templates. This page
carries what the old tests asserted, and the rules that came out of real failures. It
carries no code and no old prose. Workers read this page. Nobody reads the source.
Written 2026-08-22.

## Words used on this page

- **The CLI** — the old command-line program described above. This page calls it that everywhere.
- **Skill** — a folder of instruction files an agent reads. A CLI-owned skill is one the CLI ships and replaces whole on update. An engineer skill covers one technology stack and is only copied into generated projects. A promoted skill is an engineer skill that has landed in a project, which update must preserve.
- **Host** — the agent tool a project is used with. Each host expects a different filename for the same instructions.
- **Operating contract** — the single file holding the numbered rules every skill followed. It carried its own version number.
- **Migration** — a small script that update runs once to fix up an older install. Its registry id is its name in the migration list, and a changelog line names that id.
- **Config healing** — update adding a missing key to a project's config file without touching what the user set.
- **Tracked doc** — a project document that names its source files and the date it was last reviewed, so a check can tell whether it went stale.
- **Surface group** — one named part of what ships into installed projects: the docs, the config, or a single generator.
- **Engine vocabulary** — the old GroundWork's internal words. They must never appear in what a user reads.
- **Harness** — the rig that ran the old GroundWork against itself in real agent sessions, to test it.

## What the CLI test suite asserts

The old suite ran the real command in a scratch git repo and checked what it did.
These are the behaviours it pinned.

### Install

- `init` works in an empty git repo and exits 0.
- `init` writes a skill tree, a config directory, a state file, and a cache directory.
- State records the version of the CLI that wrote it.
- A fresh install starts with nothing marked complete.
- Skills the CLI owns are installed outside the directories agents scan.
- Engineer skills are never installed at the project root. They are only copied into generated projects.
- There is one canonical instructions file. Each host-specific filename is a link to it.
- A host flag wires only the named hosts, and state records which ones were wired.
- A host that reads the canonical files directly gets no extra wiring.
- `init` never overwrites a hand-written host file. It says the file already exists and moves on.
- A seed flag can set config values, but only at first install.
- A seed flag with an unknown or unsafe key exits 1 and leaves no half-written config behind.
- Inside the CLI's own source tree, `init` refuses to deploy and deletes nothing.

### Re-install

- Re-running `init` preserves state, user config, and settings other tools own.
- Approvals merge additively. The user's own entries survive.

### Update

- `update` on a current install says so and changes nothing.
- `update` restores CLI-owned files the user edited or deleted, and reports each one.
- On a version jump, `update` prints a short readable summary, not the raw changelog.
- Entries that need action in an existing install are called out, each naming its registry id.
- A flag prints the complete entries instead of the summary.
- `update` with no install exits 1 with a clear message.
- After `update`, every CLI-owned file matches a fresh install byte for byte.
- User edits, project docs, and project-authored skills survive `update` byte for byte.
- A second `update` changes nothing and re-runs no migrations.
- A copy failure during `update` must not advance the version stamp.

### Check

- `check` exits 0 when the install is healthy and every tracked doc is current.
- `check` exits 1 when a tracked doc is stale, and names it.
- `check` finds tracked docs in the current nested layout and in the older flat one.
- `check` reads a source-of-truth field written as one value or as a list.
- `check` warns when the installed version is older than the CLI's.
- `check` flags a broken policy file and names every missing file it points at.
- `check` rejects unknown policy keys.
- `check` reports CLI-owned files that differ from what `update` would restore.
- `check` never counts promoted or project-authored skills as drift.
- A deleted CLI-owned file is reported as missing and restorable, not as current.
- Submodules are reported as advice, not as a failure.

### Provenance and migrations

- Every file the CLI writes is recorded with its source version and a content hash.
- Recorded hashes must match what is on disk.
- Files that existed before the install are recorded as adopted, not owned.
- An older install with no record gets one on update, classified correctly.
- Provenance for generated files and promoted skills survives update.
- A pending migration runs once and is recorded.
- A failed migration stops the version stamp.
- A dry run lists the plan and changes nothing.
- Config healing only adds. It never rewrites what the user set.
- Every shipped migration reports itself done or not-applicable on a fresh install.

### Junk

- The CLI never copies OS or editor junk into a project, and never records it.
- `update` removes junk an older install left behind.
- Sweeping a shared directory only deletes filenames the CLI itself wrote.

### Conventions the whole suite holds

- Exit 0 means pass. Exit 1 means a real finding. Exit 2 means the check could not run.
- A check that could not run must never look like a clean pass.
- Scans produce leads for a person to judge, never verdicts.
- A generated page carries a marker saying it is generated.
- Regenerating replaces the whole page. It never appends.
- Two runs over the same input produce the same bytes. No timestamps, no absolute paths.
- Bad input degrades to a named placeholder rather than failing the whole page.
- Rendered output shown to a user carries no engine vocabulary.
- A user-supplied name that could escape its directory is rejected before any path is built.

## Rules born from real incidents

Each rule is followed by the failure it came from.

- Never run harness sessions in headless print mode. It bills a subscription run as metered API usage. This applies to any future harness of the same shape.
  - Evidence: `scripts/check_sim_invariants.sh`, which names upstream claude-code issue #43333 and fails the build on any use of print mode.
- A shared directory is not CLI property. A drift check must only compare files the CLI owns.
  - Evidence: commit `aa62ff1`. The check reported 22 false drift hits on a real project that had 0 real edits.
- A missing file must warn. Reporting "current" when a file is gone is a bug.
  - Evidence: commit `aa62ff1`. A deleted CLI-owned file was reported as current, so nobody knew update would put it back.
- Do not bake one language's layout into a general check. Detect the structure instead.
  - Evidence: commit `a48dda8`. Readiness gates assumed a JavaScript test path and so failed correctly delivered Swift work.
- Discovery must handle the current layout and the old one. Finding nothing is not the same as finding no problems.
  - Evidence: commit `706d197`. A real project reported 0 tracked docs. After the fix it reported 20.
- A frontmatter reader must accept both a single value and a list.
  - Evidence: commit `706d197`. Docs that wrote their sources as a list were silently filed as unassessed.
- Never copy OS or editor junk into a user's project. Filter at every copy and record none of it.
  - Evidence: commits `5660f01` and `0c5cb7b`. The way in was a linked development checkout. The package's ignore rules do not run there.
- When cleaning a shared directory, only delete filenames the CLI itself wrote.
  - Evidence: commit `5660f01`. A broad junk sweep would have deleted the user's own editor backup files, which sit in the same directory.
- A coverage gate must scope each check to what it covers. One blanket annotation must not cover every change at once.
  - Evidence: commit `56b9220`. One change passed the gate on another change's annotation.
- Check that your path patterns actually match nested paths.
  - Evidence: commit `6e97db3`. A glob stopped at the first directory boundary, so template changes were invisible to the gate.
- A long external command needs a timeout and an output limit. A killed or truncated run must fall back, never report a partial tally.
  - Evidence: commit `ce7b688`. An unbounded test run could hang or overflow its output buffer, and the half-finished output was counted as a result.
- Derive a state from the thing that actually moves. A file that lands once tells you nothing by its commit count.
  - Evidence: commit `ce7b688`. Progress was read from commits on a file written once at the start, so every step looked the same.
- If a setting must stick, write it where it can actually be written. A per-user file behind a directory symlink fails silently.
  - Evidence: commit `a743ebf`. Every session re-asked the same approval, because the answer was saved to a path the symlink made unwritable.
- Do not open a browser window as a side effect of starting a background tool.
  - Evidence: commit `a743ebf`. A background code-intelligence server popped open a dashboard tab on every launch.
- A value that changes with the theme cannot live in one field. One field silently loses one theme. An elevation value — the shadow token that makes a surface read as raised — is such a value.
  - Evidence: commit `d719268`. The built-in fallback changed with the theme. A custom value did not. So supplying your own was worse than supplying none.
- When a schema grows a richer shape, a partial one must degrade to something that works.
  - Evidence: commit `d719268`. An elevation setting that named only the light theme left the dark theme with no depth at all, instead of falling back.
- A stall detector must re-check the live process before declaring a stall. A sticky flag turns one slow turn into a dead run.
  - Evidence: commit `f573397`. One long silent turn marked a session stalled, and the mark never cleared even though the session was still alive.
- Keep the machine awake for the length of an unattended run.
  - Evidence: commit `f573397`. The machine slept and killed a session mid-response.
- Name the exact key a record uses. If the text names only the values, writers invent the key.
  - Evidence: commit `999c6a8`. A run wrote `status` where the fixture expected `state`.
- Install a build's tools before the step that needs them. A missing tool can fail quietly and break a later step.
  - Evidence: the comment in `.github/workflows/integration.yml`. Without the package manager on the path, the install produced no lockfile, and the container build failed much later.
- Pin a runtime dependency that only arrives by accident.
  - Evidence: `src/generators/python-microservice/files/pyproject.toml.template` pins `greenlet>=3.0.0`. The async database engine needs it, does not always pull it in, and without it every async database call failed.
- Publishing tools have their own version floor. Install the version you need.
  - Evidence: the comment in `.github/workflows/release.yml`. Trusted publishing means the CI job publishes under its own identity, with no stored token. It needed npm 11.5.1 or newer. The runtime shipped an older one.

## The four boundary-linter configs

Four configs enforced architecture as a build failure rather than a convention.

### Go core, enforced by depguard under golangci-lint

- Files under `internal/core/**` must not import any adapter package: `internal/postgres`, `internal/kafka`, `internal/pubsub`, `internal/httpclient`, `internal/websocket`, `internal/llm`, `internal/entrypoints`.
- The core must not import `database/sql` or `net/http`.
- The core must not import a router, an API framework, a database driver, a queue client, or a websocket driver.
- Files under `internal/core/domain/**` must not import anything else in the module. Pure types and rules only.
- Adapters and the composition root under `cmd/` may import anything.
- Dependencies run from adapters into the core, never the other way. An import that goes outward fails the lint run.

### Python core, enforced by import-linter

- The package's `core` module must not import the `adapters` module or the `entrypoints` module.
- The `core` module must not import the web framework or the database library.
- The contract is checked by `lint-imports`, in CI and before commit.

### Electron processes, enforced by ESLint

- Files under `src/renderer/**` must not import `electron`.
- Files under `src/renderer/**` must not import Node built-ins: `node:*`, `fs`, `path`, `os`, `child_process`, `crypto`, `net`, `http`, `https`.
- The renderer reaches the rest of the app only through the bridge the preload layer exposes.
- Files under `src/shared/**` carry contract types only. The same two bans apply there.
- The split is enforced by directory. Lint fails the build when an import crosses it.

### Design tokens in the web app, enforced by ESLint

- A component must not carry a raw hex colour in an inline style.
- A component must not carry a raw pixel or rem length in an inline style.
- A component must not carry a raw CSS gradient in an inline style.
- A component must not use an arbitrary utility value for colour, length, shadow, blur, or gradient.
- Token utilities and CSS variable references pass.
- The file that defines the tokens is not linted by this rule.

## CI parity

- CI runs on every pull request and on every push to the main branch.
- Runs for the same branch cancel each other. Only the newest survives.
- Four jobs run at the same time, split by toolchain: lint, CLI, generation, compilation.
- One local command reproduces the whole gate. It is the single reproduction command.
- The lint job runs three checks: skill conformance, harness invariants, and source-hash anchors.
- The CLI job runs the contract tests and the whole CLI suite.
- The generation job runs structural generation tests across every option combination.
- The compilation job compiles the generated projects. It is the only job that pays for the heavy toolchains.
- All four jobs must pass. They block merges.
- A source-hash anchor records the hash of each file a skill mirrors. Editing the source fails CI until someone reviews the skill.
- Every migration must be exercised by a frozen fixture of an older install.
- A change to what ships into installed projects must carry a changelog annotation scoped to that surface group. A path with no surface group fails closed.
- Suites run in parallel. Each test works in its own directory, so nothing is shared.
- A fast local gate runs a subset of CI. It is cheap enough to run on every change.
- The heavy end-to-end lane is separate. It boots the real stack, runs nightly and on demand, and does not block pull requests.

## The release pipeline

- Publishing is triggered only by pushing a version tag.
- Before publishing, the tag must match the package version.
- Before publishing, the changelog must have a section for that exact version.
- The full CI gate runs before publish. Nothing publishes on a red build.
- Auth is trusted publishing: the CI job's own identity earns a short-lived credential, and no publish token is stored anywhere.
- The publish attaches build provenance.
- Three version points must agree: the package version, the version stamped into installed projects, and the operating contract version.
- The contract version bumps only on a breaking change, and that bump needs a migration.
- Changelog entries that need action in an existing install are marked, and `update` surfaces them on a version jump.
- Every marked entry names a registry id, and every migration needs a changelog line. Both directions are checked.
- One release channel. A pre-release channel was considered and deliberately not cut.
- The short package name was taken by someone else. The package shipped as `groundwork-method` while the command stayed `groundwork`.

## What was left behind

Most of the old rules were ordinary design opinion, written into skill prose with nothing
marking where they came from. The legacy branch kept no incident ledger, so a rule and a
preference read the same. Only rules with a named failure behind them are above. Anything
uncertain was left behind on purpose. A later finding can pull one back.

One rule was dropped in review: "an invariant that lives only in a comment will regress."
The old repo asserted it but named no failure it came from, so there was nothing to carry. A "no dry-run gate" line about the release pipeline was dropped the same way: the old repo gave no reason for it.

Also left behind: all implementation, all skill and plan prose, the generator templates,
and the harness itself. What those tests assert is above. How they did it is not.
