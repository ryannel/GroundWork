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
was tuned, and no fixture was run a second time. One thing did run before the
graded commands: a throwaway program that called `plan.Load` and `manifest.Load`
on both fixtures to check the plans parsed. It is named in `runs.md` under "What
was iterated". It judges nothing, so it tuned nothing, but the plan row's green
was pre-tested with the battery's own loader and this sentence should have said
so. The rule it stands on: a parse failure found after a graded run's judgments
would have been tuning, so translation fixes end when the first graded output is
seen.

The score in one line: two fixtures, one miss, one false red. Both faults sit
in the checks. None sits in the translation. That score line is wrong on its own
terms, and the correction is below under "The supplement": at the two graded
tips the honest count is one miss and one wrong hit on a green row, with no
false red. The false red is real, but it lives at the commits the graded runs
skipped, and the supplement is where it was found.

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

## The supplement — the two questions that were never asked

Written 2026-08-27, after the slice 8 blind review. The review found that the
graded runs asked two of bet 3's four done-when clauses and left two unasked.
`docs/ladder.md` sets four. The graded runs exercised decomposition and the
stub styles. They never exercised "the board starts red for the right reason",
and never "three slices land in sequence, each one turning exactly its own row
green". Both fixtures carry the commits those two clauses need. The graded runs
sat at one mid-bet commit each, so nobody ran there.

The loss was recoverable. A `board` run at a fixed commit over fixed plan files
is a pure reading, and knowing the keys cannot change what it prints. The same
binary and the same authored plan files were still to hand. So both fixtures
were re-materialized by the recorded recipe and walked commit by commit. The
runs, the commands and the verbatim output are in
`docs/evidence/bet-3/slice-8/runs.md`, under "The supplemental runs". The
determinism claim was checked first: the graded boards reproduced line for line
at both tips.

This adds no tuning, so it costs nothing under D41. Both fixtures stay burned.

### Clause 2 — the board starts red for the right reason

Answer: met, with one fault under it.

At each fixture's first red-proof commit the board reads red for the right
reason. sift at `035d288`: six proofs, every one `EXPECTED red`, two `failed`
and four `never ran`, every row `on plan`, exit 0. gauge at `ee669c1`: nine
proofs, the same shape. The expectation is derived from plan position, not from
anybody's note, and every milestone still holds an unlanded slice. That is the
reason the clause asks for.

At the true first commit the board does not run at all. Both fixtures start
with a plan and no test package, `go test ./...` matches nothing, and `board`
exits 1 with an adapter error and empty stdout. That is honest, and it is not a
red board. A board's first useful reading is the first commit that holds a test.

The fault under the clause is `LANDED`. At `035d288` the board prints
`s_tokenize LANDED yes` while both that slice's proofs fail and nothing is
implemented. The same at `af14585`, `ee669c1` and `863e12f`. The red-proof
commit carries the `Slice:` trailer, and D57.4 credits the oldest claim. Filed
as F124, which extends F120.

### Clause 3 — three slices land in sequence, each turning its own row green

Answer: the first half is met. The second half cannot be met, by design.

The slices do land in sequence, and the board tracks each landing. But no slice
turns its own row green. sift at `9bfa992` lands `s_tokenize` and both its
proofs pass; both still read `EXPECTED red`, and both are flagged
`ahead of plan`. Those rows turn green at `af14585`, when milestone 1's last
slice claims a landing. gauge at `c79da6a` behaves the same way.

The cause is not a defect in the board. `docs/derivation-contract.md` section
3.3 makes the milestone the unit of expected state, and says why. The ladder's
clause makes the slice the unit. The two rules contradict, and this grading is
where that surfaced. Filed as F125. The ruling belongs to the bet-3 close-out
audit.

### The false red, and where it lives

The graded runs found no false red at either tip. The supplement found one, two
commits in from each tip.

sift at `af14585` — the commit that adds `p_record_parse`'s red proof, with the
parser not yet written. Milestone 1 now reads fully landed, because the trailer
on the red-proof commit counts as the landing. So all three of milestone 1's
proofs turn `EXPECTED green`. `p_record_parse` fails, as a red proof must. The
board prints `behind its plan`, counts `1 behind`, and exits 1. gauge does the
same at `863e12f` on `p_format_short`.

That is a false red with a non-zero exit, on a repo doing exactly what this
repo's own working agreement demands: commit the test while it still fails,
then land the work. It is the worst case of the same fault F120 names, and it is
filed as F124.

### The score, corrected

The line above says "one miss, one false red". At the two graded tips the honest
count is one miss — F119's always-true stub — and one wrong hit on a green row,
which is F120's own class. Nothing went falsely red at either tip. The false red
is real and is written up above, at the commits the graded runs skipped. F126
files the score line itself.

### The fixture description was wrong, and unrecorded

`docs/plan/rebuild/bet_3/b3s8.md` declares its first fixture as "a two-milestone
bet whose three slices land in sequence". Neither sealed repo is that. sift has
four slices and lands two. gauge has five and lands two. Both are two-milestone
bets with milestone 1 landed, which is the shape the clause needed, but the
count in the brief matches neither. That went unrecorded at grading. It is part
of F125.

### What the supplement does not change

The graded verdicts stand. F119, F120, F121 and F122 stand as filed. Nothing
here re-grades the two tips, and nothing here was tuned. The new findings are
F123 through F131. Every check-side fix among them lands at the next battery
major with fresh fixtures, per D41.
