# Plan intent for sift

This page says what this repository is building and how the work is cut up.
It is written as prose so a later reader can turn it into plan files by hand.
Every id here is lowercase letters, digits and underscores.

## The program

- Program id: `sift`
- Goal: read a stream of plain text records on standard input and print a
  small summary of them. One record per line. A record is a kind, a host,
  and a message. The summary is a count per kind.

The command lives in `cmd/sift`. The parsing code lives in
`internal/record`. The summarising code lives in `internal/report`.

## The bet

- Bet id: `bet_summary_core`
- Title: Make sift read records and summarise them.
- The bet has two milestones. Milestone 1 reads records. Milestone 2
  summarises them.

### Milestone 1

- Milestone id: `m1_read_records`
- Title: Turn input lines into records.
- Slices in this milestone: `s_tokenize`, then `s_record_parse`.

### Milestone 2

- Milestone id: `m2_summarise`
- Title: Count records and print the summary.
- Slices in this milestone: `s_aggregate`, then `s_render`.

## The slices

Slices land in this order: `s_tokenize`, `s_record_parse`, `s_aggregate`,
`s_render`.

- `s_tokenize` — milestone `m1_read_records`. Split one line into fields.
  Spaces separate fields. A field wrapped in double quotes may hold spaces.
- `s_record_parse` — milestone `m1_read_records`. Turn a line's fields into
  a record with a kind, a host and a message. Report a line with fewer than
  three fields as an error.
- `s_aggregate` — milestone `m2_summarise`. Count how many records carry
  each kind.
- `s_render` — milestone `m2_summarise`. Print the counts as an aligned
  table, one kind per line, sorted by kind. Print a plain line when there
  is nothing to report.

## The user facing items

Each item is claimed by exactly one slice.

- `i_split_fields` — "Plain space separated fields are read." Claimed by
  `s_tokenize`.
- `i_quoted_fields` — "A quoted field keeps its spaces." Claimed by
  `s_tokenize`.
- `i_named_record` — "A line becomes a record with a kind, a host and a
  message." Claimed by `s_record_parse`.
- `i_short_line_error` — "A line with fewer than three fields is reported
  as an error." Claimed by `s_record_parse`.
- `i_count_by_kind` — "The summary says how many records carry each kind."
  Claimed by `s_aggregate`.
- `i_table_output` — "The counts print as an aligned table, sorted by
  kind." Claimed by `s_render`.
- `i_empty_report` — "A run with no records says so in one plain line."
  Claimed by `s_render`.

## The proofs

A proof is a Go test named `TestProof_<proof_id>_<ReadableWords>`.

- `s_tokenize` owns two proofs.
  - `p_tokenize_basic` covers `i_split_fields`.
  - `p_tokenize_quoted` covers `i_quoted_fields`.
- `s_record_parse` owns one proof.
  - `p_record_parse` covers two items at once: `i_named_record` and
    `i_short_line_error`. One test asserts both the good line and the short
    line, because the two facts share a single call.
- `s_aggregate` owns one proof.
  - `p_aggregate_counts` covers `i_count_by_kind`.
- `s_render` owns two proofs.
  - `p_render_table` covers `i_table_output`.
  - `p_render_empty` covers `i_empty_report`.

## What has landed

Milestone 1 has landed. Both of its slices are in the history, each with a
red proof commit followed by a landing commit. A landing commit carries the
trailers `Bet: bet_summary_core` and `Slice: <slice id>`.

Milestone 2 has not landed. Its proofs are already in the tree so the plan
can be read against real tests, but `s_aggregate` and `s_render` have no
landing commit. The commits that carry those proofs deliberately carry no
`Slice:` trailer, because nothing landed in them.

So at the tip of this branch:

- `p_tokenize_basic`, `p_tokenize_quoted` and `p_record_parse` pass.
- `p_aggregate_counts` and `p_render_table` fail, each at a real assertion
  on a real call. The code they call exists and returns an empty answer.
- `p_render_empty` passes. See the wrinkle below.

## The wrinkle

`p_render_empty` belongs to `s_render`, which has not landed, yet it
passes. That is honest, not a trick. While wiring `cmd/sift` we needed the
command to print something sane on an empty run, so the empty case of the
table was written ahead of its slice. The rest of `s_render` is still
missing. A plan check should see one green proof sitting under an unlanded
slice and treat it as work done ahead of plan.

A second thing worth noticing, though it is ordinary: `p_record_parse` is
one proof standing for two items. A checker that assumes one proof means
one item will miscount here.
