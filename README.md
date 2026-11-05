# Groundwork

The systems a company runs, and the plans that change them.

```sh
npm install          # also installs the git hooks
npm run dev          # http://localhost:3000
npm run check:begin  # record the task’s starting point; preserves existing edits
npm run check:quick  # check only changes since that point, with timings
npm run test:web     # website tests
npm run test:scan    # scanner and command-line tests
npm run check        # full merge checks, including coverage and architecture
npm run build        # then npm start serves it
```

`npm run dev` recompiles each page on its first visit and after every source change. To read workspaces rather
than change Groundwork, `npm run build` then `npm start` is much faster.

For an explicit scope, use `npm run check:quick -- src/features/workspace/component-cards.tsx`.
Use one task per checkout. Full checks remain required for shared logic and tooling changes, and before
merging; see [the development checks](docs/architecture.md#focused-development-checks).

Each workspace is its own repo of YAML: the systems a company runs today and the plans that change them.
`workspaces/` holds bundled examples, not the list of available company workspaces. Clone Groundwork, then link whichever workspace repos you want to read; each
checkout keeps its own list in `groundwork.local.yaml`, which is not in git. The `groundwork-workspace` skill
walks you through it:

```sh
npm run workspace -- add git@github.com:acme/acme-groundwork.git   # clone it into .workspaces/ and read it
npm run workspace -- add ../acme-groundwork                        # or read a folder you already have
npm run workspace -- new ../beta-groundwork --id beta --name "Beta" --private   # make a new one
npm run workspace -- pull      # clone what is missing and update the linked repos
npm run workspace -- list      # names, ids, folders, registration sources and app paths
npm run --silent workspace -- list --json   # pure JSON, without npm's banner, for agents and scripts
npm run workspace -- open acme     # open its workspace root; --origin for a different server
npm run workspace -- remove acme
```

Reload the page after linking; no dev-server restart is needed. The library lists company workspaces and
examples separately. Every workspace and plan page has a workspace switcher; local linking details are
available on the library cards in development and are not exposed in production.

Linking also installs the workspace repo's pre-commit hook. Pages do not validate plans as they draw them; they
trust the check each plan passed when it was written (`npm run plan:base -- check <plan>`), so the hook refuses a
commit whose workspace fails `npm run workspace -- check`, or whose staged plan has changed since its check.

Start workspace-backed work with `npm run workspace -- list`, not a search of `workspaces/`. The workspace id
comes from `workspace.yaml`, not the folder name. With more than one workspace registered, map and plan-base
commands require `--workspace <id>`; they print the selected name, id and folder to stderr, preserving JSON
on stdout. `GROUNDWORK_WORKSPACES` still overrides both local links and examples for a scoped server.

To read the same workspaces on another machine, link their repository URLs there, or copy a URL-based
`groundwork.local.yaml` and run `pull`. Folder-only entries point to this machine and must be relinked if their
paths differ. Keep each workspace's model and plans together; code checkouts and disposable scan caches live
elsewhere and are referenced, not copied into the workspace.

See `docs/architecture.md` for how the code is laid out and how workspaces are found.

Each workspace's `MAP.md` is a generated index of its systems; `npm run map -- find|show|callers|calls|owns|repos`
queries it. Agents scan repos into the map, answer questions from it and write plans with the skills in
`.agents/skills/` (see its `README.md`).
