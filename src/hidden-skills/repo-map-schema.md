# repo-map.json — the code map contract

`.groundwork/cache/repo-map.json` is GroundWork's deterministic structural map of a
codebase. The generator (`npx groundwork-method repo-map`) is its producer; the brownfield
scan, architecture extraction, and `groundwork-check`/`groundwork-doc-sync` are its consumers.
This file pins the shape so producer and consumers agree — whether the map was built by the
generator or, for an unsupported language, filled in by LLM inference in the same shape.

It is a coarse, whole-repo aggregate by design. Precise, live, per-symbol questions are
Serena's job (see `code-intelligence.md`); this map is the bird's-eye view Serena cannot export.

## Shape

```jsonc
{
  "schema_version": 2,
  "generator": "groundwork-method repo-map",
  "generator_version": "0.10.0",          // package version that wrote it
  "generated_at": "2026-06-19T...Z",      // wall-clock stamp (write time)
  "generated_at_commit": "<sha|null>",    // HEAD when generated — the staleness anchor
  "stats": {
    "files": 128,                          // source files mapped
    "edges": 412,                          // resolved internal import edges
    "languages": { "go": 80, "python": 30, "typescript": 18 }
  },
  "coverage": {                            // per language: file count + fidelity
    "go": { "files": 80, "fidelity": "graph" },     // graph = edges + centrality
    "rust": { "files": 12, "fidelity": "symbols" }  // symbols = symbol index only
  },
  "modules": [                             // top-level partition → file count, by size desc
    { "path": "services", "files": 64 },
    { "path": "web", "files": 40 }
  ],
  "module_graph": {                        // manifest-derived module/target DAG (schema v2)
    "modules": [                           // one per declared module; kind is provider vocabulary
      { "name": "Core", "kind": "target", "ecosystem": "swiftpm", "path": "Packages", "language": "swift" },
      { "name": "GRDB", "kind": "external", "ecosystem": "swiftpm", "path": null, "language": "swift" }
    ],
    "edges": [ { "from": "Recipes", "to": "Core" } ],   // declared module dependencies
    "module_centrality": [                 // PageRank over module edges, desc — module hubs
      { "module": "Core", "rank": 0.2152, "in": 11, "out": 0 }
    ],
    "sources": [                           // which manifests, parsed how — honesty marker
      { "ecosystem": "swiftpm", "manifests": ["Packages/Package.swift"], "method": "parsed" }
    ],
    "reason": "..."                        // only when empty: why no module graph exists
  },
  "centrality": [                          // every file, ranked by PageRank desc
    { "file": "services/auth/token.go", "rank": 0.0182, "in": 21, "out": 3 }
  ],
  "edges": [                               // directed: `from` imports `to`
    { "from": "services/api/h.go", "to": "services/auth/token.go", "weight": 1 }
  ],
  "symbols": {                             // per-file top-level definitions (informational)
    "services/auth/token.go": ["Mint", "Verify", "Claims"]
  },
  "contracts": [ "api/openapi.yaml", "rpc/user.proto" ],   // detected contract/spec files
  "external_dependencies": [ "fmt", "react", "github.com/x/y" ],  // distinct external imports
  "unmapped": [                            // languages present but NOT mapped (+ why)
    { "language": "Elixir", "files": 14, "reason": "no built-in queries yet" }
  ]
}
```

## Field notes

- **`module_graph`** is the manifest-derived layer: the module/target DAG read from build
  manifests (built in: SwiftPM, Cargo, npm/pnpm workspaces, .NET project references; extensible
  via `.groundwork/config/repo-map.manifests.js`, see `code-intelligence.md`). It is real for any
  stack with a manifest — including symbols-fidelity languages whose imports contribute no file
  edges — and is the field to read for consumer modules and module-level hubs. `method: "parsed"`
  is an honesty marker: the graph is the manifest's literal declarations, not a resolved build, so
  a manifest that computes its targets dynamically is read only as far as its literals. `kind` is
  provider vocabulary (`target`/`test`/`executable`/`product`/`external` for SwiftPM, `crate`,
  `package`, `project`). `repo-map --mermaid` renders this layer to
  `.groundwork/cache/module-graph.mmd`.
- **`centrality`** is the field the scan leans on: high-rank files are the hubs to read
  deeply; leaves are skimmed. Rank is weighted PageRank over the import graph (damping 0.85),
  so it captures transitive importance, not just raw in-degree.
- **`edges`** are *internal* import edges only. A Go package import expands to edges against
  the package's files, with `weight` split across them so a wide package does not dominate.
  Relative TS/JS specifiers and resolvable Python modules become single edges (`weight` 1).
- **`external_dependencies`** captures imports that resolve outside the repo (stdlib,
  third-party). They are recorded but excluded from centrality.
- **`generated_at_commit`** is the freshness anchor. `npx groundwork-method repo-map --check`
  and `groundwork-check` compare it against HEAD's changed source files to report staleness.

## Maintenance

The map is a snapshot, kept fresh cheaply: the generator caches per-file parse results keyed
by content hash (`repo-map.cache.json`), so a rerun reparses only changed files. Freshness is
**detect-and-lazy-refresh** — `groundwork-check` reports drift as an advisory and consumers
regenerate on use when stale; no git hook runs by default (opt-in only, see `host-support.md`).

## Coverage and fidelity

Languages map at one of two fidelities, declared per language in `coverage`:

- **`graph`** — import edges resolve to internal files, so `edges` and `centrality` are real.
  Built in for Go, Python, TypeScript/JavaScript (incl. TSX/JSX), Java, and Dart.
- **`symbols`** — `symbols`, `external_dependencies`, and `modules` are populated, but the
  language contributes no internal *file* edges (no verified resolver). Built in for Rust, Kotlin,
  C#, C/C++, Scala, Swift, PHP, Ruby, and Lua. These stacks still get module-level structure:
  `module_graph` is fidelity-independent — the manifest declares the module DAG whether or not
  imports resolve.

Anything else a repo can enable at either fidelity via the project extension seam
(`.groundwork/config/repo-map.languages.js`; see `code-intelligence.md`). Languages present but
neither built in nor enabled appear in `unmapped` with a reason — they are not silently dropped.
Where the map cannot cover a language at all, the scan falls back to LLM inference in the same shape.

## Known limits

- File `edges` are import-level. `require()`/dynamic `import()` and call-graph edges are not yet
  resolved; the symbol index is top-level definitions, not a full reference graph — that
  precision is Serena's live job, not the map's.
- `module_graph` is declared topology, parsed from manifest text: no dependency resolution, no
  build, no network. A dynamically-computed target list, a version condition, or a generated
  manifest is read only as far as its literal declarations — which is why `sources[].method`
  says `parsed` and why the graph never claims resolution fidelity it does not have.
