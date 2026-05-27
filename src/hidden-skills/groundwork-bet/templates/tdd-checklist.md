# TDD Checklist & Proof of Work

*This document is the absolute boundary for the Delivery phase. Every phase from the pitch must be populated here before implementation begins. The developer agent cannot proceed until all criteria, slices, requirements, and test cases are defined.*

---

## Milestone [N]: [Milestone Name]

### Criteria — Definition of Done
*The phase is complete when all of the following are true. Each criterion must be specific and testable — not "works correctly" but "returns 200 with session_id on valid input".*

- [ ] [criterion]
- [ ] [criterion]

### Service-Level Slices
*Which services are touched in this phase and what each one contributes. If a service is unchanged, omit it.*

| Service | Responsibility in this phase |
|---------|------------------------------|
| [service name] | [what it provides] |

### Requirements
*Structural components that must exist before tests can pass. These become the implementation checklist in the Delivery phase.*

**Backend:**
- [ ] [component or endpoint]

**Frontend:**
- [ ] [component or state]

**Database:**
- [ ] [migration or seed]

### Test Cases
*Failing tests that define acceptance for this phase. Written before implementation. Each line maps to a test method that currently fails.*

- [ ] `[test file path]::[TestClass]::[test_method]`
- [ ] `[test file path]::[TestClass]::[test_method]`

---
*(Repeat the Milestone block for every Milestone defined in the pitch. All milestones must be present before Proof of Work is presented.)*

---

## Summary

| Milestone | Test Count | Status |
|-----------|-----------|--------|
| [Milestone 1 name] | [n] | Defined |
| [Milestone 2 name] | [n] | Defined |

**Milestones covered:** [N] of [N total]
**Total test cases:** [count]
**Services touched:** [comma-separated list]

**Proof of Work:**
- [ ] `docs/bets/<bet-slug>/technical-design.md` drafted (data flows, API contracts, design)
- [ ] All milestones present in this checklist with non-empty Criteria, Service Slices, Requirements, and Test Cases
- [ ] Test files written to `docs/bets/<bet-slug>/tdd/` for each milestone
