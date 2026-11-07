# Native current views

The native system map, workspace overview and primary domain pages now project the canonical index directly into the existing bounded drawing/page values. They do not reconstruct a legacy workspace, plan-shaped current model or second graph. Format-1 readers and renderer inputs retain their existing paths.

## Implemented boundary

- `model-system-map-input.ts` selects canonical cards and one-hop neighbours. Its serialisable drawing input retains exact native edge provenance/citations, explicit containment, cited resource ownership and scoped gaps. A declared unmapped system draws as a system, including an empty system, rather than a manufactured service. Causal edges remain in provenance; the existing calls/events/data drawing does not mislabel them. Authored narratives and stages do not enter legacy edge-inference paths.
- `model-landscape.ts` projects declared domains, people, journeys and flows into the existing landscape renderer. Domain membership uses the explicit set of domain IDs, so native `dom:` identities work. A flow's actor resolves only to a declared person by ID or unique exact name. Unknown actor text remains an explicit gap. Narrative journey placement can highlight an existing domain line but cannot manufacture execution.
- `model-navigation.ts` retains the real workspace paths, native counts, entry flows, journeys and reference links, programmes/partners where present, and the retained Services link. The native contract declares no key-journey shortlist, so none is invented.
- The workspace overview route renders the native authored-area canvas when present and the native domain-and-people map otherwise. It no longer substitutes an entry-flow redirect. Native branches avoid the legacy reader and overlays.
- `model-catalogue.ts` groups API entries by their declared component/external/system provider. Coarse boundary calls stay in native provenance and are not counted as API entries. Event announcements follow actual native producers; a consuming/containing system does not become a publisher. A message whose publisher is unknown remains visible in its recorded scope. Store rows follow containment while showing cited ownership separately; an uncited owner stays unknown.
- `model-domain.ts` produces the existing bounded domain, catalogue, flow and journey cards. It retains authored trigger/outcome/order, recorded code homes and team colour (or the existing stable palette position). These narrative records do not create execution. Unmapped system cards and current-model gaps remain visible.
- Primary domain layout/metadata, overview, map and interfaces routes now have native branches using those values and the existing renderers. Only plain drawing data crosses into the client map.
- `model-plan-footprint.ts` supplies plan domain counts through declared operation placement, known entity-child collections and explicit ancestor additions. It reuses dependency validation without applying or copying a large model. Only the selected plan's changes/work contribute; ancestors supply placement context. Unknown targets/repositories become explicit gaps. Resource ownership never supplies domain placement.

## Focused proof

These groups passed on their frozen source inputs:

| Group | Result |
| --- | --- |
| Native/existing system maps | 12 files, 76 tests |
| Native/existing landscape projection | 3 files, 14 tests |
| Native navigation, landscape, existing nav/renderers | 4 files, 18 tests |
| Workspace overview route | 4 tests |
| Native catalogue/domain and existing domain/nav | 4 files, 15 tests |
| Native structural plan footprint | 6 tests |
| Native primary domain routes | 4 tests |

Owned source/test lint, formatting and whitespace checks passed. These are overlapping focused groups, not an additive test total. No full check, build, budget, mutation gate or commit was run by this subagent; the root owns final verification after the shared source freezes.

The route proofs render the existing components and demonstrate native domain/area selection, canonical selected-system interface rows, explicit implementation gaps, native scoped drawing, metadata/nav, missing-domain/workspace handling and retained format-1 overview behaviour. The fixtures are synthetic and make no company claims.

## Remaining cutover

The later native system bundle is recorded separately in `native-system-handoff.md`; system layout/pages are no longer pending there. Other domain route families (flows and detail, language, target, plans) and broader workspace route families remain separate cutover groups. Root-owned native inspector/search integration supersedes the earlier overlay omission; the old overlays are not used as a native fallback. Original type/reader deletion remains deferred to its specified PR.
