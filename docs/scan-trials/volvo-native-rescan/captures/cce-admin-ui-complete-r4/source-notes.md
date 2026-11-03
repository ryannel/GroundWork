# Admin UI source nullability correction

Pinned source declarations contain 1,012 explicit outer null-union fields across 440 source shapes. R3 kept their source type text but omitted native nullable. Two independent parse-only checks reread 248 exact pinned files; the Sol check requires each exact property to be wholly inside its cited evidence and tests negative function-return, array-element and nested-generic cases. Only native nullable is added. Namespace translation creates R4 immutable identities; logical identities and every other source/execution fact remain equal.

All 18 prior independent queries replay with equal node/edge multisets. A nineteenth returns every corrected field with native nullable. The complete bundle passes current schema, semantic, hash and 27,855 pinned-source-range checks. Original R3 capture and its broader source review remain available. The correction does not establish runtime wire enforcement or remove R3 broad-query limits.
