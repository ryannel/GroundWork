# Heavy viewer components: component inspector, system maps, execution flow

## Summary
The slice works and shows care in places. The pure layout and physics modules (`system-map-layout.ts`, `system-map-physics.ts`) are small and deterministic, and their tests check real behaviour. The map's async ELK layout is guarded against stale results with a version counter, every effect cleans up after itself, and the hook dependency arrays are complete (verified: `oxlint -D react/exhaustive-deps` reports nothing on `src/`). The biggest risks are in state design, not in the hooks:
- The map re-runs ELK layout whenever any of four props changes identity, even props that affect only node data. The default parameter `observedStatus = new Map()` is a loaded footgun.
- The catalog URL contract (`catalog`, `apiEntity`, `finding`, `flow`, …) is copied as string literals across four viewer files and `server/catalog.ts`. Those copies have already drifted: switching components leaves stale params behind.
- `component-inspector.tsx` is a 342-line god module mixing seven concerns, with 1,125- and 1,461-character JSX lines. It renders every hidden tab panel eagerly and has no component tests.

## Findings

### [HIGH] Map re-layout depends on the identity of data-only props; the default `new Map()` causes an endless re-layout loop
- **File**: src/components/system-overview-map.tsx:92, :198-228
- **Category**: correctness
- **Problem**: `runLayout` is a `useCallback` over `[observedStatus, selectableIds, startSimulation, visibleComponents, visibleRelationships]`, and the effect `useEffect(() => { void runLayout(); return cancelLayout }, [runLayout, cancelLayout])` runs again whenever that identity changes. `observedStatus` and `selectableIds` only feed `node.data` (`observedStatus.get(...)`, `selectableIds?.has(...)`), yet a change to either starts a full ELK layout. That layout discards the user's drag positions and pins (`setPinnedIds(new Set())` at :194). Worse, the prop has a default: `observedStatus = new Map()`. A caller that omits it gets a new Map on every render, so `runLayout` changes, the effect cancels and restarts, the layout finishes and calls `setNodes`, the component re-renders, a new Map is created, and the cycle repeats forever. Today the only caller (`system-diagram.tsx:53`) passes a memoised `map.status`. That depends on an unenforced chain of `useMemo`s up to `product.tsx:19`, whose comment ("Inspector URL changes must not restart the map's layout and simulation") shows this has bitten before.
- **Impact**: One harmless refactor upstream (an un-memoised filter, a new caller, a component that omits `observedStatus`) turns every node click (`onFocus` updates the URL, which re-renders the parent) into a full re-layout that loses pins, or into an endless loop of ELK layouts.
- **Recommendation**: Key the layout on a structural signature, not on object identity, and move data-only props out of the layout path:
  ```ts
  const layoutKey = useMemo(() => JSON.stringify([visibleComponents.map(c => c.id), visibleRelationships.map(r => [r.from, r.to])]), [...])
  useEffect(() => { void runLayout(); return cancelLayout }, [layoutKey])   // runLayout reads the latest inputs from a ref
  // observedStatus / selectableIds / color: apply in the displayNodes memo instead of baking them into nodes
  ```
  Replace the default with a module constant (`const EMPTY_STATUS = new Map()`) or make the prop required.

### [HIGH] The catalog URL-param contract is duplicated across five files, and switching components leaves stale `finding`/`jobs*`/`flow` params
- **File**: src/pages/product.tsx:50; src/components/component-inspector.tsx:245, :283; src/components/catalog-browser.tsx:21; server/catalog.ts:41-53
- **Category**: correctness / architecture
- **Problem**: Param names are written as literals in each place:
  - The inspector reads `catalog`, `apiView`, `schema`, `finding`, `flow` and `${tab}Entity|Query|Group`.
  - `CatalogBrowser` writes `${urlKey}Query|Group|Entity` and also sets the inspector's `catalog` tab param.
  - The server builds deep links with its own kind-to-param mapping.
  - The product page clears component-scoped params with a regex that has drifted from the list above:
  ```ts
  for (const key of [...next.keys()]) if (/^(catalog|schema|api|data|messages)/.test(key)) next.delete(key)
  ```
  The regex misses `finding`, `flow`, `jobsEntity`, `jobsQuery` and `jobsGroup`. Concrete bug: open a server deep link to a finding (`?component=X&finding=F`), then click another node on the map. The next component keeps `finding=F`. Its "Investigated questions" `<details>` renders `open={!!params.get('finding')}` and filters `finding.id === params.get('finding')` to an empty list, so the panel is open and empty. Stale `jobsEntity` and `flow` values likewise carry over to unrelated components.
- **Impact**: The UI shows wrong or empty state. Each new catalog kind needs edits in five places, and nothing tests that server deep links round-trip through the viewer.
- **Recommendation**: Create a shared pure module, `src/data/catalog-url.ts`, and import it from both `server/catalog.ts` and the viewer. It holds the `CATALOG_PARAMS` names, `readCatalogLocation(params): CatalogLocation`, `writeCatalogLocation(params, patch)`, `entityParam(kind)` and `clearComponentScope(params)`. Unit-test that `server` deep-link builder → `readCatalogLocation` round-trips for every catalog kind.

### [MEDIUM] A failed ELK import or layout leaves the map stuck on "Arranging the system…" with no way to retry
- **File**: src/components/system-overview-map.tsx:198-218, :225-228, :288
- **Category**: correctness
- **Problem**: `runLayout` has no `try/catch`, and the effect calls it with `void runLayout()`. If `import('elkjs/lib/elk.bundled.js')` rejects or `ELK.layout` throws, the rejection goes unhandled and `layoutPending` stays `true`. Both toolbar actions are `disabled={layoutPending}`. A chunk-load failure is realistic: the 1.4 MB chunk can fail to fetch after the runtime is upgraded while a tab is open, or while offline. `execution-flow.tsx:46` handles the same failure with `.catch(...)` and a fallback grid, so the two ELK consumers are inconsistent. A secondary edge case: `runLayout` resets `dragging.current = null` (:201) while a drag may still be in progress, and a layout that lands mid-drag replaces the nodes under the pointer.
- **Impact**: The map area stays permanently blank until a full page reload, with an unhandled promise rejection.
- **Recommendation**: Wrap the body in `try/catch`. On error, check the layout version, then fall back to a simple grid (as in execution-flow), `setLayoutPending(false)` and show a retry. Better still, share one `loadElk()` helper that memoises the import promise and clears it on rejection so a retry can fetch the chunk again (see the ELK finding below).

### [MEDIUM] A selected retired record hides every tab panel while the tabs stay interactive; retired schemas can never be selected
- **File**: src/components/component-inspector.tsx:245, :281, :301-326
- **Category**: correctness / accessibility
- **Problem**: `retiredSelection` is computed from `params.get(kind==='data' ? 'dataEntity' : ... : 'apiEntity') === item.id`, and every panel uses `hidden={tab !== X || !!retiredSelection}`. Clicking a tab calls `updateCatalog({ catalog: tab })`, which keeps the retired `*Entity` param, so `retiredSelection` stays set. The tab shows `aria-selected` but its `aria-controls` panel stays hidden. The only way out is the "Browse active records" button inside the retired `<details>`. Separately, retired observations of kind `schema` map to `apiEntity`, while schemas are addressed through the `schema` param (`server/catalog.ts:53`, inspector :305), so a retired schema never matches.
- **Impact**: The tabs look broken: the selection moves but nothing appears. Links to retired schemas silently show the active catalog instead.
- **Recommendation**: When the tab changes, clear the retired entity params: `setTab` should delete the `*Entity`, `flow` and `schema` params that point at retired ids. Alternatively, render the retired record inside the relevant tab panel rather than hiding all panels. Map retired `schema` to the `schema` param by using the shared `entityParam(kind)` from the previous finding.

### [MEDIUM] API schemas are resolved by name, so a link to schema id X can render a different schema with the same name
- **File**: src/components/component-inspector.tsx:16-22, :255, :305
- **Category**: correctness
- **Problem**: `const schemas = new Map((api?.schemas ?? []).map(schema => [schema.name, schema]))`, and a duplicate name means the last entry wins. The schema content model (`componentApiTypeSchema`) makes `id` unique but not `name`, and no validation rule in `content.ts` checks name uniqueness. The linked-schema panel looks the schema up by id and then passes only its name: `type={api.schemas.find(schema => schema.id === params.get('schema'))!.name}`. `SchemaExplorer` then resolves the name back through the name-keyed Map.
- **Impact**: With versioned APIs, or languages where two namespaces each define `Request`/`Order`, the inspector shows the wrong fields for a deep-linked schema and in payload drill-downs, without any error.
- **Recommendation**: Index schemas by id and keep a name → `ApiType[]` multimap for resolving type strings. Give `SchemaExplorer` an optional `rootId`. When a name is ambiguous, list every candidate (the "Payload models" switcher already supports multiple roots) instead of picking one.

### [MEDIUM] URL state and `useState` both hold catalog selection state, and a remount-by-key hack papers over the duplication
- **File**: src/components/component-inspector.tsx:246-253, :268-269, :317, :322; :124; :163 vs :168-172
- **Category**: architecture
- **Problem**: Some state lives in the URL (tab, entity, query, group, `apiView`, and `flow` for message/job flows). Similar state lives only in `useState`:
  - the API `method`/`selectedVersion` filters;
  - the messaging `direction` filter;
  - the endpoint flow picker (`EndpointFlows` `flowId`), while `ContextFlows` stores the same kind of choice in the URL;
  - `flowOrigin`, the "Back to …" breadcrumb.

  `navigateCatalog` writes `dataEntity` to the URL and also sets `catalogFocus`, then bumps a `catalogNavigation` counter used as `key={catalogNavigation}` to force a remount of `DataCatalog`/`MessagingCatalog`. Because those browsers have a `urlKey`, `initialSelectedId` is ignored whenever the URL entity is set. The remount exists only to reset the local `direction` filter.
- **Impact**: State is lost on reload and on shared links (filters, endpoint flow choice, breadcrumb), and the URL can disagree with the UI. For example, a deep-linked `apiEntity` hidden by a local method filter makes `catalogSelection` silently show the first visible endpoint. Forced remounts also discard scroll position and child state.
- **Recommendation**: Treat the URL as the single source of truth for anything navigable: `apiMethod`, `apiVersion`, `messagesDirection`, `flow`, and optionally `from=api:<id>` for the breadcrumb. Read and write them through the typed `catalog-url.ts` helpers. Then delete `catalogFocus`, `catalogNavigation` and the `key` hacks. Keep `useState` only for ephemeral UI such as `SchemaExplorer`'s trail.

### [MEDIUM] Arrow-keying through tabs and every catalog click push browser history entries
- **File**: src/components/component-inspector.tsx:241, :285-293, :70; src/components/catalog-browser.tsx:21, :24-25
- **Category**: best-practice / accessibility
- **Problem**: `updateCatalog` calls `setParams(..., { preventScrollReset: true })` without `replace`. With automatic activation (the keyboard handler calls `setTab(next)` on every ArrowLeft/Right/Home/End), moving focus across five tabs creates five history entries. The same applies to the Request/Response/Data-flow payload tabs (`setFlowOpen` → `apiView`), to group-filter changes, and to each entity click in `CatalogBrowser`. Only search queries use `replace: true`.
- **Impact**: The Back button walks back through keyboard focus moves and filter tweaks instead of leaving the page, which is especially disorienting for keyboard and screen-reader users.
- **Recommendation**: Use `replace: true` for tab switches and filter changes. Push history only for meaningful navigation, such as selecting an entity or following a flow link. Encode the rule once in the `catalog-url.ts` writer (for example `writeCatalogLocation(params, patch, { history: 'replace' | 'push' })`).

### [MEDIUM] `ComponentInspector` is a god module; proposed split into focused files
- **File**: src/components/component-inspector.tsx (entire file; lines 281 = 1,125 chars, 308 = 1,461 chars, 326 = 838 chars, 269 = 622 chars)
- **Category**: architecture / readability
- **Problem**: One file hosts 12 components/helpers covering at least seven concerns:
  1. schema browsing (`referencedSchemas`, `SchemaExplorer`, `RecordFields`);
  2. endpoint detail with its own tablist;
  3. four catalog panels with entry-building and filter logic written inline in JSX props (the API `entries=` mapper, including search-text generation, sits inside the 1,461-character line 308);
  4. execution-flow wiring (`EndpointFlows`, `ContextFlows`, `navigateCatalog`, `flowOrigin`);
  5. the prose-generating "mental model";
  6. dependency lists;
  7. provenance panels (retired records, findings, coverage report).

  `ComponentInspector` itself holds 5 `useState`s, URL state, and render-prop factories (`contextFlows`, `emptyCatalog`) that return JSX. Kind lists are also duplicated: `['database','cache','object-storage','local-storage']` appears at :140 and :256, although `infrastructureKinds` and `isInfrastructureComponent` already exist in `data/component-structure.ts`.
- **Impact**: It is hard to review diffs (a one-word change rewrites a 1,400-character line), impossible to unit-test the logic, and easy to break things across concerns.
- **Recommendation**: Proposed module layout:
  - `components/catalog/schema-explorer.tsx`: `SchemaExplorer` and `FieldTable` (merge the near-identical field tables at :44-56 and :103-108).
  - `components/catalog/endpoint-detail.tsx`: `EndpointDetail` and `EndpointFlows`.
  - `components/catalog/api-panel.tsx`, `data-panel.tsx`, `messages-panel.tsx`, `jobs-panel.tsx`: one panel per tab, each owning its filters.
  - `components/catalog/provenance.tsx`: `SourceEvidence`, `CatalogGaps`, `RetiredRecords`, `Findings`, `CoverageReport`.
  - `components/component-overview.tsx`: `ComponentMentalModel` and `DependencyGroup`/`DependencyEntry`.
  - `components/component-inspector.tsx`: a shell under 80 lines for the heading, tablist and panel switch.
  - `hooks/use-catalog-location.ts`: typed URL state and `navigateCatalog`.
  - `ui/use-roving-tabs.ts`: shared keyboard handling (see the tablist finding below).
  - Pure logic in `data/`: `catalog-entries.ts` (endpoint/record/message/job → `CatalogEntry`, including search text), `api-schemas.ts` (`referencedSchemas`, id/name indexes), `component-narrative.ts` (`readableList`, entry-point/state/boundary sentences, `dependencyContextLabel`), `catalog-tabs.ts` (tab list and count/'—' rules).

  Break the JSX so that no line exceeds roughly 160 characters.

### [MEDIUM] The inspector renders every hidden tab panel and rebuilds derived data on every URL change, including each search keystroke
- **File**: src/components/component-inspector.tsx:254-256, :301-326, :308; src/components/catalog-browser.tsx:27-39
- **Category**: performance
- **Problem**: Panels are hidden with the `hidden` attribute, not left unmounted, so the API, Data, Messages and Jobs `CatalogBrowser`s, plus a compact `DataCatalog` for each linked datastore (:318), all render on every render. Each `CatalogBrowser` subscribes to `useSearchParams`, so a keystroke in the API search (URL `replace`) re-renders the whole inspector. Each such render:
  - rebuilds `schemas`, `filteredEndpoints` and the endpoint entries;
  - for every endpoint, runs `referencedSchemas` regexes over request/response and flattens all their fields into search text;
  - filters and sorts all four catalogs;
  - runs every browser's `useLayoutEffect`, because `scrollKey` includes `params.toString()`.

  Nothing is memoised.
- **Impact**: Typing lag grows with the size of the catalog (hundreds of endpoints or schemas is realistic for scanned services), and every panel does wasted work.
- **Recommendation**: Mount only the active panel (`{tab === 'api' && <ApiPanel/>}`); scroll restoration is already handled by `CatalogBrowser`. `useMemo` the entry arrays and the schema indexes on `[component]`, with filters applied afterwards. Narrow `scrollKey` to the browser's own params instead of the whole query string.

### [MEDIUM] No component tests; much pure logic is trapped inside JSX
- **File**: src/components/component-inspector.tsx, system-overview-map.tsx, execution-flow.tsx, catalog-browser.tsx (no tests exist); tests/system-map-*.test.ts
- **Category**: testing
- **Problem**: The layout and physics tests are good, but none of the ~900 lines of the four heavy components listed above has a test. Branching logic that could be unit-tested as pure functions is embedded in render bodies:
  - the tab count/'—' rule (:295);
  - retired-selection resolution (:245);
  - `DependencyEntry`'s 5-way context label (:141-149);
  - the mental-model sentence assembly (:181-213);
  - endpoint search-text building (:308);
  - `edgePorts` and the edge label/marker building (`system-overview-map.tsx:75-90`, :245-267);
  - ELK result → route/label conversion (`execution-flow.tsx:37-44`);
  - `CatalogBrowser`'s URL-vs-local state selection.

  The hooks config also lacks `react/exhaustive-deps`, although `src/` passes it today (verified with `npx oxlint --react-plugin -D react/exhaustive-deps src`).
- **Impact**: The HIGH/MEDIUM bugs above (stale params, retired selection, schema-by-name) would each have been caught by a small unit test. Refactoring the god component has no safety net.
- **Recommendation**: Extract the functions listed in the decomposition finding and test them with `node:test` like the existing suite. Add a round-trip test from `server/catalog.ts` deep links to `readCatalogLocation`. Add `"react/exhaustive-deps": "error"` to `.oxlintrc.json` to lock in today's clean state. If DOM tests are wanted later, a thin jsdom plus `@testing-library/react` smoke test for the tablist keyboard contract gives the most value for the effort.

### [LOW] Map simulation ticks re-create every node's `data` and every edge, which defeats `memo(SystemMapNode)`
- **File**: src/components/system-overview-map.tsx:169-179, :239-267
- **Category**: performance
- **Problem**: `syncNodes` runs `setNodes` on each d3 tick. About 160 ticks follow each drag release (alphaDecay .035 down to the 0.001 threshold). On every render, `displayNodes` spreads a new `data` object for every node (`data: { ...node.data, isPinned, onUnpin }`), so the memoised `SystemMapNode` re-renders even for nodes that did not move. `nodeById` and the full `edges` array (new `labelStyle`, `markerEnd` and similar objects) are rebuilt without memoisation. `onInit`, `onNodeClick` and the MiniMap `nodeColor` are new closures on every render.
- **Impact**: This work is invisible on small maps but grows as O(nodes + edges) React work per frame during animation on larger products. The O(n²) collision force adds to it.
- **Recommendation**: Cache the per-node `data` objects (for example a `useMemo` keyed on `[baseNodes, pinnedIds]` that is independent of position, merged with position only) so `memo` holds. Compute port assignments separately and rebuild `edges` only when a port pair or the focus changes. Hoist the static style and marker objects to module constants.

### [LOW] ELK is loaded twice through ad-hoc imports and runs on the main thread
- **File**: src/components/system-overview-map.tsx:202-205; src/components/execution-flow.tsx:34-35
- **Category**: performance
- **Problem**: Both components `import('elkjs/lib/elk.bundled.js')` and call `new ELK()` for each layout. The bundled build runs a FakeWorker on the main thread, so parsing the 1.4 MB chunk and running the layout both block the UI. The instances are never terminated, and a stale layout cannot actually be cancelled; only its result is ignored.
- **Impact**: The UI janks on first map load and while the "Auto layout" or "Branch map" views are computing. The loading and error-handling logic is duplicated, and one copy has no error handling (see the stuck-spinner finding).
- **Recommendation**: Add `src/lib/elk.ts` exporting `layoutGraph(graph, signal?)`. It should lazily create a single ELK instance backed by a real worker (`new ELK({ workerFactory: () => new Worker(new URL('elkjs/lib/elk-worker.min.js', import.meta.url)) })`), memoise the load promise, and reset it on failure. Optionally prefetch on idle or on hover of "Branch map".

### [LOW] Brittle IDs: `${from}-${to}` edge IDs can collide, and `systemMapLayout` crashes on duplicate component IDs
- **File**: src/components/system-overview-map.tsx:254; src/lib/system-map-layout.ts:22-25
- **Category**: correctness
- **Problem**: The data layer deliberately keys edges with `JSON.stringify([from, to])` (`component-structure.ts:85`, `system-map-layout.ts:72`), but the ReactFlow edge id is `` `${from}-${to}` ``, and IDs are dash-heavy (`observed-queue-kafka`). As a result, the pairs `a-b`→`c` and `a`→`b-c` collide. Separately, the layout loop runs `while (seen.size < components.length || ...)` against a deduplicated `byId`. With duplicate IDs it throws `outgoing.get is not a function or its return value is not iterable` (reproduced with `systemMapLayout([c('a'), c('a')], [])`).
- **Impact**: The collision is unlikely today but silently drops or merges an edge in ReactFlow. The layout crash is unreachable with the current caller, which deduplicates upstream.
- **Recommendation**: Use `JSON.stringify([from, to])` for edge IDs, and use `byId.size` in the loop condition (or deduplicate explicitly).

### [LOW] Magic numbers, duplicated palette and duplicated kind mappings
- **File**: src/lib/system-map-physics.ts:29-58; src/components/system-overview-map.tsx:22-31, :147, :166, :234, :319; src/components/execution-flow.tsx:35, :46, :49; src/components/component-structure.tsx:9; component-inspector.tsx:140
- **Category**: readability
- **Problem**:
  - The physics tuning constants are anonymous: `.3`, `.025`, `.035`, `.4`, collision gap `24`, push factor `.7`.
  - Interaction alphas (`.55`, `.35`, `.25`) and fitView paddings/zoom limits (`.1`, `.16`, `.9`, `1.7`) are scattered.
  - Execution-map node size `260×84`, fallback spacing `170` and label width `length * 6.5 + 12` repeat across the ELK input, node style and fallback.
  - `kindColors` hex values duplicate `.kind-*{--kind-color}` in `planning.css:388-395`.
  - The kind → icon mapping is written twice with different results (`ComponentIcon` maps object/local storage to `HardDrive` and queue to `Network`; `DependencyEntry` maps them to `Database`/`Network`).
- **Impact**: Tuning becomes guesswork, the palette can drift between the map and the legend, and the same kind gets a different icon on different screens.
- **Recommendation**: Name the constants (`LINK_STRENGTH`, `SEED_PULL`, `CARD_GAP`, `DRAG_ALPHA`, ...) in `system-map-physics.ts` and give each a one-line comment. Read kind colours from CSS (`var(--kind-color)` via a `kind-${kind}` class on the node) instead of a TS table. Share one `componentKindIcon(kind)` helper.

### [LOW] Dead code: `ProductArchitecture` and its CSS
- **File**: src/components/component-structure.tsx:25-48; src/styles/planning.css:333-337
- **Category**: architecture
- **Problem**: `ProductArchitecture` is exported but imported nowhere in `src`, `tests` or `server`. The `.architecture-node*` styles and the whole `render` closure (including the O(n·e) `graph.nodes.find(...)!` lookups) exist only for it. `ComponentOptions` also re-walks ancestors with `components.find` inside a `while` for each row (O(n²·depth)), where `componentAncestors` already exists.
- **Impact**: It adds maintenance load and misleads readers about which architecture view is live.
- **Recommendation**: Delete `ProductArchitecture` and its CSS. In `ComponentOptions`, use `componentAncestors(component.id, components)[0]` to find the root.

### [LOW] Tablist and modal accessibility details
- **File**: src/components/component-inspector.tsx:76-85, :285-293; src/ui/tabs.tsx; src/components/system-overview-map.tsx:118-138, :276; src/components/system-diagram.tsx:61-76
- **Category**: accessibility
- **Problem**:
  - The roving-tabindex keyboard handler is copied verbatim for the inspector tabs and the payload tabs, while the shared `ui/Tabs` primitive has no keyboard support, `tabIndex` or `aria-controls` at all.
  - The map's focus-trap selector (`button:not(:disabled), a[href], select, [tabindex="0"]`) misses `input`, `textarea` and positive/other tabindex values.
  - The trap only wraps when focus is already on the first or last element.
  - The map `div` carries `aria-label="Full dependency map"` even when it is not a dialog (a generic `div` with no role should not be labelled).
  - The component picker in `SystemDiagram` does not close on outside click, handles Escape only inside the search input, and does not return focus to its trigger.
- **Impact**: Keyboard behaviour is inconsistent across tablists and the popover, and the trap can leak focus.
- **Recommendation**: Extract `useRovingTabs(ids, active, onSelect)` into `ui/` and use it in `ui/Tabs`, the inspector tabs and the payload tabs. Use a shared focusable-selector constant. Apply `aria-label` only when `role="dialog"`. Give the picker a small `usePopover` (outside click, Escape, focus return).

## Positive notes
- The stale-layout guard is correct: `layoutVersion` is checked after both the dynamic import and the ELK layout, and effect cleanup (`cancelLayout`) bumps it. Every effect in the slice cleans up its listeners, `ResizeObserver`, rAF handles and `document.body.style.overflow`. Hook dependency arrays are complete.
- The physics simulation is created stopped (`.stop()…alpha(0)`) and ticks only after a drag or release. Keeping the d3 physics state in refs, outside React state, while React Flow owns the dragged node, is a sound split.
- `system-map-layout.ts` is deterministic, independent of input order, handles cycles and islands, and its tests assert geometric properties rather than snapshots. The physics tests check behaviour (a pinned card stays still, neighbours respond on the first tick, the simulation settles).
- The copy is carefully epistemic ("not a runtime recording", "does not by itself confirm an active publisher") and the tablist ARIA wiring (`aria-controls`/`aria-labelledby`/`useId`) is thorough.
- `ExecutionFlowExplorer` already shows the right pattern for async layout: an `active` flag, `.catch` with a fallback layout, and a status message.

## Suggested refactor plan for this slice
1. Introduce `src/data/catalog-url.ts` (param names, read/write/clear helpers, kind → param mapping) shared with `server/catalog.ts`. Fix `inspectComponent` and the retired-selection tab bug, and add round-trip tests.
2. Make map layout key on a structural signature and move `observedStatus`/`selectableIds`/color into the `displayNodes` memo. Remove the `new Map()` default and add error handling with a fallback to `runLayout`.
3. Move the remaining local catalog state (method/version/direction filters, endpoint flow choice, flow origin) into the URL, and delete `catalogFocus`, `catalogNavigation` and the remount keys. Use `replace` for tab and filter changes.
4. Split `component-inspector.tsx` along the module map in the decomposition finding. Extract the pure logic (entries, schema indexes by id, narrative, tab counts, dependency label) to `data/` with `node:test` coverage. Mount only the active panel and memoise per component.
5. Add a shared `lib/elk.ts` (worker-backed, memoised loader) and use it from both the map and the execution flow.
6. Extract `useRovingTabs` into `ui/` and adopt it in `ui/Tabs` and both inspector tablists. Enable `react/exhaustive-deps` in `.oxlintrc.json`.
7. Name the physics and layout constants, derive kind colours from CSS, fix edge IDs, and delete `ProductArchitecture`.
