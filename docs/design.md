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
- `--topbar-h`, `--rail-w`, `--inspector-w`, `--stage-max`, `--measure`: layout.

## Primitives (`src/ui`)

Variants are data attributes (`data-tone`, `data-status`, `data-variant`), never extra classes.

- `Badge`: a pill with a tone: neutral, accent or a status.
- `Button`: default, primary or ghost; small or medium.
- `Callout`: an aside with an optional title, as a note or a warning.
- `Card`: a whole-card link to what it names.
- `Facts`: a quiet row of facts (sizes, counts, owners) separated by “·”.
- `Chip`, `ChipList`: `<button data-inspect={id}>` with a type glyph and a status; the inspector catches its clicks.
- `DataTable`: a captioned table that folds to labelled rows when its own width is under 520px.
- `Icon`, `Glyph`: line drawings for each kind of thing; `Glyph` draws a text glyph (▣, ⛁) as its icon when it has one.
- `Kbd`: a key or shortcut.
- `Legend`, `LEGENDS`: a strip explaining the glyphs, line styles and status swatches a drawing uses; presets for
  map, sequence, status, types, graph and walk.
- `Markdown`, `InlineMarkdown`: plan prose (paragraphs, lists, quotes, bold, em, code, links, `[[id]]`) rendered
  as React, never as HTML; `renderRef` draws each citation.
- `PageHeader`: the top of every page, always in this order: a breadcrumb to its parents, the name of the thing as
  the `h1`, one line on what it is or what is true of it, then `Facts`.
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
