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
