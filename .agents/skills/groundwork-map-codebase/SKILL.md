---
name: groundwork-map-codebase
description: Maps or refreshes a repository in Groundwork using a deterministic-first pipeline (scan -> orient list -> parallel component orientation -> coherence pass -> workspace check). Use when onboarding a new repo, refreshing evidence after code changes, or filling missing codebase orientation across a multi-service or multi-crate workspace.
---

# Groundwork — Map & Orient Codebase

Follow a strict **deterministic-first** workflow. Never browse hundreds of files manually when `groundwork scan` and `groundwork orient brief` already extract the exact structure.

## Workflow

### 1. Run deterministic scan (zero LLM)
Scan each target repository to refresh `repository.json`, `inventory.json`, `cite-anchors.json`, and `structure.json`:
```bash
npm run groundwork -- scan <repo-path> --out <space-dir>/evidence/<repo-key>
```

### 2. Audit gaps & missing orientations
Run both commands to get exact, machine-verified work items:
```bash
npm run groundwork -- map completeness --workspace <ws> [--project <id>] --json
npm run groundwork -- orient list --workspace <ws> [--project <id>] --missing --json
```
- Claim any `unclaimed_repos` or `unclaimed_package_roots` into Systems (`system.yaml` + `component.yaml`) before orienting them.
- Skip `compact` tier components (≤ 5 source files and < 3 modules) — they do **not** need `orientation.yaml`; only ensure their `component.yaml` has a concrete 1-sentence `does`.

### 3. Orient `standard` and `deep` components (parallelizable)
For each component listed by `orient list --missing`:
- Spawn parallel workers (or process one by one) using the **`groundwork-orient-component`** skill.
- Each worker runs `groundwork orient brief <component-id> --workspace <ws> [--project <id>] --json`, reads the top 3–5 highest-LOC/entry source files, writes `<component-dir>/orientation.yaml`, and fixes any mechanical `does` in `component.yaml`.

### 4. Post-parallel coherence pass
After all workers finish, review the generated `does`, `invariants`, and `orientation.yaml` summaries side by side across the workspace:
- Ensure consistent domain terminology across sibling components (e.g., where `*-model` pure CPU crates end and GPU/runtime crates begin).
- Verify no component retains a mechanical template `does` (e.g. `Rust crate (...) — N engine deps`).
- Ensure traps are distinct, non-obvious, and cited — never generic advice.

### 5. Mechanical verification gate
Run the workspace check until there are **0 errors** (no broken `orientation.yaml` paths, no non-relative paths, no schema violations):
```bash
npm run groundwork -- workspace check <ws> [--project <id>]
npm run groundwork -- orient list --workspace <ws> [--project <id>]
```
