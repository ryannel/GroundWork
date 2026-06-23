# Test Review: [Bet Name]

*This document puts the bet-progress suite's actual assertions in front of the user before they approve Proof of Work. Approving it means: implementing until these assertions pass is the definition of done for this bet. Every entry is generated from the real test file — quote the assertion block verbatim, never paraphrase it.*

---

## Milestone [N]: [Milestone Title]

**Proves:** [the milestone's user-visible acceptance criterion, quoted from `decomposition.md`]

**Test file:** `tests/bets/<bet-slug>/test_milestone_<N>_<milestone-slug>.<ext>`

### [test function name]

**Traces to:** [a Surface Design subsection in `technical-design/01-surface-design.md` for a surface milestone, or a `contracts/openapi.yaml` operation for a capability milestone]

```
[verbatim assertion block from the test file — the lines that decide pass/fail,
including the target-state description in the explicit-failure placeholder]
```

**Reads as:** [one plain-language sentence — what passing this test proves about the product]

---

### Slice [N.M] — [service]: [Slice Title]

**Proves:** [the Required Capability this test covers, quoted from `decomposition.md`]

**Test file:** `tests/bets/<bet-slug>/test_slice_<N>_<service>_<slice-slug>.<ext>`

#### [test function name]

**Traces to:** [`contracts/openapi.yaml` operation, `asyncapi.yaml` channel, or `schema.sql` table]

```
[verbatim assertion block]
```

**Reads as:** [one plain-language sentence]

---
*(One entry per test function in the suite. A test function with no entry here is unreviewed; an entry whose quoted block no longer matches the file is stale — both block approval.)*
