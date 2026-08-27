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
