# Account Profile completed source capture

Selected snapshot: `3279017c3ab086d138a0b7115f74612844f6bdff280a613228c1ecf3887fd5e0`.
Source `volvo-cars/account-profile-api` at `bc3003a9130cd9a8013d74ec4561575d1f1d935b`.

The capture has **6,996 records**, **854 independently verified source ranges**, and 116 inspected source
frames. All 65 production C# files and relevant configuration/support were inspected; all 110 tracked files
are reconciled. It contains three business REST routes, health registration and the actual process body.
The author's197 queries and root's19 independent queries pass without limits. Root separately read20 pinned
source files covering all three route paths, mapping, validation, settings, configuration and startup.

GET/PUT account routes reach the source-declared logical Account API through actual five/six-argument SDK
calls. Their transport, destination URL and HTTP wire contract remain unresolved. Immediate Task handles
and explicit Await results stay distinct. PUT validates locally, constructs only Firstname, Lastname,
Gender, Address and Birthdate, and does not send accepted Zoneinfo. Remote400/422 become the local system
error path; local validation400/422 has separate logic. The known update-address overload is natively bound.

Settings are in memory and use reflection and pagination. There is no discovered route-to-database/cache/
broker or settings-to-Account SDK call. Declared Terraform storage and registered feature-toggle/configuration
libraries do not establish route I/O. Exact callbacks, auth/media/serializer configuration and source-only
helpers remain queryable, with imported scheduling and effective wire semantics explicit.

Native immediate return kinds come from trustworthy local signatures. The16 bound source-void calls define
no result; Task values remain values. Earlier provisional candidates are preserved and unselected.
Source inspection does not claim runtime observation, heap-state proof, deployment or storage durability.
No source application build/test, fetch or live API/store/broker call was performed.

See [handoff](HANDOFF.md), [independent checks](independent-summary.json), the source/file/callback/schema
ledgers and compressed query evidence. This independent selection does not migrate the application or
replace the earlier combined snapshot.
