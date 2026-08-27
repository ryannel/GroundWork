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
