# Blind review — Bet 2, slice 2: the manifest and the adapter seam

Reviewer: a fresh session, no contact with the builder. The builder had run a 46-shape manifest table and an 11-mutation sweep, so the review hunted filesystem shapes, semantics gaps, and the conformance suite's own honesty. Verdict: **bounce**, the second of the rebuild; reworked under D30. Date: 2026-08-22.

## Findings

HIGH:

1. A capability was proven by a suite containing no tests — an empty, unparseable, or fully build-tag-excluded _test.go file proved anything. `touch alpha_test.go` was proof. Fail-closed inverted; unreachable by the JSON table because it is a filesystem shape.
2. Discover and run shared one name out of seven on hostile shapes — TestMain counted as a test, benchmarks and no-output examples were discovered but never run, subtests ran but were never discovered — and nothing reconciled the two. The spec was silent on what discovered means; the driver ruled it as D30: discover reads the source the way a reader does, subtests collapse into parents, and the two sets must agree on the conformance packs.
3. A mutator that damaged nothing passed conformance — restore the body, prepend a comment, conform. The one call where lying is cheapest had no check. Conformance now applies a mutant and requires a key-named test to flip.

MED:

4. Build-failure evidence was empty — "could not be run: , X did not build: " with the compiler's words discarded. The flagship never-ran defect had no readable evidence.
5. With node absent, nine tests vanished behind a silent ok — every out-of-process protection unproven on a node-free machine. CI gains setup-node; skips become failures under CI.
6. The empty green run log was refused in-process and accepted out-of-process — the same call, opposite fail direction. Aligned per D30.
7. The timeout killed the process, not the process group — a forking adapter leaked children past the run. Setpgid landed.
8. Duplicate suite ids collapsed silently, last-write-wins, in conformance and the manifest row both.

LOW:

9. A clock comment claimed what the Go path did not have; scoped.
10. Proof-id shape (relative to surface root, per-stack form) was undocumented — a manifest author could only guess and watch the row go red.
11. The manifest-is-committed test only proved not-ignored; now proves tracked.
12. The conformance test recorder recorded format strings, not messages.
13. Comment prose ran denser than the repo baseline; the four longest sentences split.

## What held up

The cap boundary is exact at cap−1/cap/cap+1. The timeout bounds wall clock even against a pipe-holding child. Commands exec raw, never through a shell — right for D15's trust domain. Pack/key drift is caught in both directions, and the adapter package is never test-cached. The version bump honoured D23 over the brief. The manifest hostile table's own mutations were honest — three re-ran by the reviewer, each caught by its named test.
