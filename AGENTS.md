# Repository agent instructions

Implement against the single current Groundwork format in `docs/WORKSPACES.md`. Keep feature planning and delivery central, and preserve the established UI unless the task calls for a specific change.

Keep scratch notes, review transcripts, and build handoff files outside this repository. Use a temporary directory for agent working documents. Do not stage or commit files under `docs/design-review/` or `docs/WORKSPACES-BUILD.md`.

Before staging, inspect `git status` and preserve unrelated working tree changes. Run the relevant type check and tests for code changes. Do not migrate external workspace homes as part of ordinary repository cleanup.
