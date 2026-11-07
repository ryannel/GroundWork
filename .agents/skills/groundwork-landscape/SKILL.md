---
name: groundwork-landscape
description: Organise scan evidence into Groundwork exploration areas and reconcile placements when new behaviour changes their purpose or boundaries.
---

# Organise the landscape

First run `npm run --silent workspace -- list --json` in the Groundwork checkout. Use the resolved workspace id and
folder, not a search of `workspaces/`; see [workspace discovery](../README.md#find-the-workspace-first).

Give someone unfamiliar with the system names a useful starting point: what people or the organisation can
accomplish, how those activities relate, and where to explore the systems that make them possible.

An **area** is an authored entrance into the evidence, grouping activities with a coherent purpose and scope.
It is a view, not another level in workspace › domain › system › component. Technical identities remain
independent of area membership, repository layout, domains and teams. One system can support several areas;
one repository can reveal several purposes. The user's chosen audience and scope take precedence over these
guidelines. Do the useful decomposition with available evidence and make unresolved choices explicit.

## Establish the scope

Read the existing landscape, its boundary decisions and the scan's coverage and revisions. For a new
landscape, inspect the available behaviour across the selected workspace before choosing its entrances.
For an update, start with changed evidence and its affected assignments and relationships; revisit the
whole grouping only when those changes challenge its boundaries.

Use [groundwork-ask](../groundwork-ask/SKILL.md) for the consolidated map and cited code. For newer captures, follow
their record references, evidence and coverage receipts. Prefer existing scan results; a missing actor or
transition is a specific evidence gap, not a reason to start another full scan. Report the scan question that
would resolve it. This skill does not itself restart scans or change scanner contracts.

Scope the map honestly: a customer experience map can omit internal work; a company landscape cannot treat
that omission as completeness. Look for evidenced purposes beyond purchasing, including operating,
supporting, producing and administering. Do not invent areas from a generic enterprise checklist, or make
poorly scanned purposes appear less important because fewer repositories were available.

## Find the purposes in the behaviour

Use the LLM to propose probable purpose, actors and candidate journeys from the behaviour and known
surrounding context. Follow [interpretation](../groundwork-schema/interpretation.md): label informed guesses
**Inferred** with rationale, confidence and limitations. Implicit intent need not leave every placement
unresolved; keep proposed meaning separate from observed participation and completed outcomes.

Use meaningful activities as the bridge from code to areas. Establish who acts, what they are trying to
achieve, the object involved, starting context, relevant conditions and observable outcome. Keep the source
record IDs and their pinned evidence. A screen name or endpoint is a discovery clue; it does not alone prove
an actor's goal, a usable action or completion. Preserve supported, inferred, conflicting and unknown claims
at the level where they arise.

Group activities by a shared purpose in recognisable language. Compare their outcomes, lifecycle and entry
contexts as well as their vocabulary. Domain language can expose meaningful boundaries, but a shared word,
such as “customer” or “order”, does not establish shared meaning or one journey. Market, offer, eligibility
and channel differences usually belong beneath an area as conditional paths.

Actor roles help distinguish activities; they are not the default top-level taxonomy. The same person can
shop, own and seek help. Conversely, customer self-service and a care agent investigating a case are distinct
activities even when they use the same system. Include another actor in an observed flow only where participation is evidenced; label probable
participation separately as inferred. Automated work can support an area without an invented human actor.

Separate consuming information from producing or administering it. A pricing API may support shopping;
an evidenced price-authoring workflow may reveal another purpose. Shared identity, a graph gateway or a
library usually belongs in supporting architecture. Create an operational area for it only when distinct
operational activities and outcomes justify that entrance.

## Decide what changes

Judge fit against each area's purpose and boundaries, not similarity of names. Compare the strongest
existing placement with the best alternative, and record the decisive reason.

| Decision               | Use it when                                                                                                                                                                    |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Keep or attach         | New evidence supports a purpose or activity already represented. Add its references and conditions.                                                                            |
| Deepen                 | A distinct activity belongs naturally within an existing purpose and deserves its own drill-down.                                                                              |
| Cross-link             | The same activity is useful from another entrance, or the same system supports another activity. Preserve its identity and explain the different context.                      |
| Add an area            | Evidence reveals a coherent purpose that existing entrances would misrepresent or hide. Give it a clear boundary and an evidence-backed route into detail.                     |
| Split, merge or rename | The current boundaries repeatedly confuse different outcomes, duplicate the same purpose, or no longer describe what is known. Explain which existing placements would change. |
| Leave unresolved       | Purpose, participation or context is not established. Retain the evidence and a focused question; do not force a placement to make the diagram complete.                       |

A new area needs a useful, distinct promise to the newcomer, comparable in breadth to its peers. It does
not need a quota of repositories or journeys: one repository may establish an important purpose. Equally,
a hundred implementations of an existing activity do not justify another area. Keep the number of areas
driven by meaningful distinctions, not a fixed count. Existing human choices are valuable context, not
immutable categories; surface proposed boundary changes explicitly rather than silently replacing them.

For ambiguous decisions and Volvo-shaped examples, read [boundary-cases.md](references/boundary-cases.md).
Those examples illustrate judgement, not a mandatory taxonomy or fresh evidence about Volvo.

## Explain relationships without inventing a journey

Distinguish a person continuing to another activity, information moving between supporting systems, and
shared technical support. Cite the actual supporting records, direction and conditions. Label a connection
with what moves or becomes possible. A source response or redirect does not establish delivery, subsequent
participation or a completed business outcome.

Shared actors, co-located pages and plausible lifecycle order do not prove transitions. An authored
“related need” link can help navigation, but should be distinguishable from an evidenced exchange. Shared
infrastructure should not produce a line between every pair of areas. Prefer the few relations that explain
the wider picture; preserve their underlying details for inspection. An unknown connection is preferable
to an invented one.

## Preserve a useful way into the detail

At the landscape, give peer areas equal visual importance and show the major supported relationships
before interaction. Each opens a dedicated view: its purpose, meaningful activities and their connections,
then relevant journeys or architectural cutaways, then technical evidence. Skip a grouping when it adds
no useful distinction. Keep a clear route back and into related areas.

An area is not one end-to-end journey. In a selected activity, show the actual surfaces, systems and labelled
exchanges that explain it. Preserve conditional branches and gaps rather than turning a set of participating
systems into a chain. An API-only implementation remains supporting behaviour or a candidate activity until
there is enough evidence to explain its use. Avoid filling the overview with disconnected system dots.

For authoring or improving the resulting system diagrams, use
[groundwork-diagram](../groundwork-diagram/SKILL.md): value-flow reading order, progressive expansion,
purpose labels and investigation of apparent orphans. Area grouping alone does not complete that work. When membership or boundary exchanges change, use the
diagram [maintenance workflow](../groundwork-diagram/references/maintenance.md) for the affected area and
its neighbours; do not refresh its reviewed date without reviewing those changes.

When a visual is part of the task, inspect screenshots of the overview and a representative drill-down.
Check whether a newcomer can find a non-shopping purpose, read the connections and understand the change
in detail without knowing system names. A classification-only refresh does not require rebuilding the UI.

## Keep the decisions maintainable

Use the project's existing representation if it supports this distinction between facts and interpretation.
Otherwise provide a separate landscape proposal beside the scan report; do not invent fields in production
YAML or immutable scan bundles. The following is an information contract, not a new storage schema:

- **Area:** stable identity, plain-language purpose, audience/scope, inclusion and exclusion boundaries,
  activity references and the reason for the grouping.
- **Placement:** activity or supporting-system reference, area, role in that area, evidence references,
  conditions and uncertainty. Keep source support separate from confidence in the editorial placement.
- **Relationship:** endpoints, meaning, direction where established, conditions, evidence and whether it
  represents a transition, information exchange, shared support or an authored navigation suggestion.
- **Refresh decision:** scan/snapshot revisions and scope, affected references, decision and reason,
  unresolved alternatives, and any superseded identities or boundary decisions.

Reconcile local runtime/app and entry/operation discoveries before grouping them into areas. A complete
five-area interpretation attempt or a component count does not establish activity coverage; carry the
scan's discovery-partial state and missing behaviour into the proposal. Follow the discovery coverage
contract in [interpretation](../groundwork-schema/interpretation.md); grouping cannot hide an unresolved
candidate or convert a source-declared boundary into deployed proof.

Reconcile across repositories before adding areas: several local candidates may describe the same purpose.
Retain stable identities on ordinary refreshes. Changed or removed evidence can invalidate a placement or
edge without disproving the area's existence. A fact missing from a partial scan is not a deletion; mark
stale or unresolved support and preserve unaffected evidence. Keep aliases or redirects when regrouping
would otherwise strand existing entry points.

Finish with the resulting landscape or delta, the consequential boundary decisions and remaining gaps.
Every in-scope discovery should have a disposition: an activity placement, supporting behaviour, a justified
exclusion or an unresolved question. Account for the supplied scope without claiming whole-company coverage.
State what was applied, what remains proposed and what evidence would change the decision.
