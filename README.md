# Groundwork

The systems a company runs, and the plans that change them.

```sh
npm install          # also installs the git hooks
npm run dev          # http://localhost:3000
npm run check        # everything, in parallel
npm run lint:changed # lint only what you changed
npm run build        # static site in out/
```

Each workspace is its own repo of YAML: the systems a company runs today and the plans that change them.
`workspaces/` holds two examples. Make or register your own with `npm run workspace` (the `groundwork-workspace`
skill walks you through it):

```sh
npm run workspace -- new ../acme-groundwork --id acme --name "Acme" --private
npm run workspace -- add ../acme-groundwork   # a workspace repo you have cloned
npm run workspace -- list
```

See `docs/architecture.md` for how the code is laid out and how workspaces are found.

Each workspace's `MAP.md` is a generated index of its systems; `npm run map -- find|show|callers|calls|owns|repos`
queries it. Agents scan repos into the map, answer questions from it and write plans with the skills in
`.agents/skills/` (see its `README.md`).
