# Learn from scan gaps

Use this when a scan finds behaviour that the reusable tooling misses, misstates or makes an agent reconstruct
repeatedly. Learning is retained in executable regressions, improved tools and concise guidance that future
runs actually use. A longer prompt or a successful one-off explanation alone does not close a tooling gap.

## Diagnose before changing a rule

Distinguish a reproducible extraction/binding bug, a missing contract or query capability, and inefficient
workflow from genuinely unavailable source, dynamic runtime behaviour or ambiguous intent. Check the
authoritative schema and existing extractor first. A lower-confidence interpretation can explain likely
purpose; it cannot prove an unresolved call target, authentication, delivery or persistence guarantee.

Capture the smallest example that preserves the pattern, with its pinned source and analysis provenance.
State the actual missed or false relationship and the question it prevents answering. Include a useful
nearby counterexample, not just the exact repository spelling. Keep snippets and fixtures within the task's
source permissions and retain their provenance or identify synthetic equivalents explicitly.

## Keep a durable learning record

For each distinct pattern, keep one concise record in the run's `learning/` directory, outside production
workspace files. Read the previous run's learning links and search existing regressions/learning records for that pattern
before duplicating work.
Use the following fields as a reporting checklist, not new keys in `scan/v1` or workspace YAML:

| Field                     | What it records                                                                               |
| ------------------------- | --------------------------------------------------------------------------------------------- |
| Pattern and state         | Stable feature/semantic name; `open`, `reproduced`, `verified` or `deferred`                  |
| Evidence                  | Repository, full commit, source path/range or synthetic fixture, and analysis versions        |
| Question and impact       | The blocked obligation, missed/false behaviour and affected entry/repository scope            |
| Expected and actual       | Observable relationship/result and the independent reason it is expected                      |
| Reproducer and correction | Small failing fixture, reusable extractor/schema/query/process change and owner               |
| Verification              | Before/after result, counterexample, relevant regressions, reuse/invalidation measurements    |
| Follow-through            | New publication/version, affected earlier captures and their refreshed or still-partial state |
| Deferred reason           | Missing evidence, scope, budget or decision; next concrete test or input needed               |

Link the record from the scan report and carry open/deferred patterns into the next scan brief. Keep the
reusable fix, regression and any lasting process correction in the scanner repository so future runs inherit
them; run-local notes alone are not the shared memory. A closed pattern should be findable through its regression name and
affected extractor; promote only reusable, non-obvious operating knowledge into a short skill reference.
Remove superseded guidance. Do not append every repository incident to the always-loaded skill body.

A collapsed discovery denominator is also a reusable process gap: for example, many distinct app/entry
candidates reduced to one repository activity despite a valid five-area sidecar. Preserve the independent
inventory and missed local evidence as the reproducer. Verify both missing-discovery rejection and valid
shared/supporting dispositions; increasing claim counts alone is not a correction. Refresh affected
interpretations and discovery assessments from retained evidence before scheduling new source work.

## Repair the shared capability

Within the authorised scan/tool-maintenance scope, continue through a small reusable correction and its
verification without asking for permission at each local edit. Prefer the shared parser, binding, source
index, schema, query or validation layer that owns the behaviour. Avoid repository-specific method lists,
name-based semantic guesses and unsupported fields. A one-off manual fact remains partial unless the
selected contract can honestly represent and verify it.

Turn the reproducer into a regression whose expectation comes from source semantics or an independent
contract. Show that it detects the original failure. Exercise a counterexample and relevant existing
behaviour; check a false-positive or missing-relation variant where it would change the answer. Do not
rewrite the frozen question, expected denominator or oracle to make the patch pass.

For schema changes, update the owning versioned contract, generated types and readers/writers as needed.
Check that changed helpers and contextual inputs participate in analysis/invalidation provenance. Verify
that changed analysis becomes stale while compatible unchanged blobs/indexes remain reusable. Merely
changing a version string is not proof that the affected facts or interpretations were refreshed.

Use focused regressions first. Re-run the fixed benchmark when shared extraction/semantic contracts are
affected, and the customer-service acceptance suite when its proof inputs are affected. Follow repository
checks when editing tooling/application code; do not repeat full benchmark/proof packs for each ordinary
data capture or wording-only skill correction.

## Integrate without mixing versions

In a shared checkout, explorers report gaps and produce reproductions; one integration owner patches the
shared tooling. Hold new affected tasks and let active bounded tasks reach a checkpoint before modifying
their tool files. Other workers may continue only on unaffected work with a known tool version, or in an
isolated pinned environment. Do not hot-patch tools underneath an active extraction.

After verification, start new immutable outputs under current fingerprints and regenerate affected facts
from retained source/indexes where compatible. Preserve completed checkpoints and old receipts; a changed
fingerprint cannot resume an old run. Re-evaluate dependent interpretations against their actual inputs,
and explicitly document verified byte-identical reuse when appropriate. Track earlier affected captures
until refreshed or explicitly stale/partial. Resume only already authorised tasks; this loop does not lift
a user stop, fetch another repository or migrate the app.

## Stop a repair for a concrete reason

Continue while there is a bounded, evidence-backed next correction. If the missing information is external,
the fix exceeds the authorised scope/resource budget, or a material contract decision cannot be settled
from evidence, retain a `deferred` record and the partial obligation. Continue independent permitted work.
Report the exact reason and next input needed; do not fabricate coverage, loop on the same failed approach
or make every other repository wait on an unrelated gap. A gap is `verified` only after the correction's
checks pass and the affected evidence has been regenerated and validated, or its remaining stale scope is
explicitly excluded from the claimed coverage.
