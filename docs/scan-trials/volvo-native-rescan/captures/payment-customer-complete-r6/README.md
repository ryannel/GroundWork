# Customer completed source capture

Selected snapshot: `28f6bf27bc6099bbc14ca4cc119a69a35f84f117bb7c71bb47037c57daad3953`.
Repository `volvo-cars/cds-paymentservice-customer` at `b0010537cdd5a308a30a885541748727c97ecb2e`.

The capture contains **15,604 records** and **1,564 independently verified source ranges**. All 55 production
Java files and production configuration/support files were inspected. Its 195 source frames comprise 166
explicit bodies and 29 lambdas. There are 12 REST routes and 25 process/framework callback views. Nine exported
Feign contracts remain library declarations with no runtime host or entry binding.

The author's 248 acceptance queries pass without budget limits. Root separately reviewed pinned create/update,
relation replacement, PSP detail construction, recurring ownership guards, cache fallback and advice source,
and passed 11 independent boundary/value queries. The author also performed a disclosed 114-query rereview;
that rereview is not a second independent author. Original working inputs and seals remain unchanged.

Actual create reaches Mongo and the configured PSP component; local anonymised save precedes PSP creation
and the returned PSP relation is saved afterwards. Update saves selected local fields before the possible
missing-relation404 and per-relation PSP calls. PSP arguments retain original request PII separately from
local anonymised fields. The 22 native interactions retain actual receivers, arguments and source anchors.
The nine conditional write records acknowledge normal API return, with unknown atomicity and durability.

The configured cache wrapper reaches Redis, but route-to-cache advisor ordering is unresolved; annotations
do not create eager controller calls. putIfAbsent can be a no-op, and callable fallback can reinvoke a loader.
Advice preserves the source403/422 annotations versus UNAUTHORIZED helper arguments without guessing final
HTTP status. Source-library limitations remain inside the host; real PSP transport remains a visible boundary.

Source inspection is complete within this repository. Generated/imported methods, virtual/callback dispatch,
serialisation, profiles and storage acknowledgement semantics retain explicit limits. These are source facts,
not runtime observation, formal heap analysis or path-feasibility proof. No source application build/test,
fetch or live API/store/broker call was performed. See [handoff](HANDOFF.md), [query checks](query-checks.json)
and the retained compressed query results for detail. This independent selection does not migrate the app or
replace the earlier combined seven-repository manifest.
