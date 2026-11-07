# Consumer measurement

The original 1,697 candidate rows are retained verbatim in `original-candidates.json`, checked against the hash and count in `consumer-dispositions.json`. Every generated candidate carries its complete original row. Fresh discoveries are appended; no original candidate disappears when a keyword or file changes.

`consumer-candidates.json` reconciles the full denominator. `consumers.json` contains reviewed model consumers and unresolved runtime candidates. `consumer-pending.json` names PR9/PR10 work, including skills and legacy contracts. `consumer-summary.json` publishes both totals. Documentation, tests, configuration and command wrappers are recorded separately; this does not assert they migrated.

Runtime candidates remain adapters until an explicit file disposition supplies the current whole-source hash, exact current evidence lines and hashed proof references. Migrated/deleted claims require that proof; deletion also requires actual absence. Unknown, stale or missing proof blocks completion. A live legacy-model dependency cannot be labelled a retained producer or deferred consumer. Static import inspection distinguishes erased bounded UI types and literal metadata constants from invoking the mixed module's old reader. Retirement of installed explorer publication bytes stays pending PR10; the page reading today's model remains PR8 work.

Focused iteration:

```
npm run rebuild:inventory -- --consumers-only
npm run rebuild:inventory -- --consumers-only --check-consumers
```

The focused mode does not repeat repository-wide identity lint or explorer parity. The normal command retains those existing inventories. The completion flag exits 1 while any runtime adapter or invalid reviewed claim remains. Initial output correctly fails: all 1,697 originals reconcile, 47 fresh discoveries are recorded, 761 runtime candidates remain adapters, and 38 separately pending rows retain their PR9/PR10 assignments. These are incomplete-work counts, not a claim of cutover completion; ongoing source edits change fresh-discovery totals.

The six initial dispositions are source-reviewed responsibilities, with no blanket migrated status. The generic frame-storage helper was inspected and found to bound analysis bytes; it is not an original or fresh model candidate and no retirement/replacement claim is made for it.

`inventory-focused-tests.log` records 13 passing tests. Owned-file lint and whitespace checks pass. The initial completion gate log proves that incomplete work stays blocked with zero invalid reviewed claims. No full check, build or budget was run for this tool change. New artefacts are under the repository's ignored artefacts folder and need deliberate inclusion when committed.
