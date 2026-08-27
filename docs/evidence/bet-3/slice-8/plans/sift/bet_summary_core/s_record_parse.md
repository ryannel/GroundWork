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
