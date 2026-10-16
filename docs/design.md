# Design: "Signal"

The tokens live on `:root` in `src/app/globals.css`. Every colour is `light-dark(light, dark)`: the system
decides, unless `<html data-theme="light|dark">` forces one. The root layout applies the stored choice before the
first paint. Stylelint rejects raw colours and sizes anywhere else. Layers, lowest first: `base`, `components`,
`story`, `focus`; component modules sit in `@layer components`.

## Tokens

- `--bg-0…3`, `--bg-overlay`: page, panel, raised and hover surfaces, and the dimmer behind overlays.
- `--fg-1…3`, `--fg-inverse`: text, from strongest to quietest; the third level still passes contrast.
- `--line-1…3`: borders and rules.
- `--accent`, `-hover`, `-fg`, `-soft`, `-line`, `--on-accent`, `--focus`: the only colour that is not a status or a team.
- `--st-add|mod|dep|rem` with `-fg`, `-bg`, `-line`: status colours, the only use of green, amber and rose.
- `--team-1…13`, `--team-tint`: team hues, for a stripe, a dot or a lane tint only.
- `--dot-grid`, `--edge`, `--edge-strong`, `--node-bg`, `--grid`, `--node-h`, `--node-r`, `--edge-w`: diagrams.
- `--shadow-1…3` (built from `--shade-1…3`): elevation.
- `--font-display|body|mono`: Instrument Sans, Inter and JetBrains Mono, loaded with `next/font`.
- `--fs-12…40`, `--lh-*`, `--tracking-*`: the type scale 12/13/14/16/20/28/40.
- `--s-0…16`: space on a 4px grid (`--s-4` is 16px).
- `--r-1…4`, `--r-pill`: radii.
- `--ease`, `--t-1…3`: one curve, 120/200/320ms, zero under reduced motion.
- `--z-raised|sticky|overlay|popover`: stacking.
- `--topbar-h`, `--rail-w`, `--rail-marker`, `--rail-mark`, `--inspector-w`, `--drawer-w`, `--sheet-h`, `--tray-w`,
  `--stage-max`, `--measure`: layout.

## The frame

Every page sits in the same frame, taken from the plan viewer:

- `AppShell({ bar, rail?, overlays?, children })`: the bar on top, a rail on the left when there is one, and the
  stage, centred, at most `--stage-max` wide. An open inspector narrows the page on a wide window instead of
  covering it.
- `AppBar({ lead?, trail?, title?, note?, after?, children? })`: the brand, the trail to where you are (“›”
  between crumbs), the page's name with an optional mono note such as a version and `after` it (a plan's switch
  caret), then actions and the theme in `BarActions`, which fold behind a More button below 56rem.
- `NavRail({ label, groups, children? })`: groups with a circled marker, a title and a count, each opening to its
  items. The current group is open and filled; side groups (Reference, Plans) sit apart under a rule. In a plan the
  groups are chapters; in a workspace they are the landscape, each domain with its systems, and the plans.

The home page has the bar and stage but no rail. The trail lives in the bar, never in the page body.

Below 56rem, on a phone, the frame folds:

- The rail becomes a drawer. `AppShell` holds it in `RailDrawer`, and the shell puts `RailToggle` in the bar's
  `lead`. The toggle opens the drawer over the page with the current page in focus; a tap outside, `Esc`, a link
  followed or a wider window puts it away. On a wide window the drawer is `display: contents` and the rail is the
  grid's first cell as before.
- The inspector rises from the bottom as a sheet, `--sheet-h` tall, with a grab handle, instead of a side panel.
- The stage's padding tightens, and a drawing in a `ZoomPane` keeps its size and scrolls sideways in its frame.

## Primitives (`src/ui`)

Variants are data attributes (`data-tone`, `data-status`, `data-variant`), never extra classes.

- `Badge`: a pill with a tone: neutral, accent or a status.
- `Button`: default, primary or ghost; small or medium.
- `Callout`: an aside with an optional title, as a note or a warning.
- `Card`: a whole-card link to what it names.
- `Facts`: a quiet row of facts (sizes, counts, owners) separated by “·”.
- `Chip`, `ChipList`: `<button data-inspect={id}>` with a type glyph and a status; the inspector catches its clicks.
- `DataTable`: a captioned table that folds to labelled rows when its own width is under 520px. With
  `captionHidden` the caption is for screen readers only, when a `SectionHeading` already names it.
- `Icon`, `Glyph`: line drawings for each kind of thing; `Glyph` draws a text glyph (▣, ⛁) as its icon when it has one.
- `Kbd`: a key or shortcut.
- `Legend`, `LEGENDS`: a boxed strip explaining the glyphs, line styles and status swatches a drawing uses; presets for
  map, sequence, status, types, graph and walk.
- `Menu` (client): a pill button that opens a panel beneath it; a click outside, a link followed or `Esc` closes
  it. `useDismiss` gives the same closing to anything that opens in place.
- `BarActions` (client): the bar's actions in a row, or behind a More button on a narrow window.
- `Markdown`, `InlineMarkdown`: plan prose (paragraphs, lists, quotes, bold, em, code, links, `[[id]]`) rendered
  as React, never as HTML; `renderRef` draws each citation.
- `PageHeader`: the top of every page's stage, in this order: the name of the thing as the `h1`, one line on what
  it is or what is true of it, then `Facts`. Its trail is only for a crumb inside a plan chapter.
- `Panel`: a raised section with an optional title.
- `SectionHeading`: a section's name as an `h2` (a short noun such as “Domains”), with an optional one-line
  description.
- `Tabs`: a row of links; the current one carries `aria-current="page"`.
- `ThemeToggle` (client): cycles system, light and dark, and remembers the choice.

## Headings

Titles name things; the line under a title says what is true. One `h1` a page, from `PageHeader`; an `h2` for each
section; an `h3` for each card. No all-caps labels above titles, and no sentences as titles.

## Plan viewer building blocks (`src/features/plan/common`)

Chapters and charts use these rather than drawing ids or prose themselves.

- `EntityChip({ model, id, label?, status? })`: one thing in the plan as a `Chip`, with the glyph and word for its
  kind, its label (risks, decisions and questions numbered R1, D3, Q2) and its status. A click opens the inspector.
- `EntityChips({ model, ids })`: a `ChipList` of those, each id once; ids or records with an `id`. Nothing when empty.
- `ModelText({ model, text })`: the plan's prose as blocks, each `[[id]]` as an `EntityChip`. Use it for any
  description, why, summary or note.
- `ModelInline({ model, text })`: the same for one line (a title, a table cell), with no paragraph around it.

Their logic is pure and tested: `src/application/plan-chips.ts` (`chipInfo`, `chipName`,
`questionTitle`, `statusWord`), `src/shared/markdown.ts` (`parseMarkdown`, `parseInline`,
`inlineText`, `shortUrl`) and `src/shared/plain-text.ts` (`plain`, `plainTitle`, `cutAtWord`, `clip`) for text
flattened to words in titles, summaries and search.

## Plan viewer behaviour

- A card with `data-team-slot` gets a team-colour stripe down its left edge.
- The pager says “Next · Chapter N” when the next screen opens a chapter (`Neighbours.opens`). On the last screen of
  the story it shows an end-of-plan card instead (`Neighbours.end`).
- The palette (`searchPalette`, `paletteGroups`) filters by type, highlights matches, and finds fields and steps as
  parts of their parent.
- Each screen's content sits inside `ChapterBoundary`, so a screen that fails to draw shows a warning, not a blank
  page.
- When printed, only the stage is shown, in the light scheme; the pager and chrome are hidden.

## Teaching today

Outside a plan, the pages teach how the systems work today. Inside a plan, they teach only what that plan needs.

- **One model of today, scoped per page.** The landscape draws every system. A domain or system page draws the
  same map focused on its own systems, with their one-step neighbours as dotted "outside" cards.
- **Order of a page.** Say what is true, show who runs it and what it works with, then the map, then the journeys
  that cross it, then the parts and the code.
- **Click to inspect, open to read.** A click on a card, line or chip opens the inspector. The inspector's "Open
  page" goes to the thing's page under `/<ws>/things/`. Domain and system names go to their scoped pages.
- **No plan words in today.** Today pages show no status, versions, pins or "added/removed" marks.
- **Journeys and reference.** `/<ws>/journeys/` walks each user journey and flow step by step, with the same keys
  and held-steady page as a plan's walk. `/<ws>/reference/` lists the APIs, events, stores and screens as they
  run today.
