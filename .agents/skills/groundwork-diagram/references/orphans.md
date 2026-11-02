# Investigate apparent orphans

An orphan is a review signal, not a business conclusion. Consider both a card with no visible edge and a
connected island with no route to the area's core work. Self-access and a shared platform call do not by
themselves explain a component's contribution. Do not optimise for a fully connected graph at any cost.

## Follow the evidence through the layers

Compare the default projection, all connections, expanded resource rows and the full workspace graph.
Inspect both inbound and outbound calls, message production/subscription/handlers, store access,
configuration-based routing, flows, UI interactions and declared dependencies. Distinguish their evidence
strength. Check resources outside the area and stable IDs/aliases before assuming a missing relationship.

Read the component's role, contracts, handler bodies, existing prose and source references. Prose can
identify a missing structured `call`, `publish`, `read`, `write`, subscription or `access` record, but is
not itself sufficient proof. Trace the cited code at its pinned revision, including actual invocation,
dependency injection and configuration where relevant. A generated API client alone does not establish
that the app calls it. A topic declaration alone does not establish a publisher or consumer.

Search the relevant neighbouring repositories where the handoff requires it. Reuse retained scan results
and indexes; request or extract a focused missing slice rather than rescanning everything. Preserve partial
coverage, inaccessible code, incompatible revisions and remote/deployment uncertainty. Record what was
searched: absence within that scope is not proof of absence everywhere.
For offline reviews, check retained source caches and disable Git's implicit partial-clone fetches
(`GIT_NO_LAZY_FETCH=1`) when reading pinned blobs; unavailable local source remains an explicit gap.

## Choose an explicit disposition

| Finding                                                               | Model or view treatment                                                                                                                            |
| --------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Relationship exists but the default suppresses it                     | Retain a meaningful supporting connection or reveal it through the correct parent; fix projection/routing if necessary.                            |
| Relationship is described and confirmed in source, but not structured | Add the supported typed relation and its source anchors to the correct contract/handler, including valid entry IDs. Regenerate and validate.       |
| Private resource has no visible independent line                      | Check ownership and every user globally; fold it into the owner and verify expansion exposes its real uses. Ownership alone does not prove access. |
| Relevant neighbour lies outside this view                             | Preserve the external dependency and explain its scope; include a boundary reference or revise area scope where supported.                         |
| Separate work really belongs to this system                           | Keep it within the system boundary with a specific purpose. Record why no relationship to the core is expected in the reviewed scope.              |
| Duplicate identity or wrong membership                                | Reconcile identities or propose the corrected system placement from source/runtime responsibilities. Preserve references and reviewed choices.     |
| Evidence cannot establish relationships or membership                 | Keep an unresolved finding with the exact missing source, handler, configuration or owner question. Do not certify it as a true orphan.            |

For each finding retain: component/group IDs, area and projection, purpose, existing relationships and
their strength, searched revisions/paths, membership rationale, disposition, applied change, remaining
question, and verification. Keep this in the run report if production schemas have no field for it.
“Reviewed; no relationship found” must name the bounded search and why membership is still appropriate.

## Lessons from Commercial

These illustrate failure modes, not templates to copy into unrelated systems:

- Price Engine's private memory cache had an owner and descriptive notes but no structured access.
  Confirmed reads/writes allowed it to appear inside the pricing service rather than as an isolated card.
- Two admin apps fetched `/me` from Microsoft Graph. The endpoint existed but their calls were absent.
  Confirmed invoked hooks supported profile-reading links; these were not authentication exchanges.
- Business case UI described creating and progressing cases. Typed calls and target endpoints were missing.
  Actual UI call sites plus compatible server routes supported the repair, with their different revisions
  preserved. This did not certify current deployment or every business-case operation.

The useful generalisation is to reconcile existing explanation, typed evidence and projection—not to
automatically wire up every cache, Graph client or administration app.
