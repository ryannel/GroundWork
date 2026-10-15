# Groundwork

The systems a company runs, and the plans that change them.

```sh
npm install          # also installs the git hooks
npm run dev          # http://localhost:3000
npm run check        # everything, in parallel
npm run lint:changed # lint only what you changed
npm run build        # static site in out/
```

The map lives in `workspaces/` as YAML. See `docs/architecture.md` for how the code is laid out.
