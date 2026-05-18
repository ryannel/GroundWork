---
name: groundwork-check
description: Analyzes GroundWork architecture docs for staleness against the codebase by checking git logs for `source_of_truth` paths since `last_reviewed`. Designed to run in CI.
---

# GroundWork Check Skill

This skill checks for documentation drift. It reads the frontmatter of all generated documentation in `docs/` and compares the `last_reviewed` date against the `git log` of the paths listed in `source_of_truth`.

## Instructions
Please follow the staleness check workflow defined in `instructions.md`.
