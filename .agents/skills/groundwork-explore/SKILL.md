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

For a partner's system, whose code we cannot read, the source is its documents: record the document URL, version and exact section, as [groundwork-scan](../groundwork-scan/SKILL.md#owners-and-partners)
says. Owner evidence (CODEOWNERS, Backstage, GitHub teams) is reported as handles, never turned into a team by
guesswork.

## Select the output

Use [the native scan](../groundwork-scan/SKILL.md#scan-the-registered-workspace) for a registered
workspace. Query its declared model with `npm run map` and read the cited code at its full commit.
For a supplied historical capture, respect its own scope and recorded limitations. Write proposed
handler, contract and evidence changes in a review file until a person accepts them.

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

Keep declared IDs. For a handler change, match the code span and control-flow branch. Use `cites:`
with a persisted `ev:` ID or pinned code citation. Traversal order does not establish identity.
