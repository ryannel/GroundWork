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

For an explicit scope, use `npm run check:quick -- src/features/workspace/component-cards.tsx`.
Use one task per checkout. Full checks remain required for shared logic and tooling changes, and before
merging; see [the development checks](docs/architecture.md#focused-development-checks).

Each workspace is its own repo of YAML: the systems a company runs today and the plans that change them.
`workspaces/` holds two examples. Clone Groundwork, then link whichever workspace repos you want to read; each
checkout keeps its own list in `groundwork.local.yaml`, which is not in git. The `groundwork-workspace` skill
walks you through it:

```sh
npm run workspace -- add git@github.com:acme/acme-groundwork.git   # clone it into .workspaces/ and read it
npm run workspace -- add ../acme-groundwork                        # or read a folder you already have
npm run workspace -- new ../beta-groundwork --id beta --name "Beta" --private   # make a new one
npm run workspace -- pull      # clone what is missing and update the linked repos
npm run workspace -- list      # what this checkout reads
npm run workspace -- remove acme
```

Restart `npm run dev` after linking. To read the same workspaces on another machine, copy `groundwork.local.yaml`
there and run `pull`.

See `docs/architecture.md` for how the code is laid out and how workspaces are found.

Each workspace's `MAP.md` is a generated index of its systems; `npm run map -- find|show|callers|calls|owns|repos`
queries it. Agents scan repos into the map, answer questions from it and write plans with the skills in
`.agents/skills/` (see its `README.md`).
