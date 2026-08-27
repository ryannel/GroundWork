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
