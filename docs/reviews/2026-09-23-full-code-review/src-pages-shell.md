# Viewer app shell, pages, spec components, UI primitives, mocks and styles

## Summary
The viewer is functionally rich and the thinking behind it shows. It uses ARIA in the right places (aria-current, aria-pressed, skip link, keyboard-operable SVG flow nodes). It uses the derived-state pattern correctly (`useDisclosures`, the `view.focus !== focus` resets). The whole app type-checks under `--strict` and `react/exhaustive-deps` with zero findings. The biggest risks are in the shell. `<Routes>` is keyed on the plan revision, so every plan edit remounts the whole UI and throws away scroll, focus, search text and disclosure state. There is no error boundary anywhere, so a failed lazy chunk or any render exception blanks the page. Hand-rolled scroll restoration saves the wrong position. Maintainability is the second concern. There are two parallel design systems: `src/ui` primitives that are used almost only by the /design showcase, next to about 2,100 hand-written CSS rules. About 20% of those rules are dead, and there is a second full colour palette in workbench.css. Pages are very dense JSX that embeds business logic, which has no tests. Several label and status vocabularies are duplicated and have drifted apart.

## Findings

### [HIGH] Routes keyed on `token:revision` remount the whole app on every plan edit
- **File**: src/app.tsx:22 (with src/shell/layout.tsx:16-24, src/pages/feature.tsx:51, src/shell/top-bar.tsx:21)
- **Category**: correctness
- **Problem**: `<Routes key={`${runtime.plan?.context.token ?? "unavailable"}:${runtime.plan?.revision ?? "empty"}`}>`. `revision` is a hash of the plan's storage files (server/repository.ts `revision(...)`), so it changes on every file save by the user or an agent. Because `Layout` and `TopBar` sit inside the keyed tree, a change causes:
  - `Layout` to remount with `previousPath.current === undefined`. Its layout effect then runs `window.scrollTo({ top: … positions.current.get(pathname) ?? 0 … })`, and the `positions` Map is new and empty, so the page scrolls to 0. It also runs `main.current?.focus()`, which takes focus away from wherever the user was.
  - `FeaturePage` to remount, and `useEffect(() => { if (!item) window.scrollTo({ top: 0 }) }, …)` scrolls feature sections to the top.
  - All local state to reset: the TopBar search query (`useState('')`), open `<details>` and disclosures in API, storage and delivery, the tests filter, the flow zoom. On the product page the ReactFlow/d3-force simulation and ELK layout also restart.
- **Impact**: While an agent edits the plan, which is the core workflow, the page jumps to the top, focus moves, half-typed searches are cleared and expanded panels collapse on every save. The remount does not buy freshness either. `App` already calls `useRuntime()` and nothing is memoised, so every publish re-renders the whole tree anyway.
- **Recommendation**: Drop `revision` from the key, and key only on `context.token`, or on nothing. Where local state can refer to removed IDs, clean it up locally: disclosures already tolerate unknown IDs, and pages already `<Navigate>` when an entity disappears. Pass data through context instead of relying on a remount (see the global `q` finding).

### [HIGH] No error boundary anywhere: lazy-chunk failures and render exceptions blank the page
- **File**: src/app.tsx:9-10, src/shell/layout.tsx:34
- **Category**: best-practice
- **Problem**: `grep -rn "ErrorBoundary\|componentDidCatch\|getDerivedStateFromError\|errorElement" src` returns nothing. `FeaturePage` and `DesignSystemPage` are `lazy(() => import(...))` behind a bare `<Suspense>`. Render code also throws in several places: `knowledgeBaselineSchema.parse(JSON.parse(raw))` runs during render (feature.tsx:39-40), and there are non-null assertions such as `q.product(f.productId)!` (feature.tsx:54-55) and `q.features().find(...)!` (spec/flow.tsx:74).
- **Impact**: The Hub is long-running. After an upgrade or rebuild, an open tab still references old hashed chunks. The first navigation to `/f/...` rejects the dynamic import, and React 19 then unmounts the root, leaving a white page with no message. Any single bad record takes down the whole viewer the same way.
- **Recommendation**: Add a small class `ErrorBoundary` around `<Outlet/>` in `Layout`, with its reset key set to the pathname. Add another at the root in main.tsx. Show a "Reload" action, and detect chunk-load errors (`/Failed to fetch dynamically imported module/`) so the page can reload itself once.

### [MEDIUM] Scroll restoration records a clamped position and keys it by pathname
- **File**: src/shell/layout.tsx:16-24
- **Category**: correctness
- **Problem**: `return () => { saved.set(pathname, window.scrollY) }` is a layout-effect cleanup. For function components, React runs it in the commit's mutation phase, after the child DOM has already been swapped to the new route. Reading `scrollY` at that point forces layout against the new, possibly shorter, document, so the value is clamped. This always happens on the first visit to a lazy route, because the "Loading view…" fallback is committed in the same pass. Positions are also keyed by `pathname` rather than `location.key`, so two history entries for the same path share one slot.
- **Impact**: Back to a long list after visiting a short page, or any not-yet-loaded feature page, restores to the top or a wrong offset. This is the behaviour the comment on line 14 promises to prevent. I verified it by reading React's commit order; it still needs a check in a browser.
- **Recommendation**: Record the position before navigating: a passive `scroll` listener that writes to `positions[location.key]`, or `history.scrollRestoration` with a throttled `sessionStorage` save. Alternatively, move to `createBrowserRouter`, whose `<ScrollRestoration getKey={…}>` handles this.

### [MEDIUM] Two parallel design systems; directory.css overrides Tailwind utilities and workbench.css redefines the palette
- **File**: src/ui/* ; src/styles/workbench.css:2-24,316 ; src/styles/directory.css:75-78,155-159 ; src/styles/tokens.css:70-90
- **Category**: architecture
- **Problem**: Apart from the /design showcase, the `src/ui` primitives are barely used. Only `StageBadge`, `Badge`, `Tooltip`, `Glass` and `EmptyState` have callers. `Glass` and `EmptyState` are used only by the unused sections.tsx, and `Button`, `Card`, `Input`, `Select`, `Tabs`, `Avatar`, `Progress` and the rest have no production callers. Real pages use about 400 bespoke classes instead. The CSS then works against the utility layer:
  - `.directory-shell .text-display { font:… }`, `.directory-shell button.bg-accent {…}` and `.directory-shell :is(.glass-1,.glass-2,.glass-3) {…}` re-style Tailwind utility output.
  - workbench.css redeclares every semantic token with 53 raw hex values, for example `--accent:#b8a8f4` / `#6252bd` against tokens.css `--accent:#5b6cff`, driven by a separate JS attribute `data-workbench-theme`.
  - planning.css:233-241 adds a third, media-query-based override.
- **Impact**: The same token (`--accent`, `--bg`, `--fg-subtle`) has different values on directory pages and feature pages. A theming change has to be made in three places, and the /design page documents components the product does not use. This is also the main reason the CSS bundle is 268 KB (43 KB gzip).
- **Recommendation**: Choose one approach. Either promote the bespoke patterns that repeat (list tabs, board heading, status pill, coordination card) into `src/ui` components and delete their CSS, or delete the unused primitives. Define the workbench palette as a second token set in tokens.css (`[data-density=workbench]`) instead of hex literals in workbench.css, and drive it through the same `data-theme` attribute.

### [MEDIUM] About 20% of the hand-written CSS is dead, and the "grain" skin cannot be reached
- **File**: src/styles/planning.css, directory.css, runtime.css, workbench.css; src/styles/tokens.css:205-351; src/lib/theme.tsx:17-26
- **Category**: performance
- **Problem**: A scripted scan compared class selectors with the identifiers in src/**/*.ts(x) and index.html, excluding `react-flow__*` and the template-literal prefixes `method-`, `schema-state-`, `kind-` and others. It found 423 of 2,139 rules (about 45 KB of source) whose every selector names a class that never appears. By file: planning.css 278 rules, directory.css 93, runtime.css 25, workbench.css 25. Examples: `.outcome-panel` (8 rules), `.readiness-panel`, `.system-neighborhood-*`, `.system-relation-*`, `.component-inspector-grid`, `.endpoint-index`, `.product-component-card`, `.repository-bar`. `git log -S` shows they were orphaned by earlier UI rewrites. Separately, `setSkin` has no callers, so the `data-skin="grain"` token blocks (about 145 lines) and `[[data-skin=grain]_&]` variants such as card.tsx:13 apply only if someone edits localStorage by hand.
- **Impact**: Larger CSS, slower cascade work, and misleading code: 393 selectors are declared more than once, so it is hard to tell which rule wins.
- **Recommendation**: Delete the dead rules. The scan (grep every class selector against src/ and index.html) is easy to add to CI. Either expose the skin in the UI or delete it. Split planning.css (868 lines) by feature area next to the components that use it.

### [MEDIUM] Low-contrast and very small text tokens
- **File**: src/styles/tokens.css:75,83 ; src/styles/planning.css:563-677 (e.g. :627 `.schema-browser-field small { … font-size:8px }`)
- **Category**: best-practice
- **Problem**: On directory pages in light theme, `--fg-subtle:#8b8f9a` on `--bg:#f4f4f6` is 2.94:1, and `--warning:#c27a08` is 3.14:1. I computed both with the WCAG formula. These colours carry real text: breadcrumbs, `.board-list-context`, `.eyebrow`, `Gap` warnings and 37 `text-fg-subtle` usages. The stylesheets also contain 39 `font-size:8px` and 54 `9px` declarations, and some are live, for example `.schema-browser-field` and `.component-data-gap`, which component-inspector.tsx uses.
- **Impact**: Fails WCAG AA (4.5:1) for secondary text. 8-9px text is unreadable for many users and does not scale with the user's font-size preference.
- **Recommendation**: Darken the light `--fg-subtle` to about `#6b707c` (4.6:1) and `--warning` to about `#9a6106`. Set a floor of 11px (`--text-micro`) and replace the px literals with the typography tokens.

### [MEDIUM] The same enum has different wording in different places; helpers are duplicated per file
- **File**: src/components/spec/api.tsx:14, src/components/spec/change-meta.ts:3-9, src/components/spec/response-schema.tsx:4, src/pages/delivery.tsx:7-12, src/components/spec/api.tsx:16-18
- **Category**: readability
- **Problem**:
  - `updated` is labelled 'Modified' in api.tsx (`const changeLabel = { … updated: 'Modified' …}`), 'Changed' in change-meta.ts (used by `ChangeMark` on the feature overview and by storage), and 'Updated' in response-schema.tsx. One contract can therefore show "Changed" on the overview and "Modified" in the API section.
  - `changeMeta[*].color` and `changeSummary()` have no callers.
  - `InlineText` (delivery.tsx) and `Prose` (api.tsx) are two backtick-to-`<code>` parsers.
  - Owner initials are computed inline five times (feature.tsx:108,113; feature-row.tsx:16; top-bar.tsx:46; ui/avatar.tsx:7), with different rules: `split(' ')` against `split(/\s+/).slice(0,2).toUpperCase()`.
  - The URL-filter updater is copied three times (home.tsx:20, workspace.tsx:19, product.tsx:44-49), as is the tabs, list-context and empty-state block (home.tsx:45-47, workspace.tsx:58-60, product.tsx:87-89).
- **Impact**: Users see inconsistent labels, and every copy has to be fixed separately.
- **Recommendation**: Make `change-meta.ts` the single source for change labels and glyphs, and remove the unused fields. Add a shared `ui/inline-markdown.tsx`, an `initials()` helper or the `Avatar` component, a `useUrlFilter()` hook, and a `<FeatureWorkList views=… rows=… />` component.

### [MEDIUM] Components read a mutable module-global `q` alongside memoised per-snapshot repositories
- **File**: src/pages/feature.tsx:42-57, home.tsx:15-16,23, workspace.tsx:15, product.tsx:24-43, delivery.tsx:15,35, shell/top-bar.tsx:15-27, spec/*.tsx (15 files import `q`)
- **Category**: architecture
- **Problem**: `HomePage` uses `useHome()`, which builds its own `createRepository(snapshot)` in `useMemo`, and also calls `q.workspaces()` and `q.products()` from the global that `attachSnapshot` reassigns. Leaf components such as `FeatureRow`, `CheckPlan` and `ApiContractCard` also read `q` directly. Correctness depends on the global being swapped before `publish()` (runtime.ts:111-112) and on the whole tree re-rendering, which the remount in the first finding forces.
- **Impact**: There are two sources of truth, and nothing can be rendered in isolation or tested without the module singleton. This dependency is the reason the remount key looked necessary.
- **Recommendation**: Provide a `RepositoryContext` from `App`, holding `useMemo(() => createRepository(snapshot), [snapshot])`, add a `useQuery()` hook, and remove `export let q`.

### [MEDIUM] Business rules live in very long JSX lines and have no tests
- **File**: src/pages/feature.tsx:119 (≈1,500 chars), feature.tsx:110,122-123,134; src/pages/projects.tsx:10-32; src/pages/delivery.tsx:87
- **Category**: testing
- **Problem**: The feature "next step" logic is a nested ternary chain inside one line: `!spec.purpose ? 'Shape the brief' : gaps ? 'Close the validation gaps' : !cases.length ? … : passing < cases.length ? …`. Its paragraph text repeats the same chain. projects.tsx derives primary checkouts, component de-duplication and stage counts inline in render. No test in tests/ imports any file under src/pages, src/components or src/shell.
- **Impact**: This decision logic is what users act on, and a regression in it would not be caught. The lines are also nearly impossible to review in a diff.
- **Recommendation**: Extract pure view models such as `featureNextStep(spec, ix)` and `summarizeHubProducts(projects)` into src/data, as was already done for workspace-view.ts, which is tested. Test them with node:test. Break the JSX into named subcomponents (`FeatureIntent`, `NextStepPanel`, `DiscoveryChecks`, `PlanIndex`).

### [MEDIUM] The code-split is backwards: the product page's map stack is eager and the feature page is lazy
- **File**: src/app.tsx:3-10, src/pages/product.tsx:8, src/main.tsx:4
- **Category**: performance
- **Problem**: `ProductPage` is imported eagerly and pulls in `SystemDiagram`, then `SystemOverviewMap`, then `@xyflow/react` (233 KB ESM) and `@xyflow/system` (155 KB), plus d3-force. The build confirms all of it is in the entry chunk (`index-*.js` 488 KB, with 55 `react-flow` hits). The xyflow stylesheet is imported globally in main.tsx. `FeaturePage` (88 KB) is the one that is lazy.
- **Impact**: The Home page and the Hub project list, the most common entry points, download and parse the graph library.
- **Recommendation**: `lazy()` `ProductPage`, or better, lazy the `SystemOverviewMap` inside `SystemDiagram`, and move the xyflow CSS import into that module. Correction to the brief: `src/mocks` is not in the entry chunk. It is bundled only with the lazy feature chunk.

### [MEDIUM] Leftover "portfolio" and demo code paths that the runtime cannot reach
- **File**: src/components/sections.tsx (whole file); src/components/workspace-emblem.tsx:5; src/shell/top-bar.tsx:30,46; src/components/spec/flow-inspector.tsx:48,84; src/mocks/*, src/components/spec/design.tsx:21
- **Category**: architecture
- **Problem**:
  - Nothing imports sections.tsx (`SectionHead`, `StageGroups`, `IdeaList`, `ShippedList`).
  - `WorkspaceEmblem` hard-codes demo slugs: `{ ecom: Blocks, groundwork: Command, 'image-lab': Aperture }`.
  - In TopBar, `{plan ? 'Project' : 'Workspaces'}` sits inside the `!plan` branch, and the viewer avatar never renders because the runtime project.json has no `viewerId` (server/format.ts sets `documents['project.json'] = { schemaVersion: 1 }`).
  - `FlowInspector` handles `selection.kind === 'none'` ("Action details" and the guide list), but flow.tsx:142 only mounts it when `selection.kind !== 'none'`.
  - `server/format.ts:87` calls `loadContent(documents)` with no live-prototype IDs. Any `kind: 'live'` mockup is therefore rejected in real plans, and the `mocks` registry is reachable only from fixtures and legacy export.
- **Impact**: Readers spend time on code that cannot run, the bundle carries it, and the design-system page presents dead components as current.
- **Recommendation**: Delete sections.tsx, the unreachable TopBar branches and the FlowInspector 'none' branch. Either pass `livePrototypeIds` in format.ts (if live mocks are meant to be a feature) or move `src/mocks` next to the fixtures. Derive the emblem from the product kind, not the slug.

### [LOW] Render work on every URL change on the feature page
- **File**: src/pages/feature.tsx:39-40,44,89
- **Category**: performance
- **Problem**: Each render runs `JSON.parse` and a zod `.parse` over every baseline (up to 64 KiB) and assessment (up to 256 KiB), even though server/format.ts:64-75 has already validated them. It also runs `buildIndex(spec)`, and creates a new `SpecContext` value object, so every `useSpec()` consumer re-renders. A flow node click changes search params and triggers all of this.
- **Recommendation**: `useMemo` the parsed files on `plan.files` and `id`, and memoise `ix` and the context value on `spec` and `lens`. Or have the server send the parsed packets.

### [LOW] Feature-search accessibility is incomplete, and the theme toggle cannot return to "system"
- **File**: src/shell/top-bar.tsx:31-42,45
- **Category**: best-practice
- **Problem**: The input has `aria-controls` but no `role="combobox"`, `aria-expanded` or `aria-autocomplete`. The results `<div>` has no `role="listbox"` and no option semantics, and the result count is a `role="status"` inside a popup that mounts and unmounts. The theme button only switches `setPref(light|dark)`, so once a user has clicked it they cannot go back to following the OS setting.
- **Recommendation**: Apply the ARIA 1.2 combobox pattern (or treat the results as a menu of links with `aria-expanded`), and keep a persistent visually hidden live region. Add a system option to the theme toggle, for example a three-way menu.

### [LOW] Feature-page navigation: scroll after paint, no focus move, smooth scroll ignores reduced motion
- **File**: src/pages/feature.tsx:51, src/components/spec/context.ts:29
- **Category**: best-practice
- **Problem**: `useEffect(() => { if (!item) window.scrollTo({ top: 0 }) }, …)` runs after paint, so the old scroll offset is visible for a frame. Layout deliberately skips `/f/*`, so a section change does not move focus or announce the new section to screen-reader users. `scrollIntoView({ behavior: 'smooth' })` is used regardless of `prefers-reduced-motion`.
- **Recommendation**: Use `useLayoutEffect`. Focus the section `<h2>` (tabIndex -1) when `section` changes. Use `behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'`.

### [LOW] Central-mode project list bypasses the router and Layout
- **File**: src/app.tsx:20, src/pages/projects.tsx:6
- **Category**: architecture
- **Problem**: `if (runtime.mode === 'central' && !checkoutId) return <ProjectsPage />` renders outside `<Routes>` and `<Layout>`, so the Hub home has no skip link, TopBar, theme toggle or error banner, and any path under `/` shows the list without normalising the URL.
- **Recommendation**: Render the list inside a slim layout, or at least as a route with a `*` redirect, and reuse the skip link and theme toggle.

### [LOW] `tsconfig.app.json` does not enable `strict`, though the code already passes it
- **File**: tsconfig.app.json
- **Category**: best-practice
- **Problem**: Only `"strictNullChecks": true` is set, while the runtime config uses `"strict": true`. `npx tsc -p tsconfig.app.json --noEmit --strict` reports 0 errors today. With `--noUncheckedIndexedAccess` it reports 98 unchecked record lookups, for example 13 in spec/flow-inspector.tsx and 5 in spec/api.tsx, which is the `ix.x[id]` pattern used throughout.
- **Recommendation**: Add `"strict": true` now to lock in the current state. Consider `noUncheckedIndexedAccess` for src/components/spec.

### [LOW] Small correctness and readability issues
- **File**: src/pages/delivery.tsx:87; src/components/spec/journey.tsx:27,45; src/app.tsx:37; src/pages/feature.tsx:101,110,125,127; src/shell/repository-bar.tsx:6
- **Category**: readability
- **Problem**:
  - "Unlinked branches" shows "No branches found" only when `!plan.activity.branches.length`. If every branch is linked, the heading is left empty.
  - `?component=${params.get('component')}` is not URL-encoded (journey.tsx:27), unlike every other call site.
  - `import` statements appear after the code in app.tsx:37 and journey.tsx:45.
  - "of 7 sections" is hard-coded instead of `sectionKinds.length`.
  - Tab and group labels are parallel arrays indexed by position (`['Overview','System flow',…][i]`, `['Define','Experience','Build','Validate'][i]`) even though `groups` already holds the labels.
  - repository-bar.tsx exports `CheckoutMenu`, and its `.repository-bar` CSS is dead.
- **Recommendation**: Filter before the empty check, use `encodeURIComponent` or `URLSearchParams`, move the imports to the top, derive the labels from `groups` and `sectionMeta`, and rename the file to checkout-menu.tsx.

### [LOW] `ui/` primitive API gaps
- **File**: src/ui/tabs.tsx:12-20, src/ui/badge.tsx:33, src/ui/tooltip.tsx:6-16, src/ui/button.tsx:28
- **Category**: best-practice
- **Problem**:
  - `Tabs` sets `role="tablist"` and `role="tab"` but has no arrow-key roving tabindex, no `aria-controls` and no tabpanel. component-inspector.tsx builds its own roving tabs instead.
  - `Tooltip` is a CSS-only `role="tooltip"` that is not linked with `aria-describedby`, so screen readers never hear it.
  - `Badge` has an identical-branch ternary: `hue ? 'bg-current' : 'bg-current'`.
  - Six primitives use `forwardRef`, which React 19 no longer needs because `ref` is a regular prop.
- **Recommendation**: If the primitives are kept (see the design-system finding), give `Tabs` the full keyboard pattern and reuse it in component-inspector, link the tooltip with `useId` and `aria-describedby`, and switch to ref-as-prop.

## Positive notes
- The runtime and state hooks are written carefully. `useDisclosures` and the `view.focus !== focus` resets use React's recommended "adjust state during render" pattern instead of effects. The `useSearchParams` effects in spec/flow.tsx:31-37 and journey.tsx:16-22 are guarded and loop-free, because react-router memoises `searchParams` on `location.search`, so the concern about the params object's identity does not apply. `oxlint -D react/exhaustive-deps` is clean.
- Accessibility intent is visible throughout: a skip link with a focusable `<main>`, `aria-current` on nav and breadcrumbs, `aria-pressed` toggles, keyboard-operable SVG nodes and boundaries with Enter/Space handling, and `ChangeMark` / response-schema signs that do not rely on colour alone (with sr-only labels).
- The UI copy is honest and evidence-oriented ("Drafted does not mean validated", "A link alone does not verify the item"), and it is kept consistent with the data model.
- The spec section registry (`sectionMeta`, `sectionRenderers` and `sectionCount` in spec/index.ts) is a clean extension point that uses a mapped type over `SectionKind`.
- The theme bootstrap in index.html prevents a flash of the wrong theme, and `ThemeProvider` wraps all localStorage access in try/catch.

## Suggested refactor plan for this slice
1. Remove `revision` from the `<Routes>` key and add error boundaries (route-level in `Layout`, root-level in main.tsx) with chunk-load recovery. This is small, high-value work.
2. Replace the scroll restoration with a `location.key`-based store written on scroll, or migrate to `createBrowserRouter` + `<ScrollRestoration>`, and apply the layout-effect scroll and focus fix to feature sections.
3. Introduce `RepositoryContext` / `useQuery()`, remove the global `q` from components, and memoise the index, context value and parsed baselines in feature.tsx.
4. Extract the view models (next step, hub product summaries, delivery activity) into src/data with node:test coverage, and split feature.tsx and delivery.tsx into named subcomponents.
5. Consolidate vocabularies and helpers: change labels via change-meta.ts, inline markdown, initials/`Avatar`, `useUrlFilter`, and a shared `FeatureWorkList`.
6. Clean up the CSS: delete about 423 dead rules and the unused grain skin, unify the workbench palette into tokens.css, fix the `--fg-subtle` and `--warning` contrast, and enforce an 11px minimum type size.
7. Decide what `src/ui` is for: adopt the primitives in the pages or delete the unused ones. Lazy-load the xyflow map, and delete sections.tsx and the demo-only branches (`WorkspaceEmblem` slugs, the viewer avatar, the unreachable FlowInspector branch, or the whole mocks registry).
8. Enable `"strict": true` in tsconfig.app.json, and consider `noUncheckedIndexedAccess` for the spec components.
