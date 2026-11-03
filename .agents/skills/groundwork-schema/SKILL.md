---
name: groundwork-schema
description: Author or validate Groundwork scan evidence, execution bundles, workspace YAML and plan overlays using the appropriate schema and provenance rules.
---

# Groundwork schema rules

For workspace-backed files, first run `npm run --silent workspace -- list --json` in the Groundwork checkout.
Resolve their workspace folder from the registry, not `workspaces/`; see [workspace discovery](../README.md#find-the-workspace-first).

Choose the contract that the requested artefact actually uses. The formats below are separate; producing
scan evidence or an execution proof does not migrate the application. Read schema definitions for the
records being changed rather than copying field names across formats.

| Artefact                                                                   | Authoritative contract                                                      | Read when needed                                          |
| -------------------------------------------------------------------------- | --------------------------------------------------------------------------- | --------------------------------------------------------- |
| Question-led source evidence                                               | `schema/scan.schema.json`; `npm run generate:scan`                          | [Pipeline](../../../docs/scan-pipeline.md)                |
| LLM interpretation of purpose, actors, actions, journeys and relationships | `schema/scan-interpretation.schema.json`; `npm run generate:interpretation` | [Interpretation](interpretation.md)                       |
| Existing runtime/execution proof                                           | `schema/knowledge.schema.json`; `npm run generate:knowledge`                | [Canonical records](canonical-execution.md)               |
| Production workspace model or plan overlay                                 | `schema/plan.schema.json`; `npm run generate`                               | [Legacy YAML](legacy-yaml.md), [op cookbook](cookbook.md) |

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

Legacy rules, including handler trees, derived fields and graph rule 15, live in
[legacy YAML](legacy-yaml.md#ground-rules); they apply to that format rather than to every scan record.
