# Compare published entry links

The read-only audit verified each active service manifest against its installed catalogue receipt
and enumerated 1,697 live entry links and 28 fallback links. A match requires the same repository
and commit, a unique native entry, and a matching source anchor. HTTP operations also require the
same method and path. A canonical source citation can cover the old declaration's span without
having the same line endpoints.

| Publication | Disposition | Links |
| --- | --- | ---: |
| Live | Unique same-pin source and native entry | 245 |
| Live | Same operation shape with insufficient source alignment | 395 |
| Live | Source anchor present, exact native entry unproved | 1,019 |
| Live | Original scheduler or consumer anchor absent from canonical evidence | 38 |
| Fallback | Historical Customer Service pin | 22 |
| Fallback | Exact native entry unproved at the matching pin | 6 |

For Account Profile API, the original GET account entry points at line 47 of the V1 account
controller. The native entry cites that same pinned file at lines 25–63, declares the same GET
path, and resolves uniquely. Customer Service's fallback instead pins `09623ab3…`, while the
current record pins `6619027a…`. The older link needs a historical destination.

The unmatched rows are entry links. Approval to remove method-only browsing leaves these entry
destinations in scope. Source matches and possible native candidates in the local audit are
separate fields so a candidate can never become an automatic redirect.

A separate artefact audit checked all 1,725 entry pages and each selected index and pack through
their published lengths and hashes. All 1,725 pages have pinned source links. Every such link
resolves to a Git blob and, where present, a valid line range at its recorded commit. This includes
the 22 historical Customer Service pages. The entry pages total 23,787,115 live bytes and
213,059 fallback bytes. They directly reference 3,320 live and 29 fallback data pages. The audit
found no missing direct target.
