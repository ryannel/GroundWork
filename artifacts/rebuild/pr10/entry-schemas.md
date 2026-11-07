# Entry schema links

The entry flow projects the exact authored request and response schema links. A step that reads or
writes a field can open its owning schema while keeping the original field detail in the inspector.
The link uses the existing native inspection with its field and recorded reference navigation.

The plan reader supplies the actual plan folder independently of its immutable identity. The
selected before view stays in the link. Tests cover current request and response links and the
step's schema address in a before view whose folder name differs from the plan identity.
The incremental checks passed lint, types and 48 related tests.
