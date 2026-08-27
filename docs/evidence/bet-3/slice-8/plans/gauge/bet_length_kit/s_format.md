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
