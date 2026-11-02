# Best-effort interpretation

After scripted extraction, use the LLM to make the best informed interpretation of the system's purpose,
probable actors, actions, journeys and relationships. This phase is required for a question-led scan and when
an answer needs meaning beyond observed source facts. Do not refuse to infer intent merely because intent
cannot be proved from code.

Read the extracted entrypoints and behaviour, then use relevant context already available: the workspace map,
other systems and repositories already examined, product documentation, team notes and user explanations.
Make a useful guess from those surroundings. Prefer a plausible purpose or journey with explicit assumptions
to a list of method names. Existing scan stops still apply; using known context does not authorise fetching or
scanning more repositories.

Label each such claim **Inferred**, with a concise explanation of the evidence and assumptions, qualitative
confidence (`low`, `medium`, `high`), reasonable alternatives, limitations and dependencies. Alternatives may
be empty when none are useful. Say which context was actually examined. Keep the label visible beside the
statement, including for high-confidence or human-confirmed interpretations; do not bury the useful answer
under caveats. Separate nearby observed facts and their source citations from the interpretation.

If the context genuinely cannot support a useful guess, record the attempted area, why it was insufficient
and what information would help. A library or missing UI is not by itself a reason to skip the attempt: its
callers and surrounding systems can suggest purpose and probable users. Do not invent an actor or journey
just to populate a field.

## Persisting the phase

Use the separate closed `schema/scan-interpretation.schema.json` sidecar (`scan-interpretation/v1`). Keep
`scan/v1` observed answers and source proofs unchanged. Its typed claims cover purpose, actor, action,
journey and relationship. Claims cite pinned observed record/source IDs and/or exact document-context
snapshots. Documentation, team notes and the map may inform a guess without becoming code observations.
Capture context digests, revisions and input provenance, including other known repositories where relevant.
Revisit dependent interpretations when those inputs change.

Record the model/run provenance and actual interpretation usage: measured calls/tokens where available,
otherwise explicitly unknown with a positive call lower bound and a reason. Never copy the scripted source
phase's zero model calls into a phase which used an LLM. A source extraction can finish with zero model calls;
the overall interpretation remains pending until the LLM attempt has happened and been recorded.

The sidecar records a complete interpretation attempt only after an explicit attempt for all five areas. `insufficient_context` and
`not_applicable` are honest outcomes with reasons. Pending or partial interpretation must remain visible in
scan reports; it must not be presented as a complete full-system scan. Validate the sidecar against the exact
input bytes with `interpretationValidator` in `src/infrastructure/scan/interpretation-format.ts`.

An inferred goal or relationship is never evidence of deployed activation, authorisation, durable effects,
delivery guarantees or transaction behaviour. Preserve observed runtime uncertainty while still explaining
what the surrounding system most probably intends to do.

## Discovery coverage

A complete five-area attempt is not complete discovery. Keep source-capture completion, interpretation
attempts, discovery coverage and semantic acceptance separate in reports. A source capture can reconcile
all tracked files while leaving behaviour unexamined. Exact input hashes establish provenance, not useful
coverage of the supplied evidence.

Before interpreting a repository, retain an independently derived, pinned candidate inventory: source
runtime/app boundaries and their entries or operations, with unsupported profiles and exclusions visible.
Use scripts and existing captures for the inventory and bounded evidence packets. A manifest directory is a
candidate, not proof of a component or deployment. Validate boundary claims against source declarations;
source-declared runtime boundaries do not prove deployed activation.

Reconcile every candidate in a separate `scan-discovery/v1` assessment against the frozen inventory. Give
it an evidence-backed disposition: distinct behaviour, shared/supporting behaviour, justified exclusion or
unresolved discovery. Explain meaningful activities at the entry/operation level, including conditions,
objects and outcomes where available. One generic repository purpose or copied claim per component does
not cover distinct activities. Shared activities may be grouped when the evidence explains the grouping;
there is no quota of claims, actors or journeys per app. Do not invent people for automated behaviour or
transitions between activities merely to fill the five areas.

Discovery is complete only within the declared scope when the inventory is reconciled, material local
behaviour is explained and an independent challenge verifies the dispositions and omissions. An unresolved
material discovery gap keeps discovery partial; it can still be published usefully with that limitation.
Five honest area outcomes and a schema-valid assessment do not replace this challenge. The reviewer must
examine the frozen inventory and local evidence, not accept the author's pass declaration.

The discovery CLI reports mechanical `investigationCoverage` separately from its review-gated `status`.
Use `--review <receipt.json>` for a `scan-discovery-review/v1` receipt over the exact inventory,
interpretation and discovery hashes, assessment rules, instructions and candidate/component/action scope.
A missing review leaves reconciled work `review_required`; `--require-complete` fails until both gates pass.
Honest partial evidence remains valid and useful. Actual run `author_ids` come from orchestration; omission
means unknown. A reviewer must be separate from every author and author run. Declared independence stays
labelled declared; an orchestration-verified assertion needs a separate trusted caller binding. No review
receipt establishes deployed currency or substitutes for missing source or runtime proof.

For repairs, start from retained evidence and identify missing slices before requesting new extraction.
Re-examine only affected scopes; an interpretation failure does not by itself require a full native pass.
Record dependencies on evidence slices, context snapshots and discovery/interpretation rules. Changed or
added candidates invalidate affected coverage and negative searches; changed context invalidates dependent
claims and groupings. Incomplete dependency closure widens re-evaluation conservatively. Reuse compatible
source/index caches, preserve old receipts and validate reused inputs rather than changing their version
labels. A new complete claim needs current coverage and independent review.
