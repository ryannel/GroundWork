# The held-out set for bet 3

D44 ratified R11: bet 3 is graded against fixtures nobody building its checks ever saw. These are they, authored 2026-08-23 by a fresh dispatch that read nothing under this repository and pushed through git alone. This record is written at sealing — F20's rule.

## The repos

- `holdout3-go-sift` — a Go command with a two-milestone bet landed mid-way: milestone 1's slices landed with Bet:/Slice: trailers, milestone 2's not. Six proofs, four passing, two failing at real assertions. One wrinkle, noted only in the key. Tip at sealing: d4eceff.
- `holdout3-go-gauge` — a Go package carrying the three planted stub styles beside honest twins: the plan expects three green and six red; the tests show six passing and three failing. The gap between those counts is the exercise. Tip at sealing: b3e40ab.

Each tip is the answer-key commit, touching only ANSWER-KEY.json. Each repo carries PLAN-INTENT.md — the prose a blind adopter translates into plan files at run time.

## The rules

- The keys are sealed. No bet-3 builder reads them, and the driver does not read them either. No builder reads any holdout3 branch at all — the fixtures' shapes are as sealed as their keys. Only the slice 8 grading dispatch opens the keys, after the runs are recorded.
- A graded run burns the fixture. Tuning after a grading bumps the major and needs freshly authored fixtures — D41's rule, unchanged.

## The grading record

Written by the slice 8 grading dispatch, 2026-08-27. It opened both keys after
the runs were recorded. The runs it grades are in
`docs/evidence/bet-3/slice-8/runs.md`. The binary was 12.0+ra48a79a. Nothing
was tuned, and no fixture was run a second time.

The score in one line: two fixtures, one miss, one false red. Both faults sit
in the checks. None sits in the translation.

### holdout3-go-sift

What the key expects. Six proofs, every one honest, no planted stub.
`p_tokenize_basic`, `p_tokenize_quoted` and `p_record_parse` pass.
`p_aggregate_counts` and `p_render_table` fail at real assertions.
`p_render_empty` passes under the unlanded slice `s_render`. The landing
commits are 9bfa992 for `s_tokenize` and 2d812e1 for `s_record_parse`.

What the run said. The board printed the same six statuses, proof for proof.
Verify read 16 rows and every one was green. The honesty row read six tests and
said each one can fail. The key agrees.

The wrinkle was surfaced, in two places. The board flagged `p_render_empty`
`ahead of plan`. The stub row counted `1 ahead of plan` rather than calling it
a stub. The intent page asks for exactly that reading. Nothing about the
wrinkle had to be explained to the tool.

The key's second wrinkle did not bite. `p_record_parse` stands for two facing
items. The trace row counted seven facing ids, none unclaimed and none claimed
twice. It counts ids per slice, not per proof, so the miscount the key predicts
never happened.

- Misses: none.
- False reds: one. The board named 9bfa992 and 2d812e1 — the key's own landing
  commits — as commits a person has to look at. Filed as F120.

### holdout3-go-gauge

What the key expects. Nine proofs. Three green under landed slices. Six
expected red under unlanded ones. Three of those six are planted stubs that
pass: `p_parse_negative` is always-true at parse_more_test.go:31,
`p_convert_round_trip` is an empty body at convert_test.go:27, and
`p_sum_average` is a commented-out assertion at total_test.go:32. The landing
commits are c79da6a for `s_parse_units` and 878a29a for `s_format`.

What the run said. The board printed all nine statuses correctly and named the
three extra passes `ahead of plan`. Verify read 16 rows: 12 green, 3 red, 1
unrunnable. The honesty row named convert_test.go:27 by file and line, which
matches the key exactly, and carried the commented-out stub as its "1 more".
The stub row went red on those two.

- Misses: one. The always-true stub escaped the honesty scan and the stub row.
  It arrived at the board as work ahead of plan. Two of three planted styles
  were caught. Filed as F119.
- False reds: one, the same landing-commit flag as sift, on c79da6a and
  878a29a. Filed as F120.

Three suspects were weighed against the key and cleared.

- The wiring red on `ToMetres` is right, not a false red. On a library D41
  keeps the row's teeth for an export nothing names at all, tests included. The
  planted empty body is why nothing names it. So the red is a second signal of
  a planted defect. Its tail clause misleads a reader, which is F121.
- The honesty row and the stub row going red on the same two stubs is by
  design. D44 built the stub row on the honesty scan's own judgment. One fault,
  two rows, one source.
- The mutate row said nothing here, and it cost nothing here. Neither key hides
  a defect mutation would have found. The gap is recorded as F122.

### Where the faults sit

All four entries are checks-side. None is translation-side.

The translation was read against both keys, call by call. The plan files match
every id, slice, milestone, proof and facing item the intent pages spell.
Nothing the runner chose hid a defect or invented one. Three calls narrow what
a green covers, and none of them changed a grade:

- T3 declared no records, so the record row's green covers nothing.
- T6 gave `cmd/sift` no capability, so the manifest row's green covers two
  packages and not the command.
- T8 wrote the battery lock, which removed a version red about adoption
  friction.

The two faults that could have been laid on the translation are not. The
library profile is the right read of gauge's intent page. And no plan file
could have made an always-true stub visible to the honesty scan.

### The fixtures are burned

Both are graded, so both are spent. Any tuning that follows this grading bumps
the battery major and needs freshly authored fixtures. That is D41's rule,
restated in the rules above. F119, F120, F121 and F122 are all fixes for later
slices. This grading stands as recorded, at 12.0+ra48a79a.
