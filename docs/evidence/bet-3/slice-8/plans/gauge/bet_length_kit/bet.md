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
