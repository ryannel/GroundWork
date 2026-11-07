---
name: groundwork-schema
description: Author or validate Groundwork scan evidence, execution bundles, workspace YAML and plan overlays using the appropriate schema and provenance rules.
---

# Groundwork schema rules

For workspace-backed files, first run `npm run --silent workspace -- list --json` in the Groundwork checkout.
Resolve their workspace folder from the registry, not `workspaces/`; see [workspace discovery](../README.md#find-the-workspace-first).

Read the definition for the file you are editing. The consolidated contracts live in
`schema/workspace.schema.json` for authored workspace files, `schema/evidence.schema.json` for
repository evidence, and `schema/plan.schema.json` for plan overlays. Run `npm run generate` after
changing a definition and use `npm run workspace -- check <folder>` to validate a workspace and
its plan projections. The [model layout](../../../docs/rebuild/design.md#4-committed-layout-per-workspace)
names each file and its owning contract.

Use `cites:` with an authored code reference or a persisted `ev:` ID. A code home supplies the
repository, and `repository.json` supplies the pin unless the citation explicitly keeps a historical
commit. Handler steps and failure IDs are declared in component files under `handlers/`. Plans
use operations on those same IDs and keep proposed work separate from current facts.

## Evidence and interpretation

Keep records closed, references kind-checked and source anchors pinned to repository, full commit, path and
range. Preserve technical component identity independently of teams and domain/system grouping. Source
DTOs, candidate library revisions and policy declarations do not establish effective wire, deployment or
authorisation behaviour.

Use typed control/value relations and parsed atoms for source proofs; display syntax or an operation name
cannot supply a missing relation. Required question slots must retain honest partial, unresolved or
not-examined outcomes. Known absence needs a complete scoped search. Validation of shape and references
is distinct from source verification and semantic coverage.

The LLM should make useful contextual interpretations even when intent cannot be established absolutely.
Keep these in the separate sidecar with **Inferred** labels, confidence, reasoning, limitations and actual
input provenance. An inference never substitutes for an unclosed source or runtime obligation.

## Freshness and contract changes

Capture source baselines and analysis fingerprints. Name the observed reference, observation time and
local/remote authority; unavailable observations cannot become unchanged results or deployment freshness.
Invalidate dependent facts, negative searches and interpretations when inputs change. Reuse compatible
source indexes; incomplete dependency closure widens analysis conservatively.

When a real scan exposes an expressiveness or validator gap, use the
[learning loop](../groundwork-scan/learning.md). Change the owning contract and reusable reader/writer,
regenerate types and test invalid as well as valid cases. Preserve versioned snapshots and explicit migration
boundaries. Do not add unchecked fields, weaken a proof requirement or edit curated data to pass validation.
