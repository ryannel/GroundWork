# Model rebuild

The specification is [design.md](design.md) (revision 3), [rebuild.md](rebuild.md) (revision 2) and
[requirements.md](requirements.md). Work on one PR at a time in an isolated worktree. Stop after opening
it for review; never merge or push to main. Reconfirm design §10.2 with the user before PR 9.

## PR 1 proof commands

Run `npm run workspace -- list` first. The commands select the registered workspace by its explicit id;
they never infer its folder from `workspaces/`.

```sh
npm run rebuild:inventory
npm run rebuild:parity
npm run build
npm run rebuild:baseline -- --workspace personal --out artifacts/rebuild/baseline/personal
npm run rebuild:compare -- --before artifacts/rebuild/baseline/personal --workspace personal
```

`baseline` starts and stops its own production server. `--origin http://127.0.0.1:<port>` selects an
already running production build instead. The server and command must use the same registered workspace
folders. `--as-of YYYY-MM-DD` records the model comparison date; it does not rewrite authored dates or
freeze the site's clock. Date-dependent standing can therefore legitimately differ in a later session;
those differences still need an explicit reason.

`--routes <baseline directory>` reuses a saved manifest's route selection for a capture. The default
selection includes representative domain/system, area, thing, journey, reference and explorer routes,
every loaded plan's cover and first screen of each chapter, its model JSON and all available revisions.
The full facts snapshot includes every entity, not only those selected routes. The compare also samples
newly selected routes, so an added route cannot silently escape comparison. Optional surfaces can return
404; their recorded statuses remain part of the proof. Server errors fail capture.

Each baseline contains `manifest.json`, `facts.json.gz` and one compressed JSON record per selected route.
Compression is lossless. HTML records retain status, headings, internal links including query/hash, visible
text, inspectable ids and actual uncompressed HTML bytes. JSON routes retain their complete response.
The facts include complete before/after graphs for each loaded plan, caller and handler effects, messages,
store access, owners, code attribution and repository state, all area view models and their code-home
links. Broken plans remain explicit records rather than disappearing. Derived functions are queried and
their results stored; functions never enter the snapshot.

`compare` fails on every unexplained changed JSON pointer. Its `comparison.json` gives the file, pointer
and hashes of the exact before/after values. Add only reviewed changes to
`artifacts/rebuild/allowed-diffs.yaml`, with `workspace`, `file`, `path`, `before`, `after` and `reason`.
An approval for a different workspace or later value does not match. `--allowed <file>` selects another
approval file; `--out <directory>` retains the comparison capture (otherwise it uses a temporary folder).
Missing or malformed approval files fail closed. The baseline command refuses an existing completed baseline, and compare refuses to write over its own baseline, including through a directory symlink. Keep the PR 1 baselines unchanged in later PRs.

The inventories are deliberately conservative candidate lists with file/line evidence. Consumer rows
start as `adapter`; this PR claims no completed migration or retirement. The JSON inventories retain every
matched line; the consumer Markdown groups those lines per file and lists package scripts separately.
The id/URL Markdown lists each matched site, including fixture literals, so later PRs can distinguish
fixed literals from construction and parsing. Generated artefacts, ignored reports and dependency folders
are excluded. The explorer report lists planned destinations, not parity proof: every unproven row still
blocks retirement, especially arbitrary method flows, source text and reviewed Inferred context.

## Acme and local registration

Acme is maintained as TypeScript in `test/fixtures/acme`, not as a workspace folder. Materialise it with
the same writer used by the reader integration tests:

```sh
npm run rebuild:acme -- --out .workspaces/rebuild/acme
```

For these captures, the worktree's ignored `groundwork.local.yaml` lists that generated Acme folder and
`/Users/RNEL/Workspace/volvo-groundwork`; the bundled Personal example remains enabled. Register all three
before building/capturing. The fixture and its writer are committed, so no later session depends on this
session's generated folder. Volvo is read only in code PRs.

## Worktree checks

On this machine, Knip's broad file discovery stalls when Git reports the shared hooks outside a worktree.
Copy those unchanged hooks into the worktree, then override only their discovery path for the check:

```sh
mkdir -p .workspaces/rebuild/hooks
cp /Users/RNEL/Workspace/groundWork/.git/hooks/pre-commit .workspaces/rebuild/hooks/
cp /Users/RNEL/Workspace/groundWork/.git/hooks/pre-push .workspaces/rebuild/hooks/
cp /Users/RNEL/Workspace/groundWork/.git/hooks/prepare-commit-msg .workspaces/rebuild/hooks/
python3 - <<'PYHOOK'
from pathlib import Path
hook = Path('.workspaces/rebuild/hooks/pre-push')
clear = 'unset GIT_DIR GIT_WORK_TREE GIT_INDEX_FILE GIT_COMMON_DIR GIT_PREFIX GIT_OBJECT_DIRECTORY GIT_ALTERNATE_OBJECT_DIRECTORIES GIT_IMPLICIT_WORK_TREE'
hook.write_text(hook.read_text().replace('#!/bin/sh\n', '#!/bin/sh\n' + clear + '\n', 1))
PYHOOK
GIT_CONFIG_COUNT=1 GIT_CONFIG_KEY_0=core.hooksPath GIT_CONFIG_VALUE_0=.workspaces/rebuild/hooks npm run check
```

The local pre-push copy clears inherited Git repository identity variables before running the existing hook commands. Otherwise Git-fixture tests use the outer worktree metadata even after changing directory. This runs the existing configurations and checks unchanged. The override is process-local; Git configuration
and the main checkout's hooks stay untouched. See `artifacts/rebuild/pr1-handoff.md` for results and input pins.
