# Code Craft & Security

## Code Craft Principles

1. **Simpler is better than clever.** Plain data structures over clever abstractions, plain control flow over meta-programming.
2. **No speculative abstraction.** Three concrete use cases before generalising.
3. **Deletion is a virtue.** Dead code cannot break, confuse, or leak.
4. **Names are the interface.** Spend time on names. Rename aggressively.
5. **Comments explain the "why."** Non-obvious constraints, invariants, ADR references.
6. **Error handling is design, not decoration.** Decide which errors a function returns, how callers respond, where recoverable/fatal boundary is.
7. **Trust the boundary; distrust the internal.** Validate at system boundaries. Do not re-validate between internal callers.
8. **Dead code is a bug.** Commented-out code, `_unused` variables, orphan functions — delete them.

## Security Principles

1. **Zero trust between services.** Every call carries an identity, every identity is authorised per operation.
2. **Threat model the change.** Five-minute threat conversation for new endpoints, data fields, integrations.
3. **Secrets are managed, rotated, and audited.** No secrets in source. Fetched at runtime from a secret manager.
4. **Input is hostile; validate at the boundary.** Request bodies, webhook payloads, message queue events.
5. **Supply chain is part of the attack surface.** Pin versions, review new dependencies, SBOM generation.
6. **Least privilege by default.** Minimum permissions, extended only on evidence.
7. **Auth is boring technology.** Standard auth provider, standard session handling. No custom auth.
8. **Detect and respond, not just prevent.** Log security events, alert on suspicious patterns, run tabletops.

## Anti-Patterns

### Code Craft
- Defensive programming without a threat model. "Might need it later" scaffolding.
- Fashion-driven refactors. Multi-paragraph docstrings. Backwards-compatibility shims for internal APIs.

### Security
- Internal network = trusted. Secrets in environment variables checked into Git.
- "It is an internal tool, we can skip auth." Dependencies pulled in on intuition.
- Exotic auth. "The WAF will catch it."
