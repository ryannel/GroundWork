Evidence order used for the plan:
1. Read the skill taxonomy to keep direction, role, ownership, transport, and data-shape dimensions separate.
2. Read the normalized output contract to preserve repository, revision, component, relations, APIs, resources, messages, and gaps.
3. Read the evaluation prompt list to confirm the expected behavior for system boundary selection, coverage-first discovery, and low-cost fan-out.
4. Read the validator to ensure any worker output must include revision, component metadata, evidence arrays, and valid enums.

Research plan:
- Use Backstage as the source of truth for the pricing system boundary.
- Query existing Groundwork and System Atlas artifacts before touching source repositories.
- Limit repository inspection to unresolved coverage cells only.
- Delegate per-repository extraction with normalized JSON output and validation.

Decisions:
- No repository clone or catalog write will be attempted in this run.
- The final response focuses on an execution plan aligned to the skill rather than fabricated evidence.