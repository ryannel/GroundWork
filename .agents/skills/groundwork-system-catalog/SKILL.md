---
name: groundwork-system-catalog
description: >
  Builds and refreshes evidence-backed Groundwork products from conversation.
  Use whenever the user asks to add, import, scan, map, catalog, understand, or
  update a repository, service, product, or software system.
---

# Groundwork system catalog

Model the product boundary and the components that explain how the system works. A product declares repositories it owns or uses. A component belongs to a source repository; product membership follows the product's repository declarations and owned paths. Reachability alone does not imply ownership. Infer placement from existing plans and code, and ask when evidence leaves the boundary ambiguous.

Inspect the selected local checkout directly. Follow its direct runtime dependencies, contracts, persisted data, messages, jobs, and useful execution paths. Stop at another product, an external provider, a generic platform boundary, or an unknown repository unless crossing it answers the user's question. Keep unresolved references explicit. Use [the taxonomy](references/taxonomy.md) for classification.

Record source-visible facts separately from inference. Pin observations to the full source commit SHA and cite repository-relative files and line ranges. An existing citation or test location does not prove deployed behavior. A focused question warrants deeper tracing along relevant paths; it does not require tracing every endpoint. An examined empty area gets an empty gap list. Partial work gets a specific `areaGaps` explanation.

## Read and write

1. Read the product declaration and current catalog with `search_catalog` and `get_catalog_entity`. Use `check_catalog_freshness` against the selected source checkout before relying on older facts.
2. Inspect code at a pinned commit. Read the current component document so a focused update retains valid sibling entries and explicit gaps.
3. Build one complete component document in the [current format](references/normalized-output.md). A rescan replaces that component's current facts.
4. Call `write_catalog` with `repository`, `destination` (`source` or `local`), `component`, and the latest `expectedRevision` and `expectedContext` for that catalog target. A local destination also needs `sourceRoot`. Resolve a stale guard by rereading and reviewing the current document. The write validates citations and replaces the file atomically.
5. Review the resulting diff and report the product, components, source commit, covered paths, examined areas, useful traces, and remaining gaps.

The source repository catalog is the default. A product selects `local` explicitly only when it cannot write to the source. Both destinations store the same component document shape. Git provides review and history. Do not create scan manifests, baselines, proposals, lifecycle records, or agent scratch notes in the repository.
