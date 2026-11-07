# Knip scope and retained readers

The two project entries cover actual imports. The `plan:base` command reaches `modelPlanLockOf` through `tools/model-plan-base.ts`. The `rebuild:inventory` command reaches `moduleUses` through `tools/rebuild/consumer-inventory.ts`. A disposable check with just these two files added to the Knip project removed both false findings and kept the other export findings. Adding the package entrypoints alone did not clear them. No check was disabled.

The retained format-1 readers have executable fixture proof. The existing Acme fixture verifies that `readVersions` preserves the full current plan and the two original revisions in order. The workspace plan fixture verifies the real mini plan's title and cover address through `planData`, and checks that `planFailure` retains the original malformed-YAML error while the page is unavailable. The two files passed all 37 focused tests. None of these readers is called by a current route.

## Cleanup completed after replacement proof

The first seven unused UI wrappers were removed after the focused native tests, five actual HTTP replacement responses and the factual and alias ledgers established their replacements. Removing the mixed TodayThing renderer exposed seven helpers with no remaining callers; those were removed under the same record and entry-view proof. The exact 14 paths and prior source hashes are in `obsolete-render-wrappers.json`. No old loader, type, fixture or publication producer was removed.

- `src/features/plan/plan-pages.tsx` and `src/features/plan/plan-shell.tsx` for the old plan page and shell. The plan cover and chapter routes now use `ModelPlanPage` and the shared `PlanFrame`.
- `src/features/plan/remember/remember.tsx` for the old recap renderer. The native plan page presents the authored recap. The difference in where the recap is displayed belongs to the route comparison.
- `src/features/plan/thing-page/thing-page.tsx` for the old plan thing route. The native route now uses `ModelPlanThingPage` with the selected before or after inspection.
- `src/features/plan/today/journey-walk.tsx` for the old journey detail. The native route uses the canonical journey and its authored flows.
- `src/features/plan/today/today-map.tsx` and `src/features/plan/today/today-stops.client.tsx` for the old map and story stage controls. The native maps use the model index. Legacy global story stages follow the separate design retirement and source retention proof.

Private native helpers lost their unused exports while their implementations stayed in place. These are `modelFlowSources`, `modelComponentCardsOf`, `readModelPlanBaseMarker` and `modelFingerprint`.

The redundant `modelChipOf`, `planOutline`, `THINGS_SCREEN`, `thingAt`, `thingHref` and `planReaderOf` re-exports were removed after verifying that callers use their defining modules. The same applies to the five unused type re-exports `PlanCheckState`, `PlanStage`, `DomainLink`, `PlanLock` and `ProgressRead`. Keep the underlying types.

The mixed legacy UI exports `BODIES`, `recapOf`, `TodayOverlays` and `TodayThing` were removed under that same replacement proof. Keep `BodyProps`, `isFragment`, the shared thing frame and the native overlay exports used by current or retained fixture code. Recheck the exact removals before considering any further file. Old loaders, types, fixtures and scan or explorer producers remain subject to their separate PR 9 and PR 10 proof.
