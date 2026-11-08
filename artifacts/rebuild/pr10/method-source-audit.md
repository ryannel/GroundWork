# Retired method source destinations

All 279,794 live method-only pages outside the historical entry archive have at least one
original source link to a blob path verified in the same repository and commit. The extraction
checks the original selected pack, index and page lengths and hashes before reading those links.
It preserves the original source URLs, including their line locators, and omits the method
canvas. This checks blob paths for this method-only set. The separate published-entry audit also
checked physical line bounds for the entry set.

A scratch candidate preserves 279,794 additional destinations and all 13,502 prior live method
destinations. Its 2,139 compressed groups use 49,411,754 bytes. The largest decoded group is
3,989,857 bytes, below the 4 MiB bound. The candidate has yet to be applied to the Volvo archive.
The data and overview addresses outside the approved entry archive are tracked separately in
`direct-address-audit.md`.
