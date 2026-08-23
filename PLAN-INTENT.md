# Plan intent for gauge

This page says what this repository is building and how the work is cut up.
It is written as prose so a later reader can turn it into plan files by
hand. Every id here is lowercase letters, digits and underscores.

## The program

- Program id: `gauge`
- Goal: a small library for lengths. It reads a length written as text,
  prints a length back in the shortest sensible unit, converts between
  metric and feet, and adds lengths up.

All of it is one package at the root of the module.

## The bet

- Bet id: `bet_length_kit`
- Title: Make gauge read, print and do sums on lengths.
- The bet has two milestones. Milestone 1 reads and prints. Milestone 2
  does the arithmetic and the harder reading.

### Milestone 1

- Milestone id: `m1_read_and_print`
- Title: Read a length and print it back.
- Slices: `s_parse_units`, then `s_format`.

### Milestone 2

- Milestone id: `m2_arithmetic`
- Title: Convert lengths and add them up.
- Slices: `s_parse_more`, `s_convert`, then `s_total`.

## The slices

Slices land in this order: `s_parse_units`, `s_format`, `s_parse_more`,
`s_convert`, `s_total`.

- `s_parse_units` — milestone `m1_read_and_print`. Read a plain decimal
  length with a metric unit suffix and return metres.
- `s_format` — milestone `m1_read_and_print`. Print metres back in the
  shortest sensible unit.
- `s_parse_more` — milestone `m2_arithmetic`. Read a fraction such as
  "1/2m", and refuse a negative length.
- `s_convert` — milestone `m2_arithmetic`. Convert metres to feet, and back
  again without drift.
- `s_total` — milestone `m2_arithmetic`. Add a list of lengths, and take
  their mean.

## The user facing items

Each item is claimed by exactly one slice.

- `i_read_metres` — "A length written in metres is read." Claimed by
  `s_parse_units`.
- `i_read_centimetres` — "A length written in centimetres is read as
  metres." Claimed by `s_parse_units`.
- `i_short_form` — "A length prints in the shortest sensible unit."
  Claimed by `s_format`.
- `i_read_fraction` — "A length written as a fraction is read." Claimed by
  `s_parse_more`.
- `i_refuse_negative` — "A negative length is refused." Claimed by
  `s_parse_more`.
- `i_to_feet` — "Metres convert to feet." Claimed by `s_convert`.
- `i_round_trip` — "Metres to feet and back gives the same length."
  Claimed by `s_convert`.
- `i_sum` — "A list of lengths adds up." Claimed by `s_total`.
- `i_mean` — "A list of lengths has a mean." Claimed by `s_total`.

## The proofs

A proof is a Go test named `TestProof_<proof_id>_<ReadableWords>`.

- `s_parse_units` owns `p_parse_metres` (covers `i_read_metres`) and
  `p_parse_centimetres` (covers `i_read_centimetres`).
- `s_format` owns `p_format_short` (covers `i_short_form`).
- `s_parse_more` owns `p_parse_fraction` (covers `i_read_fraction`) and
  `p_parse_negative` (covers `i_refuse_negative`).
- `s_convert` owns `p_convert_feet` (covers `i_to_feet`) and
  `p_convert_round_trip` (covers `i_round_trip`).
- `s_total` owns `p_sum_lengths` (covers `i_sum`) and `p_sum_average`
  (covers `i_mean`).

## What has landed

Milestone 1 has landed. Both of its slices are in the history, each with a
red proof commit followed by a landing commit. A landing commit carries the
trailers `Bet: bet_length_kit` and `Slice: <slice id>`.

Milestone 2 has not landed. None of `s_parse_more`, `s_convert` or
`s_total` has a landing commit. Their proofs are already in the tree, so
the plan can be read against real tests, and the commit that carries them
deliberately has no `Slice:` trailer because nothing landed in it.

So the plan expects this at the tip of this branch:

- `p_parse_metres`, `p_parse_centimetres` and `p_format_short` are green.
- All six milestone 2 proofs are red: `p_parse_fraction`,
  `p_parse_negative`, `p_convert_feet`, `p_convert_round_trip`,
  `p_sum_lengths` and `p_sum_average`. Every one of them belongs to a slice
  that has not landed, so red is the expected and correct state for each.

That is what the plan says. Whether every one of those six really is red,
and red because the code it calls is missing rather than because the test
never asserts anything, is the thing a proof check has to work out for
itself.
