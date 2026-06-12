# gw-package-rename-invocations — npx groundwork → npx groundwork-method

The package publishes as `groundwork-method` (the bare npm name `groundwork` belongs
to an unrelated package); the binary inside it is still `groundwork`. Any project
script, CI step, or doc that invokes `npx groundwork …` now resolves to the wrong
package — or nothing.

## Detect

- **Applies** when project-owned files invoke `npx groundwork` followed by a space and
  a subcommand — look in `package.json` scripts, CI workflow files, `Makefile`s,
  shell scripts, and the project's own docs/READMEs.
- **Already done** when every such invocation reads `npx groundwork-method`.
- **N/A** when no project file invokes the CLI at all (most projects only ever ran it
  interactively). Files GroundWork owns (`.agents/`, `.groundwork/`) are not yours to
  scan — update refreshes those wholesale.

## Transform

Rewrite `npx groundwork <cmd>` → `npx groundwork-method <cmd>` in the files Detect
found. Nothing else changes — flags, arguments, and surrounding prose stay as they
are. Do not touch lockfiles or `node_modules`.

**Invariant:** every rewritten line behaves identically to what its author intended;
no invocation of an unrelated tool that happens to contain the word "groundwork" is
touched.

## Accept

- Searching project-owned files for `npx groundwork ` (with the trailing space)
  finds only `npx groundwork-method` invocations.
- One commit, referencing `gw-package-rename-invocations`.
