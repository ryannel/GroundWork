# The blind runs of the sealed held-out set

This page records the slice 8 runs. It is the runner's record, not the grade.
The grade is written in `docs/evidence/bet-3/holdout.md` by the grading
dispatch, which is a different agent and reads the answer keys.

The runner never opened an answer key. See "What the runner did not read" at the
foot of this page.

## What was run

The binary was built from this branch at commit `fa65ea1`, the commit that
landed slice 8's red proof:

```
go build -o <scratch>/groundwork ./cmd/groundwork
```

Its version:

```
$ groundwork verify version
12.0+ra48a79a
```

The front door offers no flag for pointing at another repo. Every verb works on
the repo the working directory sits in. So each run below is the binary invoked
from inside the fixture's own clone.

Each fixture was run exactly twice: once for `board`, once for `verify`. Nothing
was tuned between the two, and nothing was re-run after a judgment was seen.

## How each fixture was materialized

The main clone is shallow, but its shallow grafts sit only on the trunk
branches. The two fixture branches were fetched whole:

```
git fetch --depth=200 origin holdout3-go-sift holdout3-go-gauge
```

Both bottom out at a real init commit with no parents, so the history is
complete. Checked without looking at either tip:

```
$ git rev-list --count origin/holdout3-go-sift
8
$ git rev-list --max-parents=0 origin/holdout3-go-sift
dda99b0e556847a2d6eb0225c2a92d3b2cb7bc05     (parents: none)

$ git rev-list --count origin/holdout3-go-gauge
7
$ git rev-list --max-parents=0 origin/holdout3-go-gauge
e19b22c4341069fe1ecdd6ed6bd8d80634962025     (parents: none)
```

The local clone route worked. It did not refuse on the shallow metadata, because
neither fixture branch touches a graft.

```
git clone --branch holdout3-go-sift  --single-branch /home/user/GroundWork <scratch>/sift
git clone --branch holdout3-go-gauge --single-branch /home/user/GroundWork <scratch>/gauge

# in each clone, at once:
git reset --hard HEAD^          # sit at the tip's parent
git config commit.gpgsign false # D64.9: the host's signing shim dies under load
git remote remove origin        # so no ref in this clone points at the sealed tip
```

Dropping the remote matters. After `reset --hard`, the branch sits at the
parent, but `refs/remotes/origin/<branch>` would still point at the answer-key
commit. Removing the remote leaves exactly one ref in each clone, and it is the
one being run. `ANSWER-KEY.json` is absent from both working trees; `find` for
it returned nothing in either.

Resulting state:

| Fixture | Branch | Ran at | History |
|---|---|---|---|
| sift | `holdout3-go-sift` | `e8350b9`, plus one adoption commit `afac74b` | 7 commits, whole |
| gauge | `holdout3-go-gauge` | `8fc8572`, plus one adoption commit `85375b9` | 6 commits, whole |

Neither clone is shallow: `git rev-parse --is-shallow-repository` says `false` in
both. So the waiver counter had a whole history to count over, and it did not
report unrunnable on either. It reported a real zero in both.

## The adoption commit

Each fixture got one commit of its own, adding the files a blind adopter has to
write. It carries no trailers at all, because nothing landed in it:

```
Adopt groundwork: the plan files, the capability manifest and the battery lock

Translated from PLAN-INTENT.md by a blind adopter. Nothing landed here, so
this commit carries no trailers.
```

Three kinds of file went in.

1. **The plan files**, under `docs/plan/<program>/`. These are the translation
   the dispatch asked for, from each fixture's own `PLAN-INTENT.md`, following
   `docs/derivation-contract.md` section 1.
2. **The capability manifest**, at `.groundwork/manifest.json`. The contract page
   does not define this shape, and neither `PLAN-INTENT.md` names surfaces or
   capabilities. But the `board`, `stub`, `run-evidence`, `honesty`, `wiring` and
   `mutate` rows all need one to reach the tests at all, so without it the graded
   questions could not be asked. Its shape was taken from this repo's own
   `.groundwork/manifest.json` and from `internal/manifest`.
3. **The battery lock**, at `.groundwork-battery.json`, holding
   `{"version":"12.0","digest":"ra48a79a"}` — the pair the built binary reports.
   Adopting a battery means declaring the version you adopted.

Points 2 and 3 are judgment calls, and they are listed again under the
translation notes below.

---

# Fixture 1 — holdout3-go-sift

Ran at `afac74b131a9e6de51b272ef9a1e40eee914aa0c`, whose parent is `e8350b9`,
the parent of the sealed tip.

## The plan files authored for sift

**`docs/plan/sift/program.md`**

```
---
id: sift
title: Sift
goal: Read a stream of plain text records on standard input and print a small summary of them.
done: A run of sift over a stream of records prints one line per kind, each with its count.
ladder:
  - id: bet_summary_core
    line: Sift reads records and summarises them.
    proof_sketch: Six proofs, from splitting one line into fields to printing the counts as a table.
---

# Sift

One record per line. A record is a kind, a host and a message. The summary is a
count per kind.

The command lives in `cmd/sift`. The parsing code lives in `internal/record`.
The summarising code lives in `internal/report`.

Translated from `PLAN-INTENT.md`, section "The program".
```

**`docs/plan/sift/bet_summary_core/bet.md`**

```
---
id: bet_summary_core
title: Make sift read records and summarise them
program: sift
design:
  - PLAN-INTENT.md
milestones:
  - id: m1_read_records
    title: Turn input lines into records
  - id: m2_summarise
    title: Count records and print the summary
slices:
  - id: s_tokenize
    milestone: m1_read_records
  - id: s_record_parse
    milestone: m1_read_records
  - id: s_aggregate
    milestone: m2_summarise
  - id: s_render
    milestone: m2_summarise
facing:
  - id: i_split_fields
    line: Plain space separated fields are read.
  - id: i_quoted_fields
    line: A quoted field keeps its spaces.
  - id: i_named_record
    line: A line becomes a record with a kind, a host and a message.
  - id: i_short_line_error
    line: A line with fewer than three fields is reported as an error.
  - id: i_count_by_kind
    line: The summary says how many records carry each kind.
  - id: i_table_output
    line: The counts print as an aligned table, sorted by kind.
  - id: i_empty_report
    line: A run with no records says so in one plain line.
---

# Bet — read records and summarise them

Two milestones. Milestone 1 reads records. Milestone 2 summarises them.

Slices land in this order: `s_tokenize`, `s_record_parse`, `s_aggregate`,
`s_render`.

Translated from `PLAN-INTENT.md`, sections "The bet", "The slices" and "The
user facing items".
```

**`docs/plan/sift/bet_summary_core/s_tokenize.md`**

```
---
id: s_tokenize
bet: bet_summary_core
milestone: m1_read_records
proofs:
  - id: p_tokenize_basic
    marker: TestProof_p_tokenize_basic_SplitsPlainFields
    from: PLAN-INTENT.md#the-proofs
    headline: true
    retire_at_close: false
  - id: p_tokenize_quoted
    marker: TestProof_p_tokenize_quoted_KeepsSpacesInsideQuotes
    from: PLAN-INTENT.md#the-proofs
    headline: true
    retire_at_close: false
fixtures:
  - a line of plain space separated fields, and a line holding a quoted field
real:
  - the field splitter itself
faked: []
facing:
  - i_split_fields
  - i_quoted_fields
---

# Slice — split one line into fields

Spaces separate fields. A field wrapped in double quotes may hold spaces.

Translated from `PLAN-INTENT.md`, sections "The slices" and "The proofs".
```

**`docs/plan/sift/bet_summary_core/s_record_parse.md`**

```
---
id: s_record_parse
bet: bet_summary_core
milestone: m1_read_records
proofs:
  - id: p_record_parse
    marker: TestProof_p_record_parse_ReadsAKindHostAndMessage
    from: PLAN-INTENT.md#the-proofs
    headline: true
    retire_at_close: false
fixtures:
  - a line of three or more fields, and a line of fewer than three
real:
  - the record parser itself
faked: []
facing:
  - i_named_record
  - i_short_line_error
---

# Slice — turn a line's fields into a record

The first two fields are the kind and the host. The rest join into the message.
A line with fewer than three fields is reported as an error.

One proof stands for two facing items here. The plan intent says so, and the
two facts share a single call.

Translated from `PLAN-INTENT.md`, sections "The slices" and "The proofs".
```

**`docs/plan/sift/bet_summary_core/s_aggregate.md`**

```
---
id: s_aggregate
bet: bet_summary_core
milestone: m2_summarise
proofs:
  - id: p_aggregate_counts
    marker: TestProof_p_aggregate_counts_CountsRecordsByKind
    from: PLAN-INTENT.md#the-proofs
    headline: true
    retire_at_close: false
fixtures:
  - several records sharing a kind, and records of more than one kind
real:
  - the counter itself
faked: []
facing:
  - i_count_by_kind
---

# Slice — count how many records carry each kind

Translated from `PLAN-INTENT.md`, sections "The slices" and "The proofs".
```

**`docs/plan/sift/bet_summary_core/s_render.md`**

```
---
id: s_render
bet: bet_summary_core
milestone: m2_summarise
proofs:
  - id: p_render_table
    marker: TestProof_p_render_table_PrintsAnAlignedTable
    from: PLAN-INTENT.md#the-proofs
    headline: true
    retire_at_close: false
  - id: p_render_empty
    marker: TestProof_p_render_empty_SaysWhenThereIsNothing
    from: PLAN-INTENT.md#the-proofs
    headline: true
    retire_at_close: false
fixtures:
  - counts of more than one kind, and no counts at all
real:
  - the renderer itself
faked: []
facing:
  - i_table_output
  - i_empty_report
---

# Slice — print the counts

One kind per line, sorted by kind, aligned. A plain line when there is nothing
to report.

Translated from `PLAN-INTENT.md`, sections "The slices" and "The proofs".
```

**`.groundwork/manifest.json`**

```json
{
  "schema": 1,
  "surfaces": [
    {"name": "cli", "profile": "cli", "stack": "go", "root": "."}
  ],
  "capabilities": [
    {"name": "record-reading", "surface": "cli", "proof": ["internal/record"]},
    {"name": "summary-report", "surface": "cli", "proof": ["internal/report"]}
  ]
}
```

**`.groundwork-battery.json`**

```json
{"version":"12.0","digest":"ra48a79a"}
```

## The graded runs on sift

### `groundwork board`

Run from inside `<scratch>/sift`. Exit 0. Stdout, verbatim:

```
board: 6 proofs on 2 milestones, derived from the plan, from git, and from the test run
git:   2 slices landed, read from Slice trailers on 8 commits at afac74b131a9e6de51b272ef9a1e40eee914aa0c
run:   6 tests in 200ms at 2026-08-27T10:49:52Z

MILESTONE        SLICE           LANDED  PROOF               EXPECTED  ACTUAL  FLAG
m1_read_records  s_tokenize      yes     p_tokenize_basic    green     passed  on plan
m1_read_records  s_tokenize      yes     p_tokenize_quoted   green     passed  on plan
m1_read_records  s_record_parse  yes     p_record_parse      green     passed  on plan
m2_summarise     s_aggregate     no      p_aggregate_counts  red       failed  on plan
m2_summarise     s_render        no      p_render_table      red       failed  on plan
m2_summarise     s_render        no      p_render_empty      red       passed  ahead of plan

6 proofs: 5 on plan, 1 ahead of plan, 0 behind

what a person has to look at:
  unread trailer  s_tokenize      9bfa992951a2b3ab12779d002d1eaccd1db7093e  names a slice an earlier commit already landed
  unread trailer  s_record_parse  2d812e1b6d989df9ff93ca6cfed316475d77cb1b  names a slice an earlier commit already landed
```

Stderr was empty.

### `groundwork verify`

Run from inside `<scratch>/sift`. Exit 0. Stdout, verbatim:

```
run run-20260827T105003Z-87de
battery 12.0+ra48a79a
ROW           OUTCOME  EVIDENCE
version       green    .groundwork-battery.json declares 12.0+ra48a79a at HEAD, and the rows compute the same digest
manifest      green    .groundwork/manifest.json declares 2 capabilities on 1 surface, and a discovered suite proves every one
honesty       green    the honesty scan read 6 tests in 2 suites, and every one can fail
wiring        green    the wiring scan read 4 exported functions in 5 files, and a non-test file names every one
token         green    the token scan is not applicable to profile cli, by declaration
run-evidence  green    the run-evidence row reconciled 6 discovered tests in 2 suites on 1 surface, and the run log names every one
mutate        green    killed every mutant judged: 4/4 at 12.0+ra48a79a: killed 2, 2 blocked; internal/report holds 2 targets and its own tests do not pass unmutated
plan          green    docs/plan holds 1 program, 1 bet and 4 slices, and every id and reference in them resolves
chain         green    8 lines across 1 session in refs/groundwork/journal: every chain holds
seal-verify   green    this repo holds no seal tag, so nothing is sealed and no covered path can have moved
board         green    6 proofs, 2 landed: 1 ahead of plan, 0 behind, 0 trailers misstated, 2 unread: "s_tokenize" on 9bfa99295... names a slice an earlier commit already landed and 2 more
stub          green    3 proofs expected red: 2 red at an assertion, 0 not, 1 ahead of plan, 0 with no result: the honesty scan found no stub among them
trace         green    6 proofs: 0 dangling; 7 facing ids: 0 unclaimed, 0 claimed twice; 0 marked (unsealed): PLAN-INTENT.md carries no seal in this repo
record        green    0 records read: 0 missing, 0 never committed, 0 stale, 0 unjudged, 0 waiting: every record read is in the tree and no older than the work it describes
waiver-count  green    0 waiver files: 0 grants, 0 merges, 0 renames not read: 0 rows at a limit, 0 misstated: no row read has reached either limit
history       green    8 commits read, 0 merges not read: 0 squashed, 0 cut: every commit read keeps the Slice trailers its own message quotes
16 rows: green 16, red 0, waived 0, quarantined 0, unrunnable 0
```

Stderr was empty.

---

# Fixture 2 — holdout3-go-gauge

Ran at `85375b95d7634f100400fd9f2a808f580610a1cc`, whose parent is `8fc8572`,
the parent of the sealed tip.

## The plan files authored for gauge

**`docs/plan/gauge/program.md`**

```
---
id: gauge
title: Gauge
goal: A small library for lengths, which reads them, prints them, converts them and adds them up.
done: Gauge reads a length written as text, prints it back in the shortest sensible unit, converts metres to feet and back, and totals a list.
ladder:
  - id: bet_length_kit
    line: Gauge reads, prints and does sums on lengths.
    proof_sketch: Nine proofs, from reading a metre length to taking the mean of a list.
---

# Gauge

All of it is one package at the root of the module.

Translated from `PLAN-INTENT.md`, section "The program".
```

**`docs/plan/gauge/bet_length_kit/bet.md`**

```
---
id: bet_length_kit
title: Make gauge read, print and do sums on lengths
program: gauge
design:
  - PLAN-INTENT.md
milestones:
  - id: m1_read_and_print
    title: Read a length and print it back
  - id: m2_arithmetic
    title: Convert lengths and add them up
slices:
  - id: s_parse_units
    milestone: m1_read_and_print
  - id: s_format
    milestone: m1_read_and_print
  - id: s_parse_more
    milestone: m2_arithmetic
  - id: s_convert
    milestone: m2_arithmetic
  - id: s_total
    milestone: m2_arithmetic
facing:
  - id: i_read_metres
    line: A length written in metres is read.
  - id: i_read_centimetres
    line: A length written in centimetres is read as metres.
  - id: i_short_form
    line: A length prints in the shortest sensible unit.
  - id: i_read_fraction
    line: A length written as a fraction is read.
  - id: i_refuse_negative
    line: A negative length is refused.
  - id: i_to_feet
    line: Metres convert to feet.
  - id: i_round_trip
    line: Metres to feet and back gives the same length.
  - id: i_sum
    line: A list of lengths adds up.
  - id: i_mean
    line: A list of lengths has a mean.
---

# Bet — the length kit

Two milestones. Milestone 1 reads and prints. Milestone 2 does the arithmetic
and the harder reading.

Slices land in this order: `s_parse_units`, `s_format`, `s_parse_more`,
`s_convert`, `s_total`.

Translated from `PLAN-INTENT.md`, sections "The bet", "The slices" and "The
user facing items".
```

**`docs/plan/gauge/bet_length_kit/s_parse_units.md`**

```
---
id: s_parse_units
bet: bet_length_kit
milestone: m1_read_and_print
proofs:
  - id: p_parse_metres
    marker: TestProof_p_parse_metres_ReadsAPlainMetreLength
    from: PLAN-INTENT.md#the-proofs
    headline: true
    retire_at_close: false
  - id: p_parse_centimetres
    marker: TestProof_p_parse_centimetres_ReadsCentimetresAsMetres
    from: PLAN-INTENT.md#the-proofs
    headline: true
    retire_at_close: false
fixtures:
  - a length written in metres, and one written in centimetres
real:
  - the unit parser itself
faked: []
facing:
  - i_read_metres
  - i_read_centimetres
---

# Slice — read a plain decimal length with a metric unit suffix

Translated from `PLAN-INTENT.md`, sections "The slices" and "The proofs".
```

**`docs/plan/gauge/bet_length_kit/s_format.md`**

```
---
id: s_format
bet: bet_length_kit
milestone: m1_read_and_print
proofs:
  - id: p_format_short
    marker: TestProof_p_format_short_PrintsTheShortestUnit
    from: PLAN-INTENT.md#the-proofs
    headline: true
    retire_at_close: false
fixtures:
  - lengths large enough and small enough to pick different units
real:
  - the formatter itself
faked: []
facing:
  - i_short_form
---

# Slice — print metres back in the shortest sensible unit

Translated from `PLAN-INTENT.md`, sections "The slices" and "The proofs".
```

**`docs/plan/gauge/bet_length_kit/s_parse_more.md`**

```
---
id: s_parse_more
bet: bet_length_kit
milestone: m2_arithmetic
proofs:
  - id: p_parse_fraction
    marker: TestProof_p_parse_fraction_ReadsAFraction
    from: PLAN-INTENT.md#the-proofs
    headline: true
    retire_at_close: false
  - id: p_parse_negative
    marker: TestProof_p_parse_negative_RefusesANegativeLength
    from: PLAN-INTENT.md#the-proofs
    headline: true
    retire_at_close: false
fixtures:
  - a length written as a fraction, and a negative length
real:
  - the parser itself
faked: []
facing:
  - i_read_fraction
  - i_refuse_negative
---

# Slice — read a fraction, and refuse a negative length

Translated from `PLAN-INTENT.md`, sections "The slices" and "The proofs".
```

**`docs/plan/gauge/bet_length_kit/s_convert.md`**

```
---
id: s_convert
bet: bet_length_kit
milestone: m2_arithmetic
proofs:
  - id: p_convert_feet
    marker: TestProof_p_convert_feet_ConvertsMetresToFeet
    from: PLAN-INTENT.md#the-proofs
    headline: true
    retire_at_close: false
  - id: p_convert_round_trip
    marker: TestProof_p_convert_round_trip_ReturnsToTheSameMetres
    from: PLAN-INTENT.md#the-proofs
    headline: true
    retire_at_close: false
fixtures:
  - metres going out to feet, and feet coming back to metres
real:
  - the converter itself
faked: []
facing:
  - i_to_feet
  - i_round_trip
---

# Slice — convert metres to feet, and back again without drift

Translated from `PLAN-INTENT.md`, sections "The slices" and "The proofs".
```

**`docs/plan/gauge/bet_length_kit/s_total.md`**

```
---
id: s_total
bet: bet_length_kit
milestone: m2_arithmetic
proofs:
  - id: p_sum_lengths
    marker: TestProof_p_sum_lengths_AddsAListOfLengths
    from: PLAN-INTENT.md#the-proofs
    headline: true
    retire_at_close: false
  - id: p_sum_average
    marker: TestProof_p_sum_average_TakesTheMeanOfLengths
    from: PLAN-INTENT.md#the-proofs
    headline: true
    retire_at_close: false
fixtures:
  - a list of several lengths, and the mean of that same list
real:
  - the totaller itself
faked: []
facing:
  - i_sum
  - i_mean
---

# Slice — add a list of lengths, and take their mean

Translated from `PLAN-INTENT.md`, sections "The slices" and "The proofs".
```

**`.groundwork/manifest.json`**

```json
{
  "schema": 1,
  "surfaces": [
    {"name": "lib", "profile": "library", "stack": "go", "root": "."}
  ],
  "capabilities": [
    {"name": "length-kit", "surface": "lib", "proof": ["."]}
  ]
}
```

**`.groundwork-battery.json`**

```json
{"version":"12.0","digest":"ra48a79a"}
```

## The graded runs on gauge

### `groundwork board`

Run from inside `<scratch>/gauge`. Exit 0. Stdout, verbatim:

```
board: 9 proofs on 2 milestones, derived from the plan, from git, and from the test run
git:   2 slices landed, read from Slice trailers on 7 commits at 85375b95d7634f100400fd9f2a808f580610a1cc
run:   9 tests in 200ms at 2026-08-27T10:50:14Z

MILESTONE          SLICE          LANDED  PROOF                 EXPECTED  ACTUAL  FLAG
m1_read_and_print  s_parse_units  yes     p_parse_metres        green     passed  on plan
m1_read_and_print  s_parse_units  yes     p_parse_centimetres   green     passed  on plan
m1_read_and_print  s_format       yes     p_format_short        green     passed  on plan
m2_arithmetic      s_parse_more   no      p_parse_fraction      red       failed  on plan
m2_arithmetic      s_parse_more   no      p_parse_negative      red       passed  ahead of plan
m2_arithmetic      s_convert      no      p_convert_feet        red       failed  on plan
m2_arithmetic      s_convert      no      p_convert_round_trip  red       passed  ahead of plan
m2_arithmetic      s_total        no      p_sum_lengths         red       failed  on plan
m2_arithmetic      s_total        no      p_sum_average         red       passed  ahead of plan

9 proofs: 6 on plan, 3 ahead of plan, 0 behind

what a person has to look at:
  unread trailer  s_parse_units  c79da6a4f4a15bba57fefc885a95fb0eff40c4df  names a slice an earlier commit already landed
  unread trailer  s_format       878a29ab20f4afc47fbd6dfb1c89bdb22884f7f8  names a slice an earlier commit already landed
```

Stderr was empty.

### `groundwork verify`

Run from inside `<scratch>/gauge`. Exit 1. Stdout, verbatim:

```
run run-20260827T105022Z-f475
battery 12.0+ra48a79a
ROW           OUTCOME     EVIDENCE
version       green       .groundwork-battery.json declares 12.0+ra48a79a at HEAD, and the rows compute the same digest
manifest      green       .groundwork/manifest.json declares 1 capability on 1 surface, and a discovered suite proves every one
honesty       red         the honesty scan found 2 tests that cannot fail: convert_test.go:27 TestProof_p_convert_round_trip_ReturnsToTheSameMetres asserts nothing and 1 more
wiring        red         the wiring scan found 1 exported function nothing wires up: convert.go:15 ToMetres is exported and nothing in the module names it; on profile library an export needs no in-repo caller
token         green       the token scan is not applicable to profile library, by declaration
run-evidence  green       the run-evidence row reconciled 9 discovered tests in 1 suite on 1 surface, and the run log names every one
mutate        unrunnable  the deletion test judged none of the mutants it sampled: sampled 6 of 6 targets at 12.0+ra48a79a: killed 0, 6 blocked by their own package; . holds 6 targets and its own tests do not pass unmutated
plan          green       docs/plan holds 1 program, 1 bet and 5 slices, and every id and reference in them resolves
chain         green       8 lines across 1 session in refs/groundwork/journal: every chain holds
seal-verify   green       this repo holds no seal tag, so nothing is sealed and no covered path can have moved
board         green       9 proofs, 2 landed: 3 ahead of plan, 0 behind, 0 trailers misstated, 2 unread: "s_parse_units" on c79da6a4f... names a slice an earlier commit already landed and 4 more
stub          red         6 proofs expected red: 3 red at an assertion, 2 not, 1 ahead of plan, 0 with no result: p_convert_round_trip passed, and its test asserts nothing and 1 more
trace         green       9 proofs: 0 dangling; 9 facing ids: 0 unclaimed, 0 claimed twice; 0 marked (unsealed): PLAN-INTENT.md carries no seal in this repo
record        green       0 records read: 0 missing, 0 never committed, 0 stale, 0 unjudged, 0 waiting: every record read is in the tree and no older than the work it describes
waiver-count  green       0 waiver files: 0 grants, 0 merges, 0 renames not read: 0 rows at a limit, 0 misstated: no row read has reached either limit
history       green       7 commits read, 0 merges not read: 0 squashed, 0 cut: every commit read keeps the Slice trailers its own message quotes
16 rows: green 12, red 3, waived 0, quarantined 0, unrunnable 1
```

Stderr was empty.

---

## Translation notes

Every judgment call the blind adopter made, in one list. None of these was made
after seeing a run: the plan files were final before the first graded command.

**T1. The design file is `PLAN-INTENT.md` itself.** A bet's `design` list must
name at least one file that exists, and every proof's `from:` must name a
heading inside such a file. Neither fixture holds any other prose. So
`PLAN-INTENT.md` is the design doc for both, and every proof points at
`PLAN-INTENT.md#the-proofs` — the section that declares that proof by name. A
finer anchor per proof was possible but `PLAN-INTENT.md` has no per-proof
heading to point at.

**T2. Every proof is `headline: true` and `retire_at_close: false`.** Neither
intent page says which proofs the board should show, and neither names a
deliberate exception that goes at bet close. Showing all of them is the reading
that hides nothing.

**T3. No slice declares any `records`.** Neither intent page names a record any
slice owes. `records` is optional, so it is left out rather than written empty.
This is why the `record` row reports `0 records read` on both fixtures: it
judged nothing, and the row's green covers nothing. That is a consequence of the
translation, not a verdict about the fixtures.

**T4. `deferred` and `premises` are left out of both bets.** Both are optional.
Every facing item in both intent pages is claimed by a slice, so there is
nothing to defer; and neither fixture stands on a sealed artifact.

**T5. `fixtures`, `real` and `faked` were written from the slice's own
sentence.** These three are required and cannot be left out. Neither intent page
speaks about fixtures or fakes, so each entry is the runner's own reading of what
the slice's one-line description implies. `faked: []` throughout — nothing in
either fixture fakes anything.

**T6. sift's manifest declares one `cli` surface and two capabilities**,
`record-reading` proved by `internal/record` and `summary-report` proved by
`internal/report`. `cmd/sift` got no capability, because it holds no test file
and a capability naming a suite that does not exist would be a claim about
nothing.

**T7. gauge's manifest declares one `library` surface and one capability**,
`length-kit` proved by `.`. All of gauge is one package at the module root, and
the Go adapter names that suite `.`.

**T8. The battery lock was written, rather than left out.** A missing lock
reddens the `version` row on its own. That red says something about adoption
friction and nothing about the questions this run grades, so it was removed by
declaring the version the built binary reports. Somebody could reasonably have
left it out.

**T9. The adoption files were committed, not left untracked.** A real adoption
commits its plan. The commit carries no trailers, so it lands no slice and
changes nothing the board reads. It does add one commit to each history, which
is why the `history` row read 8 commits on sift and 7 on gauge rather than 7 and
6.

**T10. Ids were taken verbatim from the intent pages.** Program, bet, milestone,
slice, facing and proof ids are all spelled exactly as the prose spells them.
Markers were read off the fixture's own test files, so the plan and the tests
carry one spelling.

### What was iterated, and what was not

Both plans parsed on the first attempt. Nothing was adjusted to make them parse.

Parsing was checked without running the binary, using a throwaway Go program in
the main repo that called `plan.Load` and `manifest.Load` on each fixture and
printed nothing but whether they read. That program was deleted before this
record was committed. It judges nothing, so it cannot have tuned anything: the
first judgment either fixture produced was the graded `board` run.

---

## What the runner noticed

These are observations, not findings. The grading dispatch files findings. They
are written here so the grader has the runner's reading beside the raw output.

**O1. sift's board matched its intent page exactly, wrinkle included.**
`PLAN-INTENT.md` says three proofs pass, two fail at real assertions, and
`p_render_empty` passes under an unlanded slice. The board said the same, and
flagged that last one `ahead of plan` rather than red. The `stub` row agreed:
`1 ahead of plan`. Nothing about the wrinkle had to be explained to the tool.

**O2. gauge's board showed the gap the fixture was built around.** The plan
expects three green and six red. The run showed six passed and three failed. The
board named all three of the extra passes `ahead of plan`:
`p_parse_negative`, `p_convert_round_trip` and `p_sum_average`.

**O3. The stub row caught two of the three planted styles, not three.** Its
line reads `3 red at an assertion, 2 not, 1 ahead of plan`. Reading the fixture's
own test source, the three planted styles are:

- `p_convert_round_trip` — an empty body. Caught. The honesty scan named it by
  file and line: `convert_test.go:27 ... asserts nothing`.
- `p_sum_average` — a commented-out assertion, with a bare call left above it.
  Caught. It is the `and 1 more` on the honesty row's line.
- `p_parse_negative` — an always-true assertion. **Not caught.** It reads:

  ```go
  got, _ := gauge.ParseLength("-2m")
  want := got

  if got != want {
      t.Fatalf(...)
  }
  ```

  The scan's self-comparison rule compares the two sides of the condition as
  they were written, with the spaces taken out. `got != got` fires. `got !=
  want` does not, even where `want` was assigned from `got` one line above. The
  scan does not follow a one-line alias.

  So this stub arrived at the `stub` row as a test that can fail and passed
  anyway, which is `green ahead of plan` — counted, named on the board, and
  never red. The contract already says this is where the scan's reach ends
  (section 3.4: "What the scan cannot follow reads as a test that can fail"),
  and the row's line claims only what the scan found. Whether a documented limit
  is an acceptable answer to a planted style the ladder names is the grader's
  call, not the runner's.

**O4. Two rows went red on gauge for reasons outside the graded questions.**
The `honesty` row red is the same two stubs the `stub` row is red about — one
fault, two reds, which the contract elsewhere says it tries to avoid. The
`wiring` row red is `ToMetres is exported and nothing in the module names it`,
and its own line adds `on profile library an export needs no in-repo caller`.
That clause says the red is wrong for this profile, and the row went red anyway.
Worth a look. Not fixed here.

**O5. The `mutate` row went unrunnable on gauge and green on sift, both with an
odd clause.** gauge: `sampled 6 of 6 targets ... killed 0, 6 blocked by their own
package; . holds 6 targets and its own tests do not pass unmutated`. sift:
`killed 2, 2 blocked; internal/report holds 2 targets and its own tests do not
pass unmutated`. A package whose tests do not pass unmutated is exactly what an
unlanded milestone looks like, so the row blocks on every fixture with red
proofs in it. Honest, and it means the row says nothing on a repo mid-bet.

**O6. The board named the wrong commit as the stray, on both fixtures.** Both
fixtures write two commits per landed slice: a red-proof commit and then the
commit that makes it green, and both carry the same `Slice:` trailer. D57 ruling
4 says the oldest claim is the landing, so the board reads the red-proof commit
as the landing and names the commit that actually finished the work as
`names a slice an earlier commit already landed`. Contract-correct, and it points
a reader at the commit before the work. The fixtures were authored by somebody
who had not seen the contract, which is what makes this worth writing down: the
convention they chose on their own collides with the rule. Not red either way.

**O7. Nothing reported unrunnable for a shallow history.** Both clones are whole,
and the `waiver-count` row reported `0 waiver files ... a real zero` on both
rather than going unrunnable. That is the expected answer for a whole clone.

## What the runner did not read

No answer key was opened, glimpsed, or fetched. Specifically:

- `ANSWER-KEY.json` was never read, shown, diffed, or listed with its contents in
  either repo. `find` confirmed it is absent from both working trees.
- Neither sealed tip was ever passed to `git show`, `git diff`, `git cat-file`,
  or any other command that prints a commit's content. Neither tip's commit
  subject was ever printed: the depth check used `git rev-list --count` and
  `git rev-list --max-parents=0`, and the history listings were taken after the
  clones had been reset to the parent.
- Each clone's `origin` remote was removed straight after the reset, so no ref in
  either working repo points at a sealed tip.
- Nothing behind the `legacy-final` tag or on the `legacy` branch was read.
- No other holdout branch was read: not `holdout-go-fieldkit`, not
  `holdout-ts-tallysheet`, not either `holdout2-*`.

The fixtures' own source — `PLAN-INTENT.md`, the Go files and the test files —
was read. That is the material a blind adopter works from, and it is not the key.

## What this record is not

It does not grade. It files no finding, rules nothing, and does not touch
`docs/findings.md`, `docs/decisions.md`, or the grading section of
`docs/evidence/bet-3/holdout.md`. Those belong to the grading dispatch, which
opens the keys and reads this page beside them.

The proof `TestProof_b3s8_grading_the_sealed_fixtures_are_run_once` stays red
until that grading is written.
