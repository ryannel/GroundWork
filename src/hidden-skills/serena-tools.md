# Serena code-intelligence tools

GroundWork registers **Serena** (`github.com/oraios/serena`) as a project-scoped MCP server
at init: an LSP-backed code-intelligence server (40+ languages) that lets an agent navigate
and edit code by *symbol* instead of by reading and rewriting whole files. It is a
force-multiplier, never a hard dependency — it needs `uv` on the host, and every consumer
below degrades gracefully to ordinary reads/edits when the server is absent. Find it with a
tool search for the code-intelligence or symbol capability before assuming it is unavailable.

## Serena vs the code map — division of labor

Serena and `repo-map.json` answer different questions, and neither replaces the other:

- **Serena is live and per-symbol.** It resolves a name, reads one body, lists references — on
  demand, against the code as it is right now. It has no whole-repo graph export.
- **The code map (`npx groundwork-method repo-map`) is the whole-repo aggregate.** A
  deterministic tree-sitter pass produces module boundaries, import edges, and a PageRank
  centrality ranking that no single per-symbol query gives you — exactly what the scan needs to
  decide which files are hubs worth reading deeply.

So the generator *builds* the map; Serena is *not* asked to assemble it. Use Serena to read
the hubs the map ranks, and to run live impact analysis. See `repo-map-schema.md` for the map's
shape.

## When to reach for it

Prefer Serena over reading entire files whenever you need to locate, understand, or change a
named symbol. Reading a 600-line file to edit one method burns context Serena makes
unnecessary.

## Navigation (read)

- `get_symbols_overview` — the symbol outline of a file or package. Start here instead of
  reading a file top-to-bottom.
- `find_symbol` — resolve a symbol by name/path and read just its body.
- `find_referencing_symbols` — every reference to a symbol (LSP-accurate). This is the
  primitive behind impact analysis: who breaks if this changes.
- `find_implementations` / `type_hierarchy` — interface implementors and type ancestry.
- `search_for_pattern` — fall back to text search when a symbol query does not fit.

The brownfield scan (`groundwork-scan`), `groundwork-check`, and `groundwork-update` use these
for live impact analysis — who breaks if this symbol changes. The whole-repo map itself is
built by the deterministic generator (`npx groundwork-method repo-map`), not assembled from
Serena queries; these tools read and reason over the code the map points them at.

## Editing (write)

Edit by symbol so edits stay anchored to structure, not line numbers:

- `replace_symbol_body` — rewrite a function/method/class body in place.
- `insert_after_symbol` / `insert_before_symbol` — add a sibling symbol (new method, helper).
- `rename` — rename a symbol and update every reference through the LSP.
- `safe_delete` — remove a symbol and clean up references.

Use these for precise, reference-aware changes; use ordinary file edits for non-symbol changes
(config, prose, whole-file rewrites) or when Serena is unavailable.

## Degraded mode

No Serena (no `uv`, sandboxed, or headless): navigate with ordinary reads and project search,
edit with ordinary file edits, and build `repo-map.json` from targeted reads in the same shape.
The downstream contract is identical — only the means differ. Say so rather than implying
graph coverage you did not have.
