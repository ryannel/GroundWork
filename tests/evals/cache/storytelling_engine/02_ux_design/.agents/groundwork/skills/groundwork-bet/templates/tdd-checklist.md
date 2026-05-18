# TDD Checklist & Proof of Work

*This document serves as the absolute boundary and contract for the Delivery phase. The developer agent cannot proceed until all structural components and tests are defined here.*

## Epic: [Epic Name]

### Story: [Story Name]
*Description of the vertical slice.*

#### API Contracts (Schema-First)
- [ ] OpenAPI (or equivalent) schema updated with new models/endpoints.
- [ ] Local API clients generated/synced.

#### Structural Contracts
- [ ] **Database:** Migration for `resource` table defined.
- [ ] **UI:** `ResourceView` component states (loading, success, error) defined.

#### Tests (Failing)
- [ ] `tests/integration/test_create_resource.py::test_successful_creation`
- [ ] `tests/integration/test_create_resource.py::test_validation_error`

---
*(Duplicate the Story block for all stories within the Epic)*
