# System overview budget

The third production build measured Assortment at 2,017,178 bytes. The overview drew 456 entry rows and 1,787 gap rows, including repeated instances of nine exact messages.

The overview now draws 30 entries and links the full list through the exact canonical system filter. The system browser and overview share the same offered-entry query. This preserves APIs provided by an unmapped system even when their declarations are stored in a consuming system's file. The real Assortment list contains all 456 entries exactly once in their original overview order across 16 pages. Its first page input is 8,459 bytes.

The overview uses the same gap summary helper as the operation catalogue. It counts each exact kind and message once. All 1,787 occurrences remain represented in nine rows. These summary rows occupy 945 bytes, compared with 347,501 bytes for the full records. Full references remain in the canonical index, server view and inspector. The entries and gap rows drawn by the overview occupy 8,453 serialized bytes, compared with 448,156 bytes before the change. Production HTTP size remains a separate build and budget result.

The eight focused suites passed 45 tests, including exact entry identity and order, canonical and token system selectors, invalid scopes, unmapped providers, pagination URLs, retained contexts and rendered occurrence counts. The scope and header helpers preserve the existing complexity thresholds. After that extraction, the affected entry selection and canvas suites were rerun. Source is frozen for the parent's final gates.

[Exact metrics and source hashes](system-overview-budget.json)
