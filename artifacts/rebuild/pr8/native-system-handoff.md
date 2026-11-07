# Native system route handoff

The native system layout, metadata, first-flow page and flow-detail page now use the shared canonical index and bounded presentation values. After the native examples and replacement tests were proven, the temporary format-1 branches were removed from all three system routes. A noncanonical or missing registration returns the normal absent page, without using the old workspace/model or explorer readers.

## Facts and presentation

- `model-system.ts` projects the existing `SystemView`, component cards and repository rows directly from canonical containment, providers, execution queries, code homes, source citations and repository pins. A cited foreign owner does not move a store. External providers stay outside the component list. An unmapped system keeps its identity, zero recorded components and real API entries; unknown team/operator information stays unknown.
- Component summaries, actual offered entries, calls, publishers, consumers, explicit owned resources and recorded store use remain available. Repository rows retain the full recorded commit and scan timestamp, count explicitly cited records and say when remote branch freshness is unrecorded.
- Authored flows are selected only when their declared steps actually touch the system. System flow lists group by the first component, while domain lists retain their existing system grouping. A missing flow is useful no-flow teaching inside the system overview, not a fabricated narrative ID or blank native page.
- `model-flow.ts` retains the full authored FlowFile and every FlowStep field in order, plus chosen-index labels, screens, reads/writes/purges, cache case, beat, handler backing, source citation identities, resolved code-pin links and entry links. The shared citation resolver is cached for the selected index rather than rebuilt per step.
- `ModelTodayFlow` uses the existing stepping and keyboard controls with a labelled authored sequence. Its current-step details retain logic, failure conditions, records, screens, source pins and explicit missing handler backing. The canonical system map and entry-flow canvas remain the implementation drawings. The retained format-1 flow renderer still offers its existing diagram. This is an explicit native narrative presentation, not a hidden old-Model adapter.
- Inferred stories retain their original summary, reasoning, confidence, limitations, stages, supporting/related references, citations, backings, declared connections, generator/date and input fingerprint. They remain labelled interpretations and do not create execution edges or authored flows.
- `modelPlanFootprintOf` extends the structural footprint with exact systems while `modelPlanDomainsOf` retains its existing return shape. Chosen-plan operations/work locate the plan; explicit ancestors supply only placement context. Native system plan links use real folder slugs. Work counts follow recorded repository homes. Only explicitly recorded latest work events contribute to done counts; missing states and progress-read errors remain visible. No large model is projected merely to count plans.

The existing `SystemPage` gains optional native overview, plans and interfaces slots; unchanged old inputs keep the old defaults. The native layout supplies bounded map data and the native overlays rather than a compatibility model. New sources are `model-system.ts`, `model-flow.ts`, `model-system-plans.ts`, the bounded native flow/content components, their focused fixtures/tests and the three native-only system route files.

## Focused proof

The frozen system bundle passed eight focused files and 27 tests. These prove:

- actual component/provider/resource placement and code-pin behaviour;
- unmapped providers with no invented implementation or operator;
- declared first-component flow grouping and real flow selection;
- complete authored-flow/source preservation without new execution edges;
- click/keyboard narrative walking and retained failure qualifiers;
- inferred-story/source/limitation preservation without execution promotion;
- structural current/proposed system footprints, aliases and ancestor placement;
- honest absent/error/latest progress summaries and scoped progress reads;
- native metadata, no-flow page, first/detail flow, missing flow/system, native map/API and the initially retained format-1 rendering. The later cutover supersedes only that bridge proof: the updated system and workspace route suites pass 12 tests across two files, including normal absence without legacy calls.

Owned source/test ESLint, explicit Prettier check, new-flow Stylelint and whitespace checks pass. The sole final lint correction added braces around an unchanged dispatch branch; the 27 functional proofs did not need another behavioural rerun for that formatting-only correction. The recursive JSON fixture typing problem was fixed using the existing authoritative operation-schema type guard, with no assertions or contract relaxation.

No full check, build, budget, mutation gate, commit or data/acceptance write was performed by this subagent. The root owns those gates once the shared source freezes. Broader workspace/catalogue route cutover remains a separate group; this receipt does not claim PR8 is complete.
