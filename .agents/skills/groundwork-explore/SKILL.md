---
name: groundwork-explore
description: Examine one pinned repository or source scope for Groundwork, tracing entries, logic, data and boundaries with evidence, gaps and labelled interpretations.
---

# Explore a repository

For workspace-backed exploration, first run `npm run --silent workspace -- list --json` in the Groundwork checkout.
Use its resolved id and folder, not a search of `workspaces/`; see [workspace discovery](../README.md#find-the-workspace-first).

Explain what the authorised source contains and what runs when an endpoint, message, job or user action
reaches it. Keep technical components separate from team ownership. Entrypoints and runtime declarations
establish technical boundaries; a library runs in its caller. Source inspection does not prove deployment.

## Select the output

Use the user's request or the scan brief. Read only the relevant mode:

- **Question-led `scan/v1`:** use [the pipeline](../../../docs/scan-pipeline.md) and
  [bounded repository workflow](../../../docs/scan-trials/scan-readiness/README.md). Start from scripted
  facts and entry catalogues, expanding execution evidence for the selected questions.
- **Existing `knowledge/v3` execution proofs:** use [canonical scans](canonical-scan.md) and the applicable
  endpoint requirements in [endpoint-flow.md](endpoint-flow.md).
- **Production YAML:** use [legacy fragments](legacy-fragment.md), with [handlers](handlers.md) and the
  endpoint companion when applicable. The companion is not read or validated by the app.

Do not substitute formats, migrate the application or move production marks as part of exploration.

## Examine what the question needs

Keep the repository, full commit, file selection, source policy and output location explicit. Use existing
indexes and bindings before manual reading. Follow relevant branches, dispatch, calls, argument/return
lineage, request/message/storage shapes, asynchronous handoffs and failures. Preserve callers' execution
hosts and distinguish a network boundary from an in-process library. Account for discovered entries and
exclusions, not only selected happy paths.

Support facts with typed relations and pinned source ranges. A method name or display expression alone
cannot prove an effect, wire shape, enforcement or durable completion. Parser recovery, dynamic dispatch,
external implementations and exhausted bounds remain explicit frontiers. A passing narrow probe does not
close a broader endpoint or journey obligation.

Use the LLM's judgement to interpret probable intent and journeys from this behaviour and surrounding
context. Follow [interpretation](../groundwork-schema/interpretation.md); label those claims **Inferred**
with rationale, confidence and limitations. Do not refuse a useful guess because intent cannot be proved,
and do not turn that guess into an observed source fact. Follow that reference's discovery coverage
contract: reconcile the independent candidate inventory at runtime/app and entry/operation level before
claiming discovery complete. Distinguish source-declared boundaries from deployed proof, and shared
activities from unexplored behaviour; neither one repository summary nor a claim quota closes coverage.
Use retained evidence first and request only the missing slices needed by the affected questions.

## Improve reusable coverage

For a demonstrated tooling gap, follow [learning from scan gaps](../groundwork-scan/learning.md). Capture
the smallest pinned reproducer, expected behaviour and affected questions. If working alone with ownership
of the tooling, fix and test the reusable rule within scope. If other explorers share the checkout, hand the
reproducer to the integration owner; continue unaffected work while that owner integrates at a checkpoint.
Keep the obligation partial until the corrected tool has reproduced and verified it. Runtime uncertainty
and unexamined external source are not reasons to fabricate a parser rule.

## Return

Return the validated artefact locations, covered revision and questions, entry/boundary coverage, partial
results, labelled interpretation and learning records. Distinguish evidence examined, tests executed and
runtime observations. Preserve scan stops and resource limits; do not expand to other repositories merely
to make a gap disappear.

## Stable ids

Use the selected format's identity rules and preserve existing logical identities. Legacy natural keys are
in [legacy fragments](legacy-fragment.md#stable-ids); canonical and scan identities belong to their schemas
and reusable writers. Never use traversal order as semantic identity or infer semantic order from an ID.
