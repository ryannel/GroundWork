# Code intelligence — one map + Serena

GroundWork reads code structure at three altitudes, each answered by the tool built for it. There
is **one map** — a project never needs its own one-off graph tool; where the map falls short, the
extension seams below are the fix, not a fork:

- **Module altitude — the map's `module_graph`.** Read from the project's **build manifests**
  (SwiftPM, Cargo, npm/pnpm workspaces, .NET project references; extensible below): the declared
  module/target DAG, its externals, and a module-level centrality ranking. Manifests are the
  authoritative statement of module topology, so this layer is real for **every** stack that has
  one — including the languages whose imports the map cannot resolve. It answers *"what are the
  modules, which is the hub, and who consumes the one I am changing?"*
  `npx groundwork-method repo-map --mermaid` renders it to `.groundwork/cache/module-graph.mmd`
  for docs and humans.
- **File altitude — the map's import graph.** Per-file import edges + PageRank centrality, built
  by tree-sitter. Real for **graph-fidelity** languages (Go, Python, TypeScript/JavaScript, Java,
  Dart); **symbols-fidelity** languages (Rust, Kotlin, C#, C/C++, Scala, Swift, PHP, Ruby, Lua)
  get a symbol index but no file edges — at that altitude they lean on the module graph above.
- **Symbol altitude — Serena** (`github.com/oraios/serena`, an LSP-backed MCP server registered at
  init) — live, per-symbol navigation and editing. It answers *"where is this symbol, who
  references it, change it safely."* It needs `uv` on the host; find it with a tool search for the
  code-intelligence or symbol capability before assuming it is unavailable.

Both aerial layers land in one artifact, `.groundwork/cache/repo-map.json`
(`npx groundwork-method repo-map` — deterministic, tree-sitter + manifest parsing, no build
toolchain, no network). Serena is the precise lookup the map does not hold; the map is the aerial
view Serena cannot export. All of it is a force-multiplier, never a hard dependency —
[degraded mode](#degraded-mode) below covers absence. And these are means, not rituals: reach for
the altitude that answers the question you actually have, and skip what a capsule, a read, or a
grep already answers.

## The orientation workflow

When you start non-trivial work in an unfamiliar codebase — implementing a slice, reviewing a
change, tracing a bug — orient through the map before reading widely:

1. **Make the map current.** Run `npx groundwork-method repo-map` (incremental — only changed
   files reparse) or `--check` to see if it is stale. If the project has no map yet, building one
   is the fast first step.
2. **Read the hubs, skim the leaves — at the altitude your stack supports.** Open
   `.groundwork/cache/repo-map.json`. Start with `module_graph.module_centrality`: the top modules
   are where the system turns, in any stack with a build manifest. Then, for a graph-fidelity
   language, drop to the file-level `centrality` ranking to pick hub files within those modules;
   for a symbols-fidelity language there is no file ranking — pick files from the hub module's
   directory and its symbol index instead of pretending one exists. Read hubs deeply; skim leaves.
3. **Navigate in with Serena.** Use `get_symbols_overview` on a hub to read its outline, then
   `find_symbol` to read just the bodies you need, and `find_referencing_symbols` to trace what
   depends on the code you are about to touch (live impact analysis).
4. **Edit by symbol.** Make reference-aware changes with `replace_symbol_body`, `rename`, and the
   insert tools (below) rather than line-based rewrites.
5. **Keep the map honest.** After a structural change (files added/removed, imports changed),
   refresh with `npx groundwork-method repo-map` so the next reader — agent or `groundwork-check`
   — orients off the truth. Refresh is incremental, so this is cheap.

## Navigation (read) — Serena

- `get_symbols_overview` — the symbol outline of a file or package. Start here instead of reading
  a file top-to-bottom.
- `find_symbol` — resolve a symbol by name/path and read just its body.
- `find_referencing_symbols` — every reference to a symbol (LSP-accurate). The primitive behind
  impact analysis: who breaks if this changes.
- `find_implementations` / `type_hierarchy` — interface implementors and type ancestry.
- `search_for_pattern` — fall back to text search when a symbol query does not fit.

The brownfield scan (`groundwork-scan`), `groundwork-check`, and `groundwork-doc-sync` use these for
live impact analysis. The whole-repo map itself is built by the deterministic generator, not
assembled from Serena queries — these tools read and reason over the code the map points them at.

**Where `find_referencing_symbols` earns its keep — calibrate by the language, do not oversell it.**
Its value is highest in **dynamically-typed** stacks (Python, JS, Ruby): there is no compiler to
catch a caller you missed when a signature changes, so the LSP reference set is the only pre-runtime
check short of tests — skipping it ships a runtime error. In **statically-typed** stacks (Swift, Go,
Rust, Java) the compiler already catches the missed call site, so the reference pass is not a
correctness gate but a navigation and early-signal win: it surfaces the blast radius *now* instead
of after a build cycle, and it disambiguates a common identifier that text search cannot — a grep
for a name like `caption` or `id` returns the property, the locals, the string literals, and the
comments all mixed together, while the LSP returns exactly the references to *that* declaration. So
reach for it freely on a shared or widely-used symbol; for a one-off, distinctively-named one a grep
is already enough, and saying so is more honest than ritually invoking the tool.

**Run reference analysis where the code is committed.** LSP symbols are accurate for committed
code and stale against uncommitted edits — so the reference pass on a rename or signature change
belongs with whoever plans the change against clean state (in bet delivery, the driver at
capsule-assembly time — `04-delivery.md`'s ripple rule), whose caller list the implementer then
works from. An implementer mid-edit asking Serena about the symbol it is currently rewriting gets
yesterday's answer; the compiler and the caller list are the live truth at that point. Pair the
caller list with the map's `module_graph`: the compiler only checks the targets your loop actually
builds, and the module graph is how you name the consumer targets that must also compile.

## Editing (write) — Serena

Edit by symbol so edits stay anchored to structure, not line numbers:

- `replace_symbol_body` — rewrite a function/method/class body in place.
- `insert_after_symbol` / `insert_before_symbol` — add a sibling symbol (new method, helper).
- `rename` — rename a symbol and update every reference through the LSP.
- `safe_delete` — remove a symbol and clean up references.

Use these for precise, reference-aware changes; use ordinary file edits for non-symbol changes
(config, prose, whole-file rewrites) or when Serena is unavailable.

## The map — what you read from it

`.groundwork/cache/repo-map.json` (full contract: `repo-map-schema.md`). The fields you reach for:

- `module_graph` — the manifest-derived module layer: `modules` (name, kind, ecosystem, path),
  `edges` (declared module dependencies), `module_centrality` (module-level hub ranking), and
  `sources` (which manifests, honestly marked `method: parsed`). Real in any stack with a build
  manifest; the layer to read for module topology, consumer targets, and hub modules.
- `centrality` — every file ranked by PageRank; the top entries are the hubs to read first.
- `edges` — directed `from`→`to` import edges; the file dependency graph.
- `modules` — top-level directory partitions and their sizes, for a quick map of the territory.
- `coverage` — per language, its file count and fidelity (`graph` = contributes edges +
  centrality; `symbols` = symbol index only). Trust the graph for graph-fidelity languages;
  for symbols-fidelity ones, lean on `symbols` + `modules` and read for structure.
- `contracts` — detected API/spec files (OpenAPI, proto, GraphQL).
- `unmapped` — languages present in the repo but **not** mapped (and why). A non-empty list
  means the map is partial; enable those languages (below) or fall back to targeted reads.
- `generated_at_commit` — the freshness anchor; `repo-map --check` compares it against HEAD.

## Enable repo-map for your language

repo-map covers the common stacks out of the box, but your app may use a language it does not map
yet — `repo-map` prints exactly which (its `unmapped` list), so this is never a silent gap. Enabling
one is a small, in-repo change — no fork of GroundWork. Commit
`.groundwork/config/repo-map.languages.js` exporting an array of language definitions; `repo-map`
merges them on its next run. Each entry needs a grammar and two queries (a `resolve` function is
optional and unlocks edges):

```js
// .groundwork/config/repo-map.languages.js
module.exports = [{
  id: 'zig',
  extensions: ['.zig'],
  // Point at a tree-sitter grammar compiled to wasm. Build one with the tree-sitter
  // CLI whose major version matches the engine's web-tree-sitter (they share the
  // wasm format): `npx tree-sitter@<ver> build --wasm <grammar-src> -o tree-sitter-zig.wasm`.
  // (The grammars GroundWork ships can also be named directly, e.g.
  //  grammar: 'tree-sitter-go.wasm', to re-map a built-in.)
  grammarPath: './.groundwork/grammars/tree-sitter-zig.wasm',
  // tree-sitter queries — capture imports as @imp, top-level definitions as @sym.
  // Node names are grammar-specific: dump a parsed file's tree to discover them.
  importQuery: "(builtin_function (builtin_identifier) @imp)",     // illustrative
  symbolQuery: "(function_declaration name: (identifier) @sym)",  // illustrative
  // Optional: turn an import string into the internal file(s) it points to → real
  // edges + centrality (graph fidelity). Omit it for a symbols-only mapping.
  resolve(spec, fromFile, files) { /* your module-resolution rules */ return null; },
}];
```

The effort is the `resolve` function: it encodes your ecosystem's module-resolution rules, and a
*wrong* resolver yields a confidently-wrong centrality ranking — so verify it against a few real
imports, or omit it and ship symbols-only (still useful, never misleading). A definition whose
`extensions` collide with a built-in **replaces** it — the same hook lets you upgrade a resolver or
swap in your own grammar build. The one hard requirement is the wasm format: a grammar must be built
for the same web-tree-sitter the engine bundles, or it will fail to load and the language stays in
`unmapped` (the usual reason a custom grammar does not take).

The module layer has the same seam for build systems: commit
`.groundwork/config/repo-map.manifests.js` exporting providers (`{ id, detect(files),
parse({cwd, files, manifestPaths}) → { modules, edges } }`) to map a build system the engine does
not cover (Bazel, Buck, Gradle, a bespoke Make setup) — or to replace a built-in provider by
reusing its `id`. This is why a project never needs a separate map tool: the gap goes into the one
map, where every existing consumer of `repo-map.json` benefits from it.

## Degraded mode

No Serena (no `uv`, sandboxed, or headless): navigate with ordinary reads and project search, edit
with ordinary file edits. No repo map for a language — not built in and not yet enabled (check the
`unmapped` list): either enable it (above) or infer the missing structure from targeted reads
(entry points, manifests, imports) in the same shape. The downstream contract is identical — only
the means differ. Say so rather than implying structural coverage you did not have.

In a **git worktree** (e.g. a bet under delivery): the map cache is per-working-tree, so build it
in the worktree before relying on it (`npx groundwork-method repo-map`). Serena's index is warmed
at first need (`serena project index` — seconds), not as ritual — in delivery that need is the
ripple rule at capsule assembly (`04-delivery.md`), which runs in the *root* session where symbols
are accurate because the code under analysis is committed. Serena is registered with `--project .`,
which resolves to the directory the *session* is rooted in: a worktree-rooted session scopes it to
the worktree correctly, and the committed `.claude/settings.json` already approves the server
(`enabledMcpjsonServers: ["serena"]`), so the tools load without per-worktree setup — if they never
appear, check that approval is still there before suspecting anything deeper. And in any session,
LSP symbols trail uncommitted edits — re-index touched files (`serena project index-file`) or read
them directly. None of this is the same as Serena being *absent* (no `uv`, sandboxed, headless) —
that is the genuine degraded case above, and worth distinguishing from a tool that is present but
was never warmed.
