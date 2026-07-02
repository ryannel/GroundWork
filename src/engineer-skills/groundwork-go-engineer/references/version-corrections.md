# Version Corrections

Where the model's training data is stale. This file is a checklist, not a tutorial — each item names what changed, why it bites, and the minimal fix. Verify against `go.mod` before applying; a project pinned to an older Go may not carry all of these yet.

## Loop variables are per-iteration (Go 1.22)

`for i, v := range ...` gives each iteration its own `i` and `v`. The defensive `i := i` / `v := v` copy before launching a goroutine is dead idiom — writing it signals stale training data; the bug it guarded against no longer exists on Go ≥1.22.

## `//go:build` replaced `// +build` (Go 1.17)

Build constraints use the `//go:build` form; `gofmt` maintains it. A file carrying only the old `// +build` comment is from pre-1.17 training data.

## `math/rand/v2` (Go 1.22)

No seeding required (the global source is seeded), `rand.IntN`/`rand.N` replace `rand.Intn`, and `Read` is gone from v2 — use `crypto/rand` for bytes. New code imports `math/rand/v2`, not `math/rand`.

## Stdlib `slices`, `maps`, and range-over-func (Go 1.21–1.23)

`slices.Contains`, `slices.SortFunc`, `maps.Keys` and friends are stdlib — hand-rolled helpers and `golang.org/x/exp/slices` imports are stale. Iterators are functions (`iter.Seq`, range-over-func, Go 1.23); training data predating them invents channel-based generators for what a `Seq` now does.
