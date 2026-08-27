# Slice 8 — the dispatch reports

Three dispatches built this slice: a blind runner, a grader, and a fix-round builder. Their final reports, verbatim.

## The blind runner

Dispatched to take both sealed fixtures through the built binary without ever seeing a key.

---

## What I ran

**Step 1 — the red proof.** `internal/battery/holdoutgrading_test.go`, marker `TestProof_b3s8_grading_the_sealed_fixtures_are_run_once`. Home chosen to match `recordrow_test.go`: it is a proof about a repo record file, and it reads pages from the repo root with `filepath.Join("..","..",...)`, the house style in `plan_test.go`'s `contractPage`. It asserts the from-anchor heading `### R11 — Held-out fixtures for bet 3` exists in `docs/evidence/bet-3/design.md`, then fails while `## The grading record` in `holdout.md` still holds its placeholder. It failed at that real assertion, not at the anchor check. Committed alone as `fa65ea1`, pushed.

**Step 8 — the record.** `docs/evidence/bet-3/slice-8/runs.md` plus copies of every authored plan file under `docs/evidence/bet-3/slice-8/plans/`. Committed as `67eb6bc`, pushed. I did not touch `findings.md`, `decisions.md`, or holdout.md's grading section. The proof is still red — confirmed after the record landed.

## How the fixtures were materialized

Local clone worked; no fallback needed. The main clone's four shallow grafts all sit on trunk branches, so neither fixture branch touches one. `git fetch --depth=200` gave both branches whole — 8 and 7 commits, each bottoming out at a parentless init commit. Then `git clone --branch … --single-branch`, `git reset --hard HEAD^`, `git config commit.gpgsign false`, and `git remote remove origin` in each. Dropping the remote matters: after the reset, `refs/remotes/origin/<branch>` would still have pointed at the sealed tip. Each clone ends with exactly one ref. `ANSWER-KEY.json` absent from both trees, confirmed by `find`. Neither clone is shallow.

Ran at `afac74b` (sift, parent `e8350b9`) and `85375b9` (gauge, parent `8fc8572`) — one adoption commit each, carrying no trailers.

## The graded runs — toplines, verbatim

sift `board`, exit 0:
```
board: 6 proofs on 2 milestones, derived from the plan, from git, and from the test run
git:   2 slices landed, read from Slice trailers on 8 commits at afac74b131a9e6de51b272ef9a1e40eee914aa0c
run:   6 tests in 200ms at 2026-08-27T10:49:52Z
...
6 proofs: 5 on plan, 1 ahead of plan, 0 behind
```

sift `verify`, exit 0:
```
16 rows: green 16, red 0, waived 0, quarantined 0, unrunnable 0
```

gauge `board`, exit 0:
```
board: 9 proofs on 2 milestones, derived from the plan, from git, and from the test run
git:   2 slices landed, read from Slice trailers on 7 commits at 85375b95d7634f100400fd9f2a808f580610a1cc
run:   9 tests in 200ms at 2026-08-27T10:50:14Z
...
9 proofs: 6 on plan, 3 ahead of plan, 0 behind
```

gauge `verify`, exit 1:
```
16 rows: green 12, red 3, waived 0, quarantined 0, unrunnable 1
```
with `honesty red`, `wiring red`, `stub red`, `mutate unrunnable`. All four stderr streams were empty. One run each, no re-runs, no tuning.

## Translation judgment calls

T1 `PLAN-INTENT.md` is the design file for both (nothing else exists); every proof points at `#the-proofs`. T2 every proof `headline: true`, `retire_at_close: false`. T3 no slice declares `records` — nothing in either intent page names one, which is why the record row read 0 on both. T4 `deferred` and `premises` left out. T5 `fixtures`/`real` are my own reading of each slice's one-line description; `faked: []` throughout. T6 sift manifest: one `cli` surface, capabilities `record-reading`→`internal/record`, `summary-report`→`internal/report`; no capability for `cmd/sift`, which holds no tests. T7 gauge manifest: one `library` surface, `length-kit`→`.`. T8 I wrote `.groundwork-battery.json` rather than leave the version row red on adoption friction. T9 I committed the adoption files rather than leaving them untracked. T10 ids and markers taken verbatim from the intent pages and the fixtures' own test files.

Both plans parsed first time. Parsing was checked with a throwaway Go program calling `plan.Load` and `manifest.Load` — it renders no judgment, so it cannot have tuned anything. Deleted before committing.

## What smelled wrong (not fixed)

- **The stub row caught two of the three planted styles.** Empty body (`p_convert_round_trip`) and commented-out assertion (`p_sum_average`) were caught. The always-true assertion (`p_parse_negative`) escaped: the test does `want := got` then `if got != want`. `selfComparison` in `internal/battery/honestyrow.go` compares the two operands as written with spaces removed, so `got != want` does not fire even though `want` is aliased from `got` one line above. It reached the stub row as a test that can fail and passed — counted as `green ahead of plan`, never red. Section 3.4 of the contract does document this stance, so whether it is a defect is the grader's call.
- **One fault, two reds on gauge.** `honesty` and `stub` are both red about the same two stubs.
- **`wiring` red contradicts its own clause.** It says `ToMetres is exported and nothing in the module names it; on profile library an export needs no in-repo caller` — and reddens anyway.
- **`mutate` blocks on any repo mid-bet.** Both fixtures got `its own tests do not pass unmutated`, which is exactly what an unlanded milestone looks like. gauge went unrunnable on it.
- **The board names the finishing commit as the stray.** Both fixtures put the same `Slice:` trailer on the red-proof commit and the landing commit. D57 ruling 4 makes the oldest the landing, so the board points readers at the commit *before* the work. Contract-correct, but the fixture authors — who never saw the contract — chose a convention that collides with it.
- Nothing reported unrunnable for shallow history; the waiver counter reported a real zero on both, as expected for whole clones.

## Blindness

I never opened, glimpsed, diffed, or fetched an answer key. Neither sealed tip was passed to `git show`, `git diff`, or `git cat-file`; neither tip's commit subject was ever printed — the depth checks used `git rev-list --count` and `--max-parents=0`, and history listings were taken only after the clones were reset to the parent. No `legacy` content, no other holdout branch.

---

## The grader

A separate dispatch, the only one allowed to open the keys. It compared the recorded runs against both keys and landed the green commit.

---

## The grade

**holdout3-go-sift — clean, wrinkle surfaced.**

Key topline: six proofs, all honest, no planted stubs; three pass, two fail at real assertions, `p_render_empty` passes under the unlanded slice `s_render` ("The wrinkle... the empty case of Table was written ahead of plan"). Landing commits per key: `9bfa992` (s_tokenize), `2d812e1` (s_record_parse).

Run: the board printed the same six statuses proof for proof; verify was 16 rows, 16 green. The wrinkle **was surfaced**, twice — the board flagged `p_render_empty` `ahead of plan`, and the stub row counted `1 ahead of plan` rather than calling it a stub. That is exactly the reading the intent page asks for. The key's second wrinkle (`p_record_parse` standing for two facing items) **did not bite**: trace counted 7 facing ids, 0 unclaimed, 0 claimed twice, because it counts ids per slice, not per proof.

Misses: none. False reds: one (F120).

**holdout3-go-gauge — one of three planted styles missed.**

Key topline: nine proofs; three green; six expected red; three of those six are planted stubs that pass — `p_parse_negative` always-true at parse_more_test.go:31, `p_convert_round_trip` empty-body at convert_test.go:27, `p_sum_average` commented-out at total_test.go:32. Landing commits: `c79da6a`, `878a29a`.

Run: board correct on all nine statuses, all three extra passes named `ahead of plan`. Honesty named convert_test.go:27 by file and line — an exact match to the key — and carried the commented-out stub as "1 more". Stub row red on those two.

Misses: one (F119). False reds: one (F120).

## Findings filed

- **F119** — the always-true stub walked past the stub row as work ahead of plan. Class: coverage-gap. Caught by: battery.
- **F120** — the board points at the commit before the work and calls the real landing a stray. Both fixtures, four sound commits flagged. Class: green-but-wrong. Caught by: battery.
- **F121** — the wiring red's tail clause reads as an exemption from its own red. Class: other — with reason. Caught by: worker.
- **F122** — the mutate row has nothing to say about a repo mid-bet. Class: coverage-gap. Caught by: blind-review.

## Faults attributed to translation

**None.** The plan files match every id the intent pages spell, and nothing the runner chose hid or invented a defect. Three T-calls narrow what a green covers and none changed a grade: T3 (no records, so the record row's green covers nothing), T6 (`cmd/sift` has no capability), T8 (the battery lock removed a version red). The two faults that could have been blamed on translation are not: gauge's `library` profile is the right read of its intent page, and no plan file could have made an always-true stub visible to the honesty scan.

## The runner's suspects, weighed

- Always-true stub escaped — **upheld, a real miss** (F119).
- Board naming the oldest same-trailer commit — **upheld, a false red on both fixtures** (F120). Both keys and both intent pages name the *second* commit as the landing.
- Wiring red on `ToMetres` — **cleared, the red is right.** D41 keeps the row's teeth on a library for an export nothing names *at all, tests included*; the only test that would have named it is the planted empty body. The red is a second true signal of a planted stub. Only its wording is defective (F121).
- honesty and stub both red on the same two stubs — **cleared, by design.** D44 built the stub row on the honesty scan's own judgment.
- mutate unrunnable mid-bet — **cleared as a miss, filed as a named loss** (F122). Neither key hides a mutation-shaped defect, so it cost nothing here.

## Rulings I think the driver owes (not written to decisions.md)

1. Which same-trailer commit lands a slice. D57.4 says the oldest; D64 upheld that against F107. Neither had a tests-first fixture in front of it, and this repo's own working agreement produces the two-commit shape that breaks the rule.
2. Whether a documented honesty-scan limit (D58.1's escape set) may stand as the answer to a stub style the ladder names by name.
3. Whether a row that cannot run on a mid-bet repo (mutate) is a gap to fix or a cost to record.

## Landing

- `go test -p 1 ./internal/battery -run TestProof_b3s8_grading` — **green** (the proof turned green by the grading record; the test was not touched).
- `go test -p 1 ./...` — all packages ok.
- Built binary verify on this repo: **16 rows, green 15, red 0, unrunnable 1** (waiver-count, the shallow clone) at 12.0+ra48a79a.
- Commit **afceeae** `grading: the sealed fixtures graded, green`, pushed.

No code, tests, battery rows, or fixtures were changed. Files touched: `docs/evidence/bet-3/holdout.md`, `docs/findings.md`.

---

## The fix-round builder

Dispatched with the blind review's eight defects and the driver's calls on each.

---

## Pushed

`77517f0` on `claude/v2-clean-slate-tkuacl` (was `99d5ab8`). Push succeeded first attempt.

## Filed — nine findings, F123–F131

| # | What | Class |
|---|---|---|
| F123 | The grading asked two of bet 3's four questions and never said which two it skipped | coverage-gap |
| F124 | The board reads a slice landed before its work, and goes falsely red on tests-first history (extends F120; names D66.1 as ruled on the understated version) | other — a false red with a non-zero exit, on the history the working agreement demands |
| F125 | Ladder makes the slice the unit, contract §3.3 makes the milestone the unit; plus b3s8.md's wrong fixture description. Ruling left to the bet-3 close-out audit | parallel-definition |
| F126 | The grading's score line counts a fault its own ledger entry does not name | other — a headline that counts a fault its own ledger entry does not name |
| F127 | A facing item no proof asserts is invisible to every row; names D61.2 as the deliberate ruling this is residue of | coverage-gap |
| F128 | The proof of the grading run proved only that prose exists | front-door-hollow |
| F129 | The grading record's singleness sentence drops the parse pre-check | record-not-written |
| F130 | One source, three catcher names; no existing entry touched | other — four entries from one source, filed under three catcher names |
| **F131** | **New, found at landing.** A slice cannot gain a record after its design is sealed | other — a correct seal red standing between a finding and its fix |

All eight review findings use `Caught by: blind-review — the slice 8 review`. F131 uses `battery`.

## One instruction I did not carry out — needs your call

Adding `runs.md` to `b3s8.md`'s `records:` list **reddens `seal-verify`**: `b3s8.md` is covered by `seal/design/bet_3` (blob `4f52d7f`), and the edit moves it. `TestSealRowIsGreenOnThisRepo` failed on exactly that. Moving the seal needs `groundwork seal amend`, and R6 says a seal moves only on the owner's explicit words — an agent typing a reason is not the owner speaking. Rather than move a seal tag or waive a correct red, I reverted that one line, recorded the block as F131, and rewrote F128's "What happened" to say the fix is half-landed. The run record is currently pinned by the proof test alone. Two ways out, both yours: amend the seal, or rule that a records list may grow after sealing.

## The supplemental runs

Re-materialized both fixtures by the recorded recipe (clone `--branch --single-branch`, `reset --hard HEAD^`, `gpgsign false`, `remote remove`), landing at `e8350b9` and `8fc8572` with no `ANSWER-KEY.json` present. Same binary — rebuilt and confirmed `12.0+ra48a79a`; only docs changed since `fa65ea1`. Plan files taken verbatim from `docs/evidence/bet-3/slice-8/plans/`.

**Reproduction check first:** with the adoption commit committed, both graded boards reproduced line for line — same rows, same counts, same `unread trailer` lines, both exit 0. Only the adoption commit's hash and the `run:` clock differ.

**Walk method:** `git checkout --detach <C>` → `git clean -fdq` → `cp -r <scratch>/kit-<fixture>/. .` → `board`. The kit lives outside both clones and copies one way, so the plan files ride as untracked files while git's history is the fixture's own. Every copy is a one-way copy; no git command was pointed at an uncommitted file. Consequence: each walk line counts one commit fewer than the graded run.

**sift toplines**

| Commit | Exit | Topline |
|---|---|---|
| `dda99b0` | 1 | no board — `the surface "cli" could not be run: ... go: warning: "./..." matched no packages` |
| `035d288` | 0 | `6 proofs: 6 on plan, 0 ahead of plan, 0 behind` — all six `EXPECTED red`; `s_tokenize LANDED yes` with both proofs `failed` |
| `9bfa992` | 0 | `6 proofs: 4 on plan, 2 ahead of plan, 0 behind` — `s_tokenize` lands, both proofs `passed`, both still `EXPECTED red`, both `ahead of plan` |
| `af14585` | **1** | `6 proofs: 5 on plan, 0 ahead of plan, 1 behind` — `p_record_parse EXPECTED green ACTUAL failed FLAG behind its plan` |
| `2d812e1` | 0 | `6 proofs: 6 on plan, 0 ahead of plan, 0 behind` |
| `f0b0422` | 0 | `6 proofs: 6 on plan, 0 ahead of plan, 0 behind` |
| `e8350b9` | 0 | `6 proofs: 5 on plan, 1 ahead of plan, 0 behind` — matches the graded run |

**gauge toplines**

| Commit | Exit | Topline |
|---|---|---|
| `e19b22c` | 1 | no board — `the surface "lib" could not be run: ... matched no packages` |
| `ee669c1` | 0 | `9 proofs: 9 on plan, 0 ahead of plan, 0 behind` — all nine `EXPECTED red`; `s_parse_units LANDED yes` with both proofs `failed` |
| `c79da6a` | 0 | `9 proofs: 7 on plan, 2 ahead of plan, 0 behind` — landing reads `ahead of plan` |
| `863e12f` | **1** | `9 proofs: 8 on plan, 0 ahead of plan, 1 behind` — `p_format_short EXPECTED green ACTUAL failed FLAG behind its plan` |
| `878a29a` | 0 | `9 proofs: 9 on plan, 0 ahead of plan, 0 behind` |
| `8fc8572` | 0 | `9 proofs: 6 on plan, 3 ahead of plan, 0 behind` — matches the graded run |

**Graded answers.** Clause "starts red for the right reason": **met**, with the `LANDED` fault under it — and at the true first commit the board cannot run at all (no test package, exit 1, empty stdout). Clause "three slices land in sequence, each turning its own row green": first half met, **second half cannot be met by design** — the milestone is the unit. The false red is real and lives at `af14585` and `863e12f`, not at either tip.

## Probe outputs — every new assertion bites

Python held the original in memory (sha256 `0781c770…`, 56478 bytes), backed it up to the scratchpad, wrote the mutation, ran the test, and swapped the original back from memory. No git command involved; restore verified by hash after every probe.

```
fixture name sift    -> exit 1  runs.md never names holdout3-go-sift, so it records no run on that fixture
fixture name gauge   -> exit 1  runs.md never names holdout3-go-gauge, so it records no run on that fixture
battery version      -> exit 1  runs.md never names the battery 12.0+ra48a79a, so no run on it is pinned to a version
captured run blocks  -> exit 1  runs.md holds 0 captured run blocks, and the graded runs alone are 4
supplement heading   -> exit 1  runs.md holds no section "## The supplemental runs", so the two clauses F123 names went unasked
boundary, 3 blocks   -> exit 1  runs.md holds 3 captured run blocks, and the graded runs alone are 4
restored, sha256 matches: True   (after all six)
```

## Landing checks

- `go test -p 1 ./internal/battery -run TestProof_b3s8` — **ok**, green against the real files.
- `go test -p 1 ./...` — **all green**, serial (battery 87.9s).
- `verify` at `12.0+ra48a79a` — **16 rows: green 15, red 0, waived 0, quarantined 0, unrunnable 1**, exit 0. The unrunnable is `waiver-count` on the shallow clone, as expected.
- Register: new findings prose 128 sentences, mean 14.8 words; holdout.md additions 12.6; runs.md additions 11.1.

One thing worth your eye in that verify: the board row now reads `1 unread: "b3s8" on 77517f0... names a slice an earlier commit already landed and 12 more` — this repo's own history now shows F120/F124's shape, because the fix-round commit carries `Slice: b3s8` after `afceeae` already claimed it. Green, not red, and consistent with the 12 that were already there.
