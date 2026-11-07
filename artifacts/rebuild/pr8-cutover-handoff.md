# PR8 consumer cut-over handoff

Read-only audit of readiness commit 0205662d and its current working tree. No source, fixture, baseline or status inventory was changed. Exact direct-import rows and counts are in pr8-consumer-audit.json beside this note.

## Observed blocker and present coverage

The recorded native capture failure is a reader mismatch, not invalid canonical data: tools/rebuild/facts.ts:78 calls readToday; src/infrastructure/today-model.ts:30 calls readWorkspaceModel; that reader requires legacy origin on flows/confirm.yaml. tools/rebuild/routes.ts:84 repeats the same path. The execution dependency is now explicitly recorded in docs/rebuild/rebuild.md before PR8. The PR7 compare/check/all-ID criteria remain unchanged and the original baselines remain frozen.

Native capabilities already exist: read-model.ts:379, model-plans.ts:12, model-index.ts:676, plans-index.ts:107/132, validate-model.ts:240/256/308, and tools/model-map.ts:modelMapOf. The CLI check and ordinary show branches use them. Entry routes are already native (src/app/[workspace]/entries/page.tsx:22), but entry-flow-page.ts:39 still projects a selected plan directly on current, ignoring ancestors. Reuse the validated ancestor policy when displaying selected plans; do not substitute all workspace plans.

The source audit proves **96 direct runtime imports in 62 files** still reach selected legacy boundaries: 36 app files/49 imports, 12 infrastructure files/21 imports, six application files/six imports, one feature file/one import and seven tools/19 imports. These are a concrete minimum, not the entire consumer denominator: many view builders take a legacy Model parameter without importing its constructor. The JSON audit lists every detected file:line.

## Smallest coherent implementation groups

1. **Native current/plan context and metadata.** Replace the reader joins in today-model.ts:24, today-data.ts:19, workspace-plans.ts:54/128, plan-data.ts:57 and workspace-plan-index.ts:41 with one canonical current model and native selected-plan context. Read schemas with model-plans; reuse inheritedPlanOrder and the batch validation policy. A selected plan needs `{ plan, before, after }`, where before includes exactly its explicit ancestors once, after applies its own ops, and ancestor/current distinctions and proposed-effect attribution survive. Keep revision, progress, programme, drift and checked-plan behaviour visible rather than dropping them to make a page render. The strict single-plan validator must continue rejecting an arbitrary proposed model as current.

2. **Pages and JSON together.** Four concrete JSON boundaries still deliver legacy shapes: model.json/route.ts:2 (todayData), plans/[plan]/plan.json/route.ts:2–3 (readPlacementData/readPlanState), revisions/[version]/plan.json/route.ts:2 (readRevision/readStatus), areas/[area]/map.json/route.ts:4 (todayData plus explorer/landscape readers). Migrate their shared infrastructure with the consuming pages/layouts, including plan lists, programmes, people/partners, language, domain/system maps, journeys, reference and things. workspace-store.ts:28 is the remaining direct legacyViewOf runtime call; eliminate its active canonical consumers rather than rename the adapter. The explorer page itself calls todayData at explorer/page.tsx:19: it is an actual runtime consumer and cannot be waved away as PR10 cleanup. The separate explorer-data asset route reads installed publication bytes only (explorer-data/[workspace]/[generation]/[file]/route.ts:17); its eventual retirement belongs with parity, not a fabricated model migration.

3. **Browser contract in the same group as plan JSON.** features/plan/plan-model.ts:36–48 currently fetches a plan-shaped document and calls derive in the browser. Replace that contract with canonical serialisable before/after data and browser indexOf; do not send IndexedPlan.beforeIndex/afterIndex functions or maps. Keep the existing shared pending-promise/cache behaviour, error handling, relative revision URLs and source links. The plan cover and screens use plan-data (plans/[plan]/page.tsx:5 and [chapter]/[screen]/page.tsx:6), so changing only JSON cannot finish the cut-over. Map views must receive the chosen native index, including plan after, rather than create a second graph.

4. **Proof and authoring tools.** Move captureFacts and selectedRoutes to the exact same native reader/query/view functions as production, preserving the old baseline's semantic facts through documented comparisons. Finish canonical map commands beyond show; migrate system-narrative.ts:15, plan-base.ts:check/land, and progress.ts:105/139/246. Existing CLI native check/show do not establish completion of these other consumers. No baseline regeneration and no special verification-only model bypass.

## Narrative, identity and scope obligations

The reviewed three-plan migration preserves 104 scope references, 14 local stage identities, 21 existing concept references and one proposed con:version add op, with a 4,219-leaf ledger. Render story.summary/scope/concepts/stages from the canonical contract; resolve concepts from the selected ModelIndex, never copy definitions back into the plan or promote Version into current language. Retain stage names, summaries, ordering, component/from/flow references and stage URL anchors; these selections do not imply new execution edges.

The legacy plan-entry inventory still reads domain.concepts/domain.stages (application/plan/ids.ts:155–156); concept cards still require copied definitions (plan-viz-domain.ts:117–126). The old scope walker only sees its BaseCollections (plan/plan-base.ts:112); it was never proof of complete canonical concept scope. Native checked-plan scope, drift and hashes must include story refs, exact local stage identities, nested ops and explicit ancestors. Keep all unknown references/proposed implementation gaps visible; plan-story.ts:41 already validates their existence before/after and local stage IDs.

## Focused proofs before final gates

- The canonical fixture capture and selected route discovery use no legacy reader; baseline comparison retains backed facts and explains exact differences by cause.
- Contract tests for all four JSON boundaries, unknown IDs/404s, source citations and stable nested IDs; serialisation round-trip contains no executable index objects.
- Care order-change before/after uses only declared ancestors, including a shared diamond once; unrelated plans remain absent, missing/cyclic/overlapping ancestors fail, and ancestor proposal provenance stays visible.
- Personal/acme/Volvo model and plan pages retain authored narrative, scope, concepts, 14 stage anchors and source links; whole-plan/ancestor/context edits invalidate the appropriate native lock/hash.
- Existing browser reader retry/cache/relative URL tests and inspector/palette tests adapt to the new native contract; they must not call legacy derive to reconstruct a workspace.
- Keep check/build/budget and all thresholds. Measure actual serialised payloads against the existing budget, especially with the real evidence volume; no speculative cache deletion or producer rewrite.

## What the 1,697-row inventory actually means

All 1,697 rows have status adapter because the generator assigns that literal to every candidate (tools/rebuild/inventory.ts:98–100), and again to every package script (116–121). Its OLD regex also matches canonical WorkspaceModel/entry-flow/model-index code and literal IDs. It is a broad candidate audit, not an implemented migration-status ledger.

The original categories are: 637 consumer, 46 route, 79 tool, 384 fixture/test, 439 documentation, 28 skill, seven quality configuration and 77 package scripts. **432 documentation rows are historical docs/scan-trials records.** Schemas, workspaces/personal YAML, AGENTS.md and package.json also fall into the coarse consumer category. None of those labels alone proves a runtime adapter.

Make the acceptance proof measurable without falsifying it: retain a one-to-one audit of all 1,697 original candidates and fresh discoveries; classify each by actual responsibility with file:line evidence, then maintain the actual model-consumer inventory with migrated/deleted status only when its replacement proof exists. Keep a separate, explicitly pending producer/retirement ledger. Publish both totals. Do not mass-set the candidates to migrated or claim zero adapters across the whole historical candidate list.

PR9 producer examples are concrete scan/publication outputs: scan-service-explorer-export.ts:60/64 writes visual pages/manifests; scan/framed-scan-storage.ts:50 writes retained scan frames; scan/discovery-format.ts:40 validates the legacy scan-discovery contract. These are not evidence that a page still uses an old workspace graph. Their producer/validator replacement remains pending PR9. PR10 retirement examples include install-corpus-explorer.ts:15–21 (copies/publishes explorer assets), publication/refinement tools, old scan contracts and caches; retain them until replacement/parity proof. A runtime consumer within those families which actually reads today/legacy models still belongs in PR8—classification must follow the import/use, not its filename.

Thus the honest PR8 assertion is: every actual runtime model consumer has native proof and none is still an adapter; the complete original candidate audit reconciles, with named PR9/PR10 work still pending. If the existing blanket generator is left unchanged, a literal zero-adapter report is impossible even after a correct cut-over. Fix that measurement, not the acceptance threshold.

## Installed Next.js guidance read

Read node_modules/next/dist/docs/01-app/01-getting-started/15-route-handlers.md, 05-server-and-client-components.md, and 02-guides/server-and-client-boundary.md. Current routes already await Promise params. Preserve server-only infrastructure and serialisable props; a use-client boundary includes its imports. GET route handlers are uncached by default; do not add a second stale framework cache around file-watched native data. These are handoff constraints, not route changes performed in this audit.
