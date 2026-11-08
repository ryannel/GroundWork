# Candidate for the remaining direct addresses

A read-only scratch extraction verified all 86,991 remaining live data pages and 104,867
remaining live overview pages against their original publication hashes. A lossless packed
candidate uses 61,320,503 bytes before manifest overhead. It keeps the exact page bytes and
repository pin. The current candidate uses 20,511 small packs. The final archive would coalesce
small packs within each repository while preserving the per-page hash and the read bound.

A separate candidate for method source destinations uses 49,411,754 bytes. It preserves the
pinned destinations without preserving the method canvases. Both candidates remain in scratch.
The original explorer reader and assets serve the additional addresses until their disposition
is approved and the replacement proof passes.
