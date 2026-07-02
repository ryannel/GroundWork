---
name: groundwork-check
description: >
  Analyzes GroundWork architecture docs for staleness against the codebase by checking
  git logs for `source_of_truth` paths since `last_reviewed`. The deterministic core also
  runs without an agent as `npx groundwork-method check`, which is CI-safe and exits
  non-zero on critical drift; this skill adds graph reach, maturity re-assessment, and
  doc-type judgement, and ends its report with a failing status on the same conditions.
---

# GroundWork Check Skill

The full staleness workflow — including the Doc-Type Behaviours a check run applies — lives in `instructions.md`, colocated with this file; load it on invocation.
