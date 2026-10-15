# Architecture

Groundwork is a Next.js site built as static files. At build time it reads the YAML in `workspaces/`, works out
what each page says, and renders it. Nothing runs on a server.

The layers below are enforced by `eslint.config.mjs`, and `test/architecture.test.ts` proves every rule still
fires. If a rule gets in the way, change the architecture on purpose, here and in the config, not with a
disable comment. Unused disable comments are errors.

## The model

A **workspace** holds **domains**. A domain holds **systems**. A system holds **components**. Plans live at
workspace level and may cross any domain. These four words are the only levels; one word per idea.

**Component** is the umbrella word for anything a system is built from. A component has a kind: a **service** (a
deployable microservice, worker or job), a **store** (a database), a **topic** (a queue or event stream), or a
user-facing app. Say "service" only when you mean that kind; say "component" when you mean any of them.

```
workspaces/<workspace>/workspace.yaml
  domains/<domain>/domain.yaml
    systems/<system>/system.yaml      components and what they talk to
    systems/<system>/contracts.yaml   what its components offer and keep (system model)
  story.yaml                          summary, concepts and stages (system model)
  flows/<flow>.yaml                   one flow per file (system model)
  journeys/<journey>.yaml             a user journey and its interactions (system model)
  assets/                             screen drawings cited by journeys
  scans/<org>/<repo>.yaml             the commit each repo was last read at
  plans/<plan>/plan.yaml              revisions/, status.json, assets/, mockups/
schema/plan.schema.json               the plan format, checked with ajv
```

### The system model

How the systems work today, beside the structure. Every entry is in plan shape (the same `$defs` as
`plan.schema.json`) plus `origin: extracted | seeded | curated`. Sources are `{repo, path, lines, commit,
symbol?}`; the permalink is derived, never stored (a bare `{url}` is still read, for docs and dashboards).
`contracts.yaml` holds a system's stores, interfaces, schemas, messages, screens, graphs, subgraphs and
operations, plus `components:` detail (kind, summary, sources) for components named in `system.yaml`. The
structure stays the source of a component's name, tech and what it does.

- `src/domain/workspace-model.ts` has the types: `WorkspaceModel`, `Attribution` (origin and code sources by id,
  nested ids included) and `Scan` (a repo's high-water mark).
- `src/infrastructure/workspace-model.ts` reads the files (each one optional), takes `origin` off, keeps the
  sources as attribution, turns them into permalinks and checks each entry against its plan `$def`. An id
  defined twice is an error.
- `src/application/workspace-model.ts` `systemModelOf(workspace, model)` assembles one plan-shaped document with
  no changes (teams and colours from `workspace.yaml`, `sys:<system>` per system, components as services or
  stores) and derives it, so every plan view can draw today. A test proves the alder-finch document has no
  validation errors, draws every component and resolves every flow step.

### Plans

- Plan types live in `src/domain/plan/`. `plan.generated.ts` is generated from `schema/plan.schema.json` by
  `npm run generate`; a test fails if it is stale. Generated files are exempt from size limits only.
- Everything worked out from a plan (the derived layer: graph, journeys, impact, delivery, diffs) lives in
  `src/application/plan/`. It is pure, so the same code runs at build time and in the browser.
- Handlers (`h:` ids) say what a component does when an endpoint, message, interaction or schedule reaches it,
  as a tree of steps. `handler-walk.ts` flattens the tree and words each step's guard ("when …", "for each …");
  `check-handlers.ts` validates them; `derive-handler-edges.ts` turns their calls, publishes, reads and writes
  into edges merged into `edges()`; `derive-handlers.ts` gives the Model `handlerEdges`, `handlersOf` and
  `callTree`.
- `src/infrastructure/plan-store.ts` reads plans, revisions and status, and validates them against the schema.
- The plan viewer is one feature, `src/features/plan/`, with subfolders per chapter. Charts that know the model
  stay in the feature; `ui` stays model-agnostic.

### Routes

| Route                                               | Page                                |
| --------------------------------------------------- | ----------------------------------- |
| `/`                                                 | the workspaces                      |
| `/[workspace]/`                                     | the landscape of one workspace      |
| `/[workspace]/[domain]/`                            | one domain                          |
| `/[workspace]/[domain]/[system]/`                   | one system                          |
| `/[workspace]/plans/[plan]/`                        | a plan's cover                      |
| `/[workspace]/plans/[plan]/[chapter]/[screen]/`     | one screen of a plan                |
| `/[workspace]/plans/[plan]/things/[thing]/`         | one thing of a plan, as a page      |
| `/[workspace]/plans/[plan]/plan.json`               | the checked plan, for the browser   |
| `/[workspace]/plans/[plan]/revisions/[v]/plan.json` | an earlier version, for the browser |
| `/[workspace]/plans/[plan]/assets/[...file]`        | a plan's diagrams and images        |
| `/[workspace]/plans/[plan]/mockups/[...file]`       | a plan's mockup pages               |

`plans` is reserved and cannot be a domain id, and `assets`, `mockups`, `things` and `revisions` cannot be
chapters. Screens render on the server. The step, lens and open inspector are client state in the URL. Entity chips render as
`<button data-inspect="id">`; one client inspector catches clicks, fetches `plan.json` once (by a relative URL,
so it works under any base path) and works out the rest in the browser, so no page inlines the plan.

A plan that fails to load or has errors still gets its cover, which shows `PlanErrors`: each error and warning
with its path, and the way back to the workspace. Its other screens are not built, and the workspace's lists leave
it out until it is fixed; its `plan.json` holds only `{ errors }`.

Every thing the inspector can show, except the parts of one (fields, steps and regions), also has its own page at
`things/<token>/`, built by `topThingIds`. It shows the same body as the inspector, with the others of its kind
down the side, the pager and keys stepping through them, Copy link and the today / with-this-plan switch. The
inspector's bar links to it with Open as page.

The team lens is the search parameter `?team=<id>` (with or without the `team:` prefix), and the catalogues'
mode is `?show=asis|tobe|diff`. A static export has one file per route, so each page is built once for everyone
(the lens off, the diff mode) and a small client component, wrapped in `<Suspense>`, reads the search and shows the
cut. `ByLens` holds one render for each team and picks one, which is how Your part (`/cover/part/`) becomes a page
per team; `DimByLens` draws a page once and dims the other teams' rows. The reference catalogues carry each row's
words and teams in `data-search` and `data-teams`, and one filter hides what the lens and the search box leave out.
While a lens is on, `LensCarry` adds `?team=` to a click on a link to another screen of a plan, so the cut follows
the reader; the `j` and `k` keys do not carry it. While a lens is on, `RailCut` hides the rail's screens that are
not the team's (`teamPages`: what it owns, changes, tests, builds or decides; the cover, the why, the reference
and each chapter's first screen stay), and the progress strip above each screen says where it falls in the team's
pages, with Read the full plan to turn the lens off. Without a lens the strip shows the chapter and screen, and the
step a walk stands on (`walkHere`).

The open thing is the hash `#i-<token>`, where the token is the id with `:` and `#` written `-` and `.`
(`svc:orders` is `#i-svc-orders`). Each open or hop pushes a history entry, so Back steps through what was seen and
Close returns to the page; an address pasted cold is adopted as one entry.

Keys are one table in `features/plan/keys.ts` (`keyAction`, and `SHORTCUTS` for the cheat sheet); `PlanKeys` in
`keys.client.tsx` acts on them, and nothing fires while typing in a field. `j` or `→` next screen or walk step,
`k` or `←` previous, `J` and `K` the next and previous chapter, `/` or `⌘K` the palette, `⌘⇧P` the plan switcher,
`T` the next theme, `D` the next view (a walk between today and the plan, or a reference page's radios marked
`data-cycle`), `?` the cheat sheet of keys and symbols, and `Esc` closes whatever is on top. With a dialog open only
`?` passes. Holding `⌥` on a What changes screen fades the plan's new parts (`data-status="added"`) to show today;
the screen's own Show today toggle does the same until pressed again. The plan's bar shows where it stands, a menu
of its versions, a Read as picker that sets `?team=`, search and help; below 56rem those fold behind a More button.

Each history entry carries the trail of ids opened before it, so the inspector's bar shows the last three as
crumbs, and a crumb goes back that many entries. Copy link copies the address, hash and all. A thing that changes
has a switch between today and with this plan; it is client state, starts on the plan, and is not in the address.
Plan-level things (decisions, risks, questions, work items, milestones, changes, tests and scenarios) have no
today and no switch. A flow draws as a sequence, a work item shows its GitHub issue (title, state from
`status.json`, link and the text to file), and an As at picker under the bar opens the thing as it stood in an
earlier version kept in the ledger, from `revisions/<v>/plan.json`. While the inspector is open
every `[data-inspect]` for the open id outside it carries `data-picked`, and on a window at least `72rem` wide the
page narrows by `--inspector-w` so the panel does not cover it. Resting the pointer on a `[data-inspect]` for
280ms, or giving it keyboard focus for 120ms, shows a hover card (type, status, team, what the plan does to it,
its gist); touch never shows one, and a scroll, click, `Esc` or leaving it hides it. The card is `aria-hidden`:
the thing's own name is what assistive tech reads. Anything inside `[data-no-hover]` (the inspector's header)
shows no card.

Walking a flow as it runs today, a step the plan revisits shows `◇ Changes ahead` (`PinAhead`), and reading it
pins what the step carries that the plan changes. Pins are kept per plan in `localStorage` under
`groundwork:ahead:<workspace>/<plan>`, so they outlast a reload. `ChangesAhead`, among the plan's overlays, shows
them as a pill in the corner and a tray listing each with a link to the screen of chapter 4 that draws it
(`aheadStop`, else the ledger). A pin is ticked off once that screen is read; `Esc` or a click outside closes the
tray.

A scenario screen in the journey is a walk: every step of every flow the scenario passes through, in order. It
draws in the browser from `plan.json`. The place on the walk is `?step=<flow or step id>&mode=today|plan`, so a
step can be linked to. While a walk is on the page, `→` and `←` move one step, and leave for the next or previous
screen only at its ends; stepping back into a scenario opens it at its last step. The pager says "Next step" or
"Previous step" with the step's title until the walk's ends. `d` switches between today and
the plan. Disclosures marked `data-keep` and the flow's diagram or sequence view keep the reader's choice across
steps and screens for the session, and the page holds its height and scroll while stepping, so what the reader
is watching stays where it is.

Other screens read in stops keep the stop in `?stop=<key>`: the system map and graph stages on Today, the walk
behind each journey screen, the tabs of the changes screens (flows, screens, versioned interfaces, records, and
the ledger's `component` and `team` groupings), and the Reference's events, where the first stop `all` shows every
line closed and each later stop, `?stop=<event id>`, opens one event's line and brings it into view.
The keys work the same way: `→` and `←` move a stop and leave the screen only at the ends, and stepping back into
a screen opens it at its last stop. While stops are on the page, the pager offers "Next step" or "Previous step"
with the stop's title instead of the next screen. The system map and the build-order graph draw at reading size
and scroll sideways in the page, and the map's stage pills scroll to each stage; full screen still zooms and pans.

The Reference's risk grid filters its register: a click on a cell with risks shows only the risks in it, with
"n of m risks" and a "Clear filter" button, and a second click on the cell clears it. The filter lives in the page,
not the address.

Plan assets and mockups are served by static route handlers from `workspaces/<ws>/plans/<slug>/`, not copied into
`public/`: there is one source, and the URLs mirror the folder layout, so a mockup's `../assets/x.svg` still
resolves.

## Layers

```
app ──▶ features ──▶ ui
 │         │
 │         ▼
 ├────▶ application ──▶ domain ──▶ shared
 │         ▲
 └────▶ infrastructure
tools ──▶ infrastructure, application, domain, shared
```

| Folder                | Holds                                                                                | May import                                  | Packages                              |
| --------------------- | ------------------------------------------------------------------------------------ | ------------------------------------------- | ------------------------------------- |
| `src/domain`          | The model's types and rules                                                          | shared                                      | none                                  |
| `src/application`     | What the app works out from the model: use cases, view models                        | domain, shared                              | none                                  |
| `src/infrastructure`  | Reading the world: files, YAML (checked with zod), git, GitHub. Server only          | domain, application, shared                 | `node:*`, yaml, zod, ajv, server-only |
| `src/features/<name>` | The screens of one feature, in React                                                 | application, domain, ui, shared             | react, next                           |
| `src/ui`              | The design system. Knows nothing of the model                                        | shared                                      | react, next                           |
| `src/shared`          | Small pure helpers (text, dates, collections)                                        | nothing                                     | none                                  |
| `src/app`             | Next.js routes: load with infrastructure, compute with application, render a feature | all of the above                            | react, next                           |
| `tools`               | Command-line tools                                                                   | infrastructure, application, domain, shared | `node:*`, yaml                        |

- Features are reached only through their `index.ts`. A feature never imports another feature; move what they
  share to `ui`, `application` or `shared`.
- `src/app` contains only Next.js route files (`page`, `layout`, `not-found`…) and `globals.css`.
- A file outside these folders is an error.
- Imports across folders use `@/`, never `../`.

## Next.js

- Static export only: no `'use server'`, no `revalidate`, no dynamic rendering.
- Server components by default. A client component lives in `*.client.tsx` and starts with `'use client'`; the
  name shows the boundary at every import.
- Internal links use `next/link`. Styles are CSS modules. No `style` props: use a class or a data attribute.
- A component and its CSS module are a pair: `card.tsx` imports `./card.module.css` as `styles` and no other
  file imports it. Every `styles.x` must be a class in the module, and every class in the module must be used.
  Style state with data attributes, not dynamic class names.
- Only `src/app/layout.tsx` imports `globals.css`, which holds the design tokens. Stylelint rejects raw colours,
  sizes, spacing, radii and shadows anywhere else.

## Code

- TypeScript strict, plus `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes`; typed lint rules
  (`strictTypeChecked`).
- No `as` casts outside tests: parse with zod at the edge, narrow everywhere else. No enums, namespaces or
  classes (except errors). Switches over unions are exhaustive.
- Named exports only, except where Next.js or a tool config needs a default.
- Small pieces: 300 lines a file, 60 a function (120 for a component), 3 parameters, depth 3, complexity 12.
- kebab-case file names. Tests sit next to the code as `*.test.ts(x)`; component tests use jsdom.
- knip fails on unused files, exports and dependencies. Coverage of domain, application and shared stays at 90%.

## Checks

| Command                             | Runs                                                                                              | When                        |
| ----------------------------------- | ------------------------------------------------------------------------------------------------- | --------------------------- |
| `npm run lint:changed`              | ESLint on changed and new files, and the component behind any changed CSS module                  | while working               |
| `npm test` / `npm run test:changed` | unit tests (all, or those touched by changes)                                                     | while working               |
| pre-commit hook                     | ESLint, Stylelint and Prettier on staged files, `tsc`, and the tests related to them, in parallel | each commit                 |
| `npm run check`                     | typecheck, lint, styles, format, cycles (dpdm), knip and all tests with coverage, in parallel     | pre-push hook               |
| CI                                  | `npm run check` from cold, then `npm run build`                                                   | every push and pull request |

ESLint, Stylelint, Prettier and `tsc` keep caches in `node_modules/.cache`, so a rerun only rechecks what
changed. A cached lint can miss an error that a change in one file causes in another; `tsc`, the pre-push check
and CI catch it. Import cycles are checked by dpdm rather than `import/no-cycle`, which walks the whole graph for
every file.
