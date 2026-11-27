---
name: groundwork-orient-component
description: Authors a high-signal orientation.yaml (and improves mechanical does/invariants in component.yaml) for a single Groundwork service, app, or module using its deterministic orient brief and targeted source reads.
---

# Groundwork — Orient One Component

Your job is to help a brand-new engineer understand how this component is structured, where execution flows, where traps hide, and where to start reading — **without** duplicating mechanical facts already in `structure.json` or `inventory.json`.

## Step 1: Fetch the deterministic brief
```bash
npm run groundwork -- orient brief <component-id> --workspace <ws> [--project <id>] --json
```
Read the brief carefully:
- `tier` (`compact` | `standard` | `deep`)
- `doc_summary`, `entrypoints`, `workspace_harnesses`, `flags`
- `modules` (sorted by LOC, with `visibility`, `doc_summary`, `surfaces`, `assigned_zone`)
- `neighbors` (`depends_on` / `used_by` — keep your terminology consistent with theirs)

## Step 2: Read real source files before writing
Never synthesize solely from folder names. For `standard` and `deep` components:
1. Read the primary entrypoint (`src/lib.rs`, `cmd/api/main.go`, `router.go`, `src/index.ts`, etc.).
2. Read the top 2–4 highest-LOC or highest-surface modules from the brief so you understand real responsibilities and non-obvious traps (e.g. diagnostic-only code, feature/env gates, ownership rules).

## Step 3: Author `orientation.yaml` (and refine `component.yaml` if needed)

### Size-tier rules
- **`compact` tier:** Do **not** invent fake zones. Only ensure `component.yaml` has a concrete 1-sentence `does` (never a mechanical template like `Rust crate (...) — N deps`) and any real `invariants`.
- **`standard` / `deep` tier:** Write `<component-dir>/orientation.yaml`:

```yaml
lifecycle: "<One-line execution/data flow through this component>"
zones:
  - id: kebab-case-id
    name: Human Readable Zone Name
    role: core # core | contract | feature | adapter | infra | diagnostic
    summary: Concrete 1-sentence responsibility — never repeat the folder name tautologically.
    paths:
      - src/runtime # MUST be package-root-relative; NEVER "." or "src" catch-alls
start_here:
  - path: src/lib.rs
    why: Specific reason a newcomer should read this file first.
traps: # Optional — omit or use [] if there are no genuine non-obvious traps
  - title: Short warning title
    detail: Specific trap or boundary a newcomer would misunderstand from the folder tree.
    cite: <repo>:<path>#L<start>-<end>
tasks:
  - label: Add an endpoint / render pass / etc.
    path: internal/entrypoints/api
    note: Short actionable pointer.
  - label: Run tests / verify locally
    command: go test ./...
```

### Strict anti-slop guardrails
1. **Package-root-relative paths ONLY:** Use `src/graph` or `internal/entrypoints`, never `crates/thrum-render/src/graph` or `./src/graph`.
2. **No catch-all zone paths:** Never put `.`, `src`, `internal`, `pkg`, or `cmd` in `zones[].paths`.
3. **Cover ≥ 80% of significant non-test modules:** Aim for 3–6 conceptual zones that form a real partition of the codebase.
4. **Every `trap` MUST have a `cite`:** No generic engineering advice ("remember to sync GPU buffers"). If there are no real traps, omit `traps` or set `traps: []`.
5. **Do not repeat mechanical stats:** File counts, LOC, shader/SQL counts, route counts, and GitHub links are joined automatically from `structure.json` and `inventory.json`.
6. **Replace mechanical `does`:** If `component.yaml`'s `does` matches `Rust crate (...) — N engine deps`, replace it with a crisp 1-sentence domain description.

## Step 4: Verify mechanically
```bash
npm run groundwork -- workspace check <ws> [--project <id>]
npm run groundwork -- orient brief <component-id> --workspace <ws> [--project <id>]
```
Confirm **0 broken paths**, **0 non-relative paths**, and **≥ 80% module coverage** for `standard`/`deep` components.
