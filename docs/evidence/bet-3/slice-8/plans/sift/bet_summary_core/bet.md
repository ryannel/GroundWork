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
